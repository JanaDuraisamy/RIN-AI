import { describe, expect, it } from 'vitest';

import { InMemoryEventBus } from '@rin/event-bus';
import { ServiceRegistryError, type EventBus } from '@rin/types';

import { ConfigurationService } from './configuration.js';
import { RinCore } from './index.js';

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
