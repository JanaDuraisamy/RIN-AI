import { describe, expect, it } from 'vitest';

import type { PermissionEvaluator, PermissionRequest } from '@rin/types';

import {
  InMemoryAuditSink,
  InMemoryPermissionRegistry,
  SecurityError,
  SecurityFoundation,
} from './index.js';

function makeRequest(overrides: Partial<PermissionRequest> = {}): PermissionRequest {
  return {
    action: 'memory:read',
    resource: 'mem-1',
    caller: 'memory-engine',
    requestId: 'req-1',
    timestamp: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('SecurityFoundation defaults', () => {
  it('wires an evaluator, registry, and audit sink automatically', () => {
    const foundation = new SecurityFoundation();

    expect(foundation.evaluator).toBeDefined();
    expect(foundation.registry).toBeInstanceOf(InMemoryPermissionRegistry);
    expect(foundation.auditSink).toBeInstanceOf(InMemoryAuditSink);
    expect(foundation.decide(makeRequest()).permitted).toBe(false);
  });

  it('uses the injected registry for evaluation', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register({
      id: 'policy-1',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'always-allowed',
    });
    const foundation = new SecurityFoundation({ registry });

    expect(foundation.decide(makeRequest()).permitted).toBe(true);
    expect(foundation.registry).toBe(registry);
  });

  it('uses the injected evaluator', () => {
    const evaluator: PermissionEvaluator = {
      evaluate: () => ({
        action: 'memory:read',
        resource: 'mem-1',
        category: 'always-allowed',
        permitted: true,
        status: 'approved',
      }),
    };
    const foundation = new SecurityFoundation({ evaluator });

    expect(foundation.decide(makeRequest()).permitted).toBe(true);
    expect(foundation.evaluator).toBe(evaluator);
  });

  it('uses the injected audit sink', () => {
    const auditSink = new InMemoryAuditSink();
    const foundation = new SecurityFoundation({ auditSink });

    foundation.decide(makeRequest());

    expect(foundation.auditSink).toBe(auditSink);
    expect(auditSink.query({}).length).toBe(1);
  });

  it('audits every decision through decide', () => {
    const auditSink = new InMemoryAuditSink();
    const foundation = new SecurityFoundation({ auditSink });
    foundation.registry.register({
      id: 'policy-1',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'always-allowed',
    });

    foundation.decide(makeRequest());
    foundation.decide(makeRequest({ action: 'memory:remove' }));

    expect(auditSink.query({}).length).toBe(2);
    expect(auditSink.query({ outcome: 'success' }).length).toBe(1);
    expect(auditSink.query({ outcome: 'denied' }).length).toBe(1);
  });
});

describe('SecurityFoundation enforce', () => {
  it('returns the decision for approved operations', () => {
    const foundation = new SecurityFoundation();
    foundation.registry.register({
      id: 'policy-1',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'always-allowed',
    });

    const decision = foundation.enforce(makeRequest());

    expect(decision.permitted).toBe(true);
    expect(decision.status).toBe('approved');
  });

  it('throws denied for denied operations', () => {
    const foundation = new SecurityFoundation();

    try {
      foundation.enforce(makeRequest());
      expect.unreachable();
    } catch (error) {
      expect((error as SecurityError).code).toBe('denied');
      expect((error as SecurityError).message).toBe('operation not authorized');
    }
  });

  it('throws requires-confirmation for confirmation-required operations', () => {
    const foundation = new SecurityFoundation();
    foundation.registry.register({
      id: 'policy-1',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'confirmation-required',
    });

    try {
      foundation.enforce(makeRequest({ authContext: 'ctx-1' }));
      expect.unreachable();
    } catch (error) {
      expect((error as SecurityError).code).toBe('requires-confirmation');
    }
  });

  it('throws requires-elevated-authorization for restricted operations', () => {
    const foundation = new SecurityFoundation();
    foundation.registry.register({
      id: 'policy-1',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'restricted',
    });

    try {
      foundation.enforce(makeRequest({ authContext: 'ctx-1' }));
      expect.unreachable();
    } catch (error) {
      expect((error as SecurityError).code).toBe('requires-elevated-authorization');
    }
  });

  it('audits enforce failures', () => {
    const auditSink = new InMemoryAuditSink();
    const foundation = new SecurityFoundation({ auditSink });

    expect(() => foundation.enforce(makeRequest())).toThrow(SecurityError);
    expect(auditSink.query({ outcome: 'denied' }).length).toBe(1);
  });
});

describe('SecurityFoundation beta memory seeding', () => {
  it('seeds always-allowed beta memory policies for a caller', () => {
    const foundation = new SecurityFoundation();
    foundation.seedBetaMemoryPolicies('memory-engine');

    const policies = foundation.registry.enumerate();
    expect(policies.length).toBe(6);
    expect(policies.every((policy) => policy.category === 'always-allowed')).toBe(true);
    expect(policies.map((policy) => policy.action)).toEqual([
      'memory:create',
      'memory:read',
      'memory:update',
      'memory:archive',
      'memory:remove',
      'memory:query',
    ]);
  });

  it('seeds idempotently', () => {
    const foundation = new SecurityFoundation();
    foundation.seedBetaMemoryPolicies('memory-engine');
    foundation.seedBetaMemoryPolicies('memory-engine');

    expect(foundation.registry.enumerate().length).toBe(6);
  });
});
