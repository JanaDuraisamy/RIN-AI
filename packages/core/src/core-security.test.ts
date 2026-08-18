import { describe, expect, it } from 'vitest';

import { InMemoryEventBus } from '@rin/event-bus';
import { SecurityFoundation } from '@rin/security';
import { ServiceRegistryError } from '@rin/types';

import { RinCore } from './index.js';

function buildSecurityFoundation(): SecurityFoundation {
  const foundation = new SecurityFoundation();
  foundation.registry.register({
    id: 'policy-1',
    caller: 'memory-engine',
    action: 'memory:read',
    resource: '*',
    category: 'always-allowed',
  });
  return foundation;
}

describe('RinCore security integration', () => {
  it('registers the permission and audit services when provided', () => {
    const foundation = buildSecurityFoundation();
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      permissionEvaluator: foundation.evaluator,
      permissionRegistry: foundation.registry,
      auditSink: foundation.auditSink,
    });
    core.initialize();

    expect(core.getService('permission')).toBe(foundation.evaluator);
    expect(core.getService('audit')).toBe(foundation.auditSink);
    expect(core.listServices().some((service) => service.name === 'permission')).toBe(true);
    expect(core.listServices().some((service) => service.name === 'audit')).toBe(true);
    expect(core.permissionEvaluator).toBe(foundation.evaluator);
    expect(core.permissionRegistry).toBe(foundation.registry);
    expect(core.auditSink).toBe(foundation.auditSink);
  });

  it('marks permission and audit services as healthy in the health summary', () => {
    const foundation = buildSecurityFoundation();
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      permissionEvaluator: foundation.evaluator,
      auditSink: foundation.auditSink,
    });
    core.initialize();

    const summary = core.getHealthSummary();
    expect(summary.totalServices).toBe(5);
    expect(summary.healthyServices).toBe(5);
  });

  it('does not register security services when none are provided', () => {
    const core = new RinCore({ eventBus: new InMemoryEventBus() });
    core.initialize();

    expect(core.listServices().some((service) => service.name === 'permission')).toBe(false);
    expect(core.listServices().some((service) => service.name === 'audit')).toBe(false);
    expect(() => core.getService('permission')).toThrow(ServiceRegistryError);
    expect(() => core.getService('audit')).toThrow(ServiceRegistryError);
  });

  it('supports permission decisions through the resolved service', () => {
    const foundation = buildSecurityFoundation();
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      permissionEvaluator: foundation.evaluator,
    });
    core.initialize();

    const evaluator = core.getService<SecurityFoundation['evaluator']>('permission');
    const decision = evaluator.evaluate({
      action: 'memory:read',
      resource: 'mem-1',
      caller: 'memory-engine',
      requestId: 'req-1',
      timestamp: '2026-08-18T00:00:00.000Z',
    });

    expect(decision.permitted).toBe(true);
  });

  it('keeps security service registration stable across restart', () => {
    const foundation = buildSecurityFoundation();
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      permissionEvaluator: foundation.evaluator,
      auditSink: foundation.auditSink,
    });
    core.initialize();
    core.startServices();

    core.restart();

    expect(core.getService('permission')).toBe(foundation.evaluator);
    expect(core.getService('audit')).toBe(foundation.auditSink);
    expect(core.getHealthSummary().ready).toBe(true);
  });
});
