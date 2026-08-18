import { describe, expect, it } from 'vitest';

import type { PermissionPolicy, PermissionRegistry, PermissionRequest } from '@rin/types';

import {
  DefaultPermissionEvaluator,
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

function makePolicy(overrides: Partial<PermissionPolicy> = {}): PermissionPolicy {
  return {
    id: 'policy-1',
    caller: 'memory-engine',
    action: 'memory:read',
    resource: '*',
    category: 'always-allowed',
    ...overrides,
  };
}

describe('DefaultPermissionEvaluator categories', () => {
  it('approves a matching always-allowed policy', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy());
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest());

    expect(decision.permitted).toBe(true);
    expect(decision.status).toBe('approved');
    expect(decision.category).toBe('always-allowed');
  });

  it('returns confirmation-required with an authContext present', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ category: 'confirmation-required' }));
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest({ authContext: 'ctx-1' }));

    expect(decision.permitted).toBe(false);
    expect(decision.status).toBe('confirmation-required');
    expect(decision.category).toBe('confirmation-required');
  });

  it('denies a confirmation-required operation when authContext is missing', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ category: 'confirmation-required' }));
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest());

    expect(decision.permitted).toBe(false);
    expect(decision.status).toBe('denied');
    expect(decision.category).toBe('denied');
  });

  it('returns restricted when an authContext is present', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ category: 'restricted' }));
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest({ authContext: 'ctx-1' }));

    expect(decision.permitted).toBe(false);
    expect(decision.status).toBe('restricted');
    expect(decision.category).toBe('restricted');
  });

  it('denies a restricted operation when authContext is missing', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ category: 'restricted' }));
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest());

    expect(decision.permitted).toBe(false);
    expect(decision.status).toBe('denied');
  });

  it('denies a denied-category policy', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ category: 'denied' }));
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest());

    expect(decision.permitted).toBe(false);
    expect(decision.status).toBe('denied');
    expect(decision.category).toBe('denied');
  });
});

describe('DefaultPermissionEvaluator fail-closed behavior', () => {
  it('denies when no policy matches', () => {
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());

    const decision = evaluator.evaluate(makeRequest());

    expect(decision.permitted).toBe(false);
    expect(decision.status).toBe('denied');
  });

  it('denies an unknown action', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ action: 'memory:update' }));
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest({ action: 'memory:read' }));

    expect(decision.permitted).toBe(false);
  });

  it('denies an unknown resource', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ resource: 'mem-1' }));
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest({ resource: 'mem-2' }));

    expect(decision.permitted).toBe(false);
  });

  it('denies an unknown caller', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy());
    const evaluator = new DefaultPermissionEvaluator(registry);

    const decision = evaluator.evaluate(makeRequest({ caller: 'unknown-component' }));

    expect(decision.permitted).toBe(false);
  });

  it('denies without exposing policy internals in the decision', () => {
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());

    const decision = evaluator.evaluate(makeRequest());

    expect(decision.reason).toBeUndefined();
    expect(decision).toEqual({
      action: 'memory:read',
      resource: 'mem-1',
      category: 'denied',
      permitted: false,
      status: 'denied',
    });
  });

  it('denies ambiguous multi-policy matches deterministically', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ id: 'policy-a' }));
    registry.register(makePolicy({ id: 'policy-b' }));
    const evaluator = new DefaultPermissionEvaluator(registry);

    expect(evaluator.evaluate(makeRequest()).permitted).toBe(false);
  });

  it('throws permission-unavailable when the registry fails', () => {
    const failingRegistry: PermissionRegistry = {
      register: () => {
        throw new Error('registry failure');
      },
      resolve: () => {
        throw new Error('registry failure');
      },
      remove: () => false,
      enumerate: () => [],
      validate: () => ({ valid: true, issues: [] }),
    };
    const evaluator = new DefaultPermissionEvaluator(failingRegistry);

    expect(() => evaluator.evaluate(makeRequest())).toThrow(SecurityError);
    try {
      evaluator.evaluate(makeRequest());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityError);
      expect((error as SecurityError).code).toBe('permission-unavailable');
    }
  });

  it('throws invalid-permission-request for malformed input', () => {
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());

    expect(() => evaluator.evaluate(makeRequest({ action: '  ' }))).toThrow(SecurityError);
    try {
      evaluator.evaluate(makeRequest({ action: '  ' }));
      expect.unreachable();
    } catch (error) {
      expect((error as SecurityError).code).toBe('invalid-permission-request');
    }
  });
});

describe('SecurityFoundation service availability', () => {
  it('throws permission-unavailable when the evaluator fails', () => {
    const evaluator = {
      evaluate: () => {
        throw new Error('evaluator failure');
      },
    };
    const foundation = new SecurityFoundation({ evaluator });

    expect(() => foundation.decide(makeRequest())).toThrow(SecurityError);
    try {
      foundation.decide(makeRequest());
      expect.unreachable();
    } catch (error) {
      expect((error as SecurityError).code).toBe('permission-unavailable');
    }
  });

  it('rethrows permission-unavailable from the evaluator', () => {
    const evaluator = {
      evaluate: () => {
        throw new SecurityError('permission-unavailable', 'permission evaluation failed');
      },
    };
    const foundation = new SecurityFoundation({ evaluator });

    try {
      foundation.decide(makeRequest());
      expect.unreachable();
    } catch (error) {
      expect((error as SecurityError).code).toBe('permission-unavailable');
    }
  });
});

describe('InMemoryPermissionRegistry', () => {
  it('resolves a registered policy', () => {
    const registry = new InMemoryPermissionRegistry();
    const policy = makePolicy();
    registry.register(policy);

    const resolved = registry.resolve(makeRequest());

    expect(resolved).toEqual(policy);
  });

  it('resolves a wildcard resource policy for a specific resource', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ resource: '*' }));

    expect(registry.resolve(makeRequest({ resource: 'mem-99' }))).not.toBeNull();
  });

  it('revokes immediately after remove', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy());

    expect(registry.remove('policy-1')).toBe(true);
    expect(registry.resolve(makeRequest())).toBeNull();
    expect(registry.remove('policy-1')).toBe(false);
  });

  it('enumerates registered policies as copies', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ id: 'policy-a' }));
    registry.register(makePolicy({ id: 'policy-b', action: 'memory:update' }));

    const policies = registry.enumerate();

    expect(policies.map((policy) => policy.id)).toEqual(['policy-a', 'policy-b']);
    const first = policies[0];
    if (first !== undefined) {
      first.category = 'denied';
    }
    expect(registry.enumerate()[0]?.category).toBe('always-allowed');
  });

  it('validates policy fields', () => {
    const registry = new InMemoryPermissionRegistry();

    expect(registry.validate(makePolicy()).valid).toBe(true);
    expect(registry.validate(makePolicy({ id: ' ' })).valid).toBe(false);
    expect(registry.validate(makePolicy({ caller: '' })).valid).toBe(false);
    expect(registry.validate(makePolicy({ action: '' })).valid).toBe(false);
    expect(registry.validate(makePolicy({ resource: '' })).valid).toBe(false);
    expect(registry.validate(makePolicy({ category: 'unsupported' as 'denied' })).valid).toBe(
      false,
    );
  });

  it('rejects registration of an invalid policy', () => {
    const registry = new InMemoryPermissionRegistry();

    try {
      registry.register(makePolicy({ id: '  ' }));
      expect.unreachable();
    } catch (error) {
      expect((error as SecurityError).code).toBe('invalid-permission-request');
    }
  });

  it('rejects duplicate policy ids', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy());

    try {
      registry.register(makePolicy());
      expect.unreachable();
    } catch (error) {
      expect((error as SecurityError).code).toBe('invalid-permission-request');
    }
  });
});

describe('SecurityError envelope', () => {
  it('carries a trace id and stable generic messages', () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register(makePolicy({ category: 'denied' }));
    const foundation = new SecurityFoundation({ registry });

    try {
      foundation.enforce(makeRequest());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityError);
      const securityError = error as SecurityError;
      expect(securityError.code).toBe('denied');
      expect(securityError.message).toBe('operation not authorized');
      expect(securityError.traceId.length).toBeGreaterThan(0);
      expect(securityError.info()).toEqual({
        code: 'denied',
        message: 'operation not authorized',
        traceId: securityError.traceId,
      });
    }
  });
});
