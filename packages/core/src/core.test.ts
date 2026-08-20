import { describe, expect, it } from 'vitest';

import { InMemoryEventBus } from '@rin/event-bus';
import {
  DefaultPermissionEvaluator,
  InMemoryAuditSink,
  InMemoryPermissionRegistry,
} from '@rin/security';
import { ServiceRegistryError, type EventBus } from '@rin/types';

import { ConfigurationService } from './configuration.js';
import { RinCore, RuntimeLifecycle, type RestartRequest } from './index.js';

function createCore(): RinCore {
  return new RinCore({ eventBus: new InMemoryEventBus() });
}

describe('RinCore', () => {
  it('initializes the runtime to ready with healthy core services', () => {
    const core = createCore();

    core.initialize();

    expect(core.stateMachine.currentState).toBe('ready');
    expect(core.lifecycle.currentStage).toBe('runtime-ready');
    expect(core.health.getSummary().startupVerified).toBe(true);
    expect(core.health.getSummary().ready).toBe(true);
    expect(core.health.getSummary().totalServices).toBe(3);
    expect(core.health.getSummary().healthyServices).toBe(3);
    expect(core.listServices().map((entry) => entry.name)).toEqual([
      'event-bus',
      'configuration',
      'version',
    ]);
  });

  it('rejects double initialization', () => {
    const core = createCore();

    core.initialize();

    expect(() => core.initialize()).toThrow('already initialized');
  });

  it('enters safe mode when initialization fails', () => {
    const core = createCore();
    core.registry.register({ name: 'event-bus', version: '0.1.0', instance: {} });

    expect(() => core.initialize()).toThrow(ServiceRegistryError);
    expect(core.stateMachine.currentState).toBe('safe-mode');
    expect(core.health.getStatus().healthState).toBe('safe-mode');
  });

  it('starts and stops services', () => {
    const core = createCore();

    core.initialize();
    core.startServices();

    expect(core.stateMachine.currentState).toBe('running');
    expect(core.lifecycle.currentStage).toBe('active-runtime');

    core.stopServices();

    expect(core.stateMachine.currentState).toBe('ready');
    expect(core.lifecycle.currentStage).toBe('active-runtime');
  });

  it('rejects service start before initialization', () => {
    const core = createCore();

    expect(() => core.startServices()).toThrow('must be initialized');
    expect(() => core.stopServices()).toThrow('must be initialized');
  });

  it('shuts down gracefully', () => {
    const core = createCore();

    core.initialize();
    core.startServices();
    core.shutdown();

    expect(core.stateMachine.currentState).toBe('shutdown');
    expect(core.lifecycle.currentStage).toBe('graceful-shutdown');
    expect(core.health.getStatus().healthState).toBe('shutdown');
    expect(core.getHealthSummary().ready).toBe(false);
  });

  it('is idempotent on shutdown', () => {
    const core = createCore();

    core.shutdown();
    core.shutdown();

    expect(core.stateMachine.currentState).toBe('shutdown');
  });

  it('restarts into a running runtime', () => {
    const core = createCore();

    core.initialize();
    core.startServices();
    core.restart();

    expect(core.stateMachine.currentState).toBe('running');
    expect(core.lifecycle.currentStage).toBe('active-runtime');
    expect(core.health.getSummary().startupVerified).toBe(true);
    expect(core.listServices()).toHaveLength(3);
  });

  it('exposes configuration and version APIs', () => {
    const core = createCore();

    core.initialize();
    core.configuration.set('theme', 'dark');

    expect(core.configuration.get('theme')).toBe('dark');
    expect(core.getRuntimeVersion()).toEqual({
      runtimeVersion: '0.1.0',
      apiVersion: '0.1.0',
    });
    expect(core.getCompatibility().compatible).toBe(true);
  });

  it('accepts an injected configuration service', () => {
    const configuration = new ConfigurationService({ name: 'production' });
    const core = new RinCore({ eventBus: new InMemoryEventBus(), configuration });

    expect(core.configuration).toBe(configuration);
    expect(core.configuration.getEnvironment().name).toBe('production');
  });

  it('integrates with the event bus through the registry', async () => {
    const bus = new InMemoryEventBus();
    const core = new RinCore({ eventBus: bus });

    core.initialize();

    const resolved = core.getService<EventBus>('event-bus');
    expect(resolved).toBe(bus);

    const received: string[] = [];
    resolved.subscribe({ eventType: 'core.test.event' }, (envelope) => {
      received.push(envelope.eventType);
    });

    await bus.publish({
      eventType: 'core.test.event',
      source: 'core-test',
      payload: { ok: true },
      eventVersion: '1.0.0',
    });

    expect(received).toEqual(['core.test.event']);
  });

  it('routes requests through the router', async () => {
    const core = createCore();

    core.initialize();
    core.requestRouter.register('test.method', (request) => request.callingComponent);

    const response = await core.requestRouter.dispatch({
      requestId: 'req-1',
      timestamp: new Date().toISOString(),
      callingComponent: 'test.method',
      apiVersion: '0.1.0',
    });

    expect(response.status).toBe('success');
    expect(response.result).toBe('test.method');
  });

  it('recovers operations through the error coordinator', async () => {
    const core = createCore();

    core.initialize();

    let calls = 0;
    const outcome = await core.errorCoordinator.recover(new Error('boom'), () => {
      calls += 1;
      if (calls < 2) {
        throw new Error('transient');
      }
    });

    expect(outcome.success).toBe(true);
    expect(outcome.strategy).toBe('retry');
    expect(outcome.healthState).toBe('running');
  });
});

function makeRestartRequest(overrides: Partial<RestartRequest> = {}): RestartRequest {
  return {
    requestId: 'req-restart-1',
    timestamp: '2026-08-20T00:00:00.000Z',
    callingComponent: 'owner',
    traceId: 'trace-restart-1',
    ...overrides,
  };
}

function createGuardedCore(): {
  bus: InMemoryEventBus;
  registry: InMemoryPermissionRegistry;
  evaluator: DefaultPermissionEvaluator;
  auditSink: InMemoryAuditSink;
  core: RinCore;
} {
  const bus = new InMemoryEventBus();
  const registry = new InMemoryPermissionRegistry();
  const evaluator = new DefaultPermissionEvaluator(registry);
  const auditSink = new InMemoryAuditSink();
  const core = new RinCore({
    eventBus: bus,
    permissionEvaluator: evaluator,
    permissionRegistry: registry,
    auditSink,
  });
  core.initialize();
  core.startServices();
  return { bus, registry, evaluator, auditSink, core };
}

function allowRestartFor(registry: InMemoryPermissionRegistry, caller: string): void {
  registry.register({
    id: `restart-policy-${caller}`,
    caller,
    action: 'core:restart',
    resource: 'runtime',
    category: 'always-allowed',
  });
}

describe('RinCore restart seam', () => {
  it('executes an authorized restart successfully', () => {
    const { core, registry } = createGuardedCore();
    allowRestartFor(registry, 'owner');

    const result = core.restartSeam(makeRestartRequest());

    expect(result.status).toBe('success');
    expect(result.result).toBeNull();
    expect(result.error).toBeNull();
  });

  it('denies restart when no permission policy exists', () => {
    const { core, auditSink } = createGuardedCore();

    const result = core.restartSeam(makeRestartRequest());

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('denied');
    expect(core.stateMachine.currentState).toBe('running');
    expect(auditSink.query({ outcome: 'denied' }).length).toBe(1);
  });

  it('returns permission-unavailable when the evaluator fails', () => {
    const bus = new InMemoryEventBus();
    const auditSink = new InMemoryAuditSink();
    const core = new RinCore({
      eventBus: bus,
      permissionEvaluator: {
        evaluate: () => {
          throw new Error('evaluator boom');
        },
      },
      auditSink,
    });
    core.initialize();
    core.startServices();

    const result = core.restartSeam(makeRestartRequest());

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('permission-unavailable');
    expect(core.stateMachine.currentState).toBe('running');
    expect(auditSink.query({ outcome: 'error' }).length).toBe(1);
  });

  it('enforces the confirmation-required boundary without executing restart', () => {
    const { core, registry, auditSink } = createGuardedCore();
    registry.register({
      id: 'restart-policy-confirmation',
      caller: 'owner',
      action: 'core:restart',
      resource: 'runtime',
      category: 'confirmation-required',
    });

    const result = core.restartSeam(makeRestartRequest({ authContext: 'ctx-1' }));

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('requires-confirmation');
    expect(core.stateMachine.currentState).toBe('running');
    expect(auditSink.query({ outcome: 'denied' }).length).toBe(1);
  });

  it('cannot execute restart without confirmation', () => {
    const { core, registry, auditSink } = createGuardedCore();
    registry.register({
      id: 'restart-policy-confirmation',
      caller: 'owner',
      action: 'core:restart',
      resource: 'runtime',
      category: 'confirmation-required',
    });

    const result = core.restartSeam(makeRestartRequest());

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('denied');
    expect(core.stateMachine.currentState).toBe('running');
    expect(auditSink.query({}).length).toBe(1);
  });

  it('produces exactly one content-free audit entry on success', () => {
    const { core, registry, auditSink } = createGuardedCore();
    allowRestartFor(registry, 'owner');

    core.restartSeam(makeRestartRequest());

    const entries = auditSink.query({});
    expect(entries.length).toBe(1);
    expect(entries[0]?.outcome).toBe('success');
    expect(entries[0]?.metadata).toEqual({});
  });

  it('sets audit requestId equal to traceId', () => {
    const { core, registry, auditSink } = createGuardedCore();
    allowRestartFor(registry, 'owner');

    core.restartSeam(makeRestartRequest());

    expect(auditSink.query({})[0]?.requestId).toBe('trace-restart-1');
  });

  it('audits action core:restart on resource runtime', () => {
    const { core, registry, auditSink } = createGuardedCore();
    allowRestartFor(registry, 'owner');

    core.restartSeam(makeRestartRequest());

    expect(auditSink.query({})[0]?.action).toBe('core:restart');
    expect(auditSink.query({})[0]?.resource).toBe('runtime');
  });

  it('reaches a running runtime after restart', () => {
    const { core, registry } = createGuardedCore();
    allowRestartFor(registry, 'owner');

    const result = core.restartSeam(makeRestartRequest());

    expect(result.status).toBe('success');
    expect(core.stateMachine.currentState).toBe('running');
    expect(core.lifecycle.currentStage).toBe('active-runtime');
    expect(core.health.getSummary().startupVerified).toBe(true);
    expect(core.listServices()).toHaveLength(5);
  });

  it('does not expose RuntimeLifecycle.reset as a restart', () => {
    const { core } = createGuardedCore();

    expect((core.lifecycle as { restart?: unknown }).restart).toBeUndefined();

    const lifecycle = new RuntimeLifecycle();
    lifecycle.transition('core-initialization');
    lifecycle.transition('engine-initialization');
    lifecycle.transition('runtime-ready');
    lifecycle.transition('active-runtime');
    lifecycle.reset();

    expect(lifecycle.currentStage).toBe('system-initialization');
    expect(core.stateMachine.currentState).toBe('running');
  });

  it('creates no persistence during restart', () => {
    const { core, registry } = createGuardedCore();
    allowRestartFor(registry, 'owner');

    core.restartSeam(makeRestartRequest());

    const services = core.listServices().map((entry) => entry.name);
    expect(services).toEqual(['event-bus', 'configuration', 'version', 'permission', 'audit']);
    expect(services.some((name) => name.includes('persistence'))).toBe(false);
  });

  it('emits no event bus restart event', () => {
    const { core, registry, bus } = createGuardedCore();
    allowRestartFor(registry, 'owner');
    const received: string[] = [];
    bus.subscribe({}, (envelope) => {
      received.push(envelope.eventType);
    });

    core.restartSeam(makeRestartRequest());

    expect(received).toEqual([]);
  });

  it('denies an unauthorized caller', () => {
    const { core, registry, auditSink } = createGuardedCore();
    allowRestartFor(registry, 'owner');

    const result = core.restartSeam(makeRestartRequest({ callingComponent: 'intruder' }));

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('denied');
    expect(core.stateMachine.currentState).toBe('running');
    expect(auditSink.query({ actor: 'intruder' }).length).toBe(1);
  });
});
