import { describe, expect, it, vi } from 'vitest';

import {
  API_VERSION,
  type AgentCoordinator,
  type PermissionDecision,
  type PermissionEvaluator,
  type RouterContext,
  type RouterRequest,
} from '@rin/types';
import { DefaultAIRouter } from '@rin/ai-router';
import {
  DefaultPermissionEvaluator,
  InMemoryAuditSink,
  InMemoryPermissionRegistry,
} from '@rin/security';

import { AgentManager, type AgentManagerRequest, type AgentManagerResponse } from './index.js';

const AGENT_MANAGER_CALLER = 'agent-manager';
const COORDINATE_ACTION = 'agent-manager:coordinate';
const COORDINATION_RESOURCE = 'agent-manager';

const ROUTER_APPROVED_DECISION: PermissionDecision = {
  action: 'router:coordinate-execution',
  resource: 'router',
  category: 'always-allowed',
  permitted: true,
  status: 'approved',
};

function makeRequest(overrides: Partial<AgentManagerRequest> = {}): AgentManagerRequest {
  return {
    requestId: 'req-1',
    timestamp: '2026-08-18T00:00:00.000Z',
    callingComponent: 'ai-router',
    input: { text: 'hello' },
    ...overrides,
  };
}

function makeRegistry(
  category: 'always-allowed' | 'confirmation-required' | 'restricted' | 'denied',
): InMemoryPermissionRegistry {
  const registry = new InMemoryPermissionRegistry();
  registry.register({
    id: 'policy-1',
    caller: AGENT_MANAGER_CALLER,
    action: COORDINATE_ACTION,
    resource: COORDINATION_RESOURCE,
    category,
  });
  return registry;
}

function makeAllowedEvaluator(): PermissionEvaluator {
  return {
    evaluate: vi.fn<PermissionEvaluator['evaluate']>(() => ({
      action: COORDINATE_ACTION,
      resource: COORDINATION_RESOURCE,
      category: 'always-allowed',
      permitted: true,
      status: 'approved',
    })),
  };
}

function makeRouterContext(): RouterContext {
  return {
    conversation: null,
    longTermMemory: [],
    shortTermMemory: [],
    currentProject: undefined,
    runtimeStatus: undefined,
  };
}

function makeRouterRequest(overrides: Partial<RouterRequest> = {}): RouterRequest {
  return {
    requestId: 'route-1',
    timestamp: '2026-08-18T00:00:00.000Z',
    callingComponent: 'voice',
    input: { text: 'hello' },
    ...overrides,
  };
}

function makeRouter(manager: AgentManager): DefaultAIRouter {
  return new DefaultAIRouter({
    classifier: { classify: () => ({ intent: 'opaque' }) },
    permissionEvaluator: {
      evaluate: vi.fn<PermissionEvaluator['evaluate']>(() => ROUTER_APPROVED_DECISION),
    },
    agentCoordinator: manager,
  });
}

describe('AgentManager entry coordination', () => {
  it('returns a success envelope when the request is permitted', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed'));
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    expect(response.status).toBe('success');
    expect(response.result).toBeNull();
    expect(response.error).toBeNull();
    expect(response.executionTimeMs).toBeTypeOf('number');
    expect(response.version).toBe(API_VERSION);
    expect(response.traceId).toBe('trace-1');
  });

  it('generates a traceId when none is provided', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed'));
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest());
    expect(response.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('fails closed when no policy exists for the request', () => {
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    expect(response.status).toBe('error');
    expect(response.result).toBeNull();
    expect(response.error).toEqual({
      code: 'internal-error',
      message: 'coordination permission denied',
      traceId: 'trace-1',
    });
  });

  it('fails closed when the policy category is denied', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('denied'));
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('coordination permission denied');
  });

  it('fails closed when confirmation is required without authContext', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('confirmation-required'));
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('coordination permission denied');
  });

  it('does not execute when confirmation is required with authContext', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('confirmation-required'));
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest({ authContext: 'user-1', traceId: 'trace-1' }));
    expect(response.status).toBe('error');
    expect(response.result).toBeNull();
    expect(response.error?.message).toBe('coordination permission denied');
  });

  it('fails closed when restricted without authContext', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('restricted'));
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('coordination permission denied');
  });

  it('does not execute when restricted with authContext', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('restricted'));
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest({ authContext: 'user-1', traceId: 'trace-1' }));
    expect(response.status).toBe('error');
    expect(response.result).toBeNull();
    expect(response.error?.message).toBe('coordination permission denied');
  });

  it('fails closed when the evaluator throws', () => {
    const evaluator: PermissionEvaluator = {
      evaluate: vi.fn<PermissionEvaluator['evaluate']>(() => {
        throw new Error('boom');
      }),
    };
    const manager = new AgentManager({ permissionEvaluator: evaluator });
    const response = manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    expect(response.status).toBe('error');
    expect(response.error).toEqual({
      code: 'internal-error',
      message: 'unexpected agent manager failure',
      traceId: 'trace-1',
    });
  });

  it('rejects a request with an empty requestId', () => {
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>();
    const manager = new AgentManager({ permissionEvaluator: { evaluate } });
    const response = manager.coordinate(makeRequest({ requestId: '  ' }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid agent manager request');
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('rejects a request with an empty timestamp', () => {
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>();
    const manager = new AgentManager({ permissionEvaluator: { evaluate } });
    const response = manager.coordinate(makeRequest({ timestamp: '  ' }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid agent manager request');
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('rejects a request with an empty callingComponent', () => {
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>();
    const manager = new AgentManager({ permissionEvaluator: { evaluate } });
    const response = manager.coordinate(makeRequest({ callingComponent: '  ' }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid agent manager request');
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('forwards the ratified permission mapping including authContext', () => {
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>(() => ({
      action: COORDINATE_ACTION,
      resource: COORDINATION_RESOURCE,
      category: 'always-allowed',
      permitted: true,
      status: 'approved',
    }));
    const manager = new AgentManager({ permissionEvaluator: { evaluate } });
    manager.coordinate(makeRequest({ authContext: 'user-1', traceId: 'trace-1' }));
    expect(evaluate).toHaveBeenCalledWith({
      action: COORDINATE_ACTION,
      resource: COORDINATION_RESOURCE,
      caller: AGENT_MANAGER_CALLER,
      requestId: 'trace-1',
      timestamp: '2026-08-18T00:00:00.000Z',
      authContext: 'user-1',
    });
  });

  it('audits a success with the ratified mapping and a single entry', () => {
    const sink = new InMemoryAuditSink();
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed'));
    const manager = new AgentManager({ permissionEvaluator: evaluator, auditSink: sink });
    manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    const entries = sink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: AGENT_MANAGER_CALLER,
      action: COORDINATE_ACTION,
      resource: COORDINATION_RESOURCE,
      outcome: 'success',
      requestId: 'trace-1',
      metadata: {},
    });
  });

  it('audits a denial with outcome denied', () => {
    const sink = new InMemoryAuditSink();
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());
    const manager = new AgentManager({ permissionEvaluator: evaluator, auditSink: sink });
    manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    const entries = sink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('denied');
    expect(entries[0]?.requestId).toBe('trace-1');
  });

  it('audits a failure with outcome error', () => {
    const sink = new InMemoryAuditSink();
    const evaluator: PermissionEvaluator = {
      evaluate: vi.fn<PermissionEvaluator['evaluate']>(() => {
        throw new Error('boom');
      }),
    };
    const manager = new AgentManager({ permissionEvaluator: evaluator, auditSink: sink });
    manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    const entries = sink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('error');
  });

  it('keeps audit entries content-free', () => {
    const sink = new InMemoryAuditSink();
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed'));
    const manager = new AgentManager({ permissionEvaluator: evaluator, auditSink: sink });
    manager.coordinate(makeRequest({ input: { token: 'super-secret-value' } }));
    const entries = sink.query({});
    expect(JSON.stringify(entries)).not.toContain('super-secret-value');
    expect(entries[0]?.metadata).toEqual({});
  });

  it('tolerates a missing audit sink', () => {
    const manager = new AgentManager({ permissionEvaluator: makeAllowedEvaluator() });
    const response = manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    expect(response.status).toBe('success');
  });

  it('performs no downstream execution after an allowed request', () => {
    const sink = new InMemoryAuditSink();
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed'));
    const manager = new AgentManager({ permissionEvaluator: evaluator, auditSink: sink });
    const evaluateSpy = vi.spyOn(evaluator, 'evaluate');
    const response = manager.coordinate(makeRequest({ traceId: 'trace-1' }));
    expect(response.result).toBeNull();
    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(sink.query({})).toHaveLength(1);
  });
});

describe('AgentManager AI Router seam binding', () => {
  it('binds to the router-facing seam and receives the RouterContext unchanged', async () => {
    const manager = new AgentManager({ permissionEvaluator: makeAllowedEvaluator() });
    const assignSpy = vi.spyOn(manager, 'assign');
    const router = makeRouter(manager);
    const response = await router.route(makeRouterRequest());
    expect(response.status).toBe('success');
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: null,
        longTermMemory: [],
        shortTermMemory: [],
      }),
    );
  });

  it('returns the compatible deferred envelope from the seam', () => {
    const manager = new AgentManager({ permissionEvaluator: makeAllowedEvaluator() });
    const result = manager.assign(makeRouterContext()) as AgentManagerResponse;
    expect(result.status).toBe('success');
    expect(result.result).toBeNull();
    expect(result.error).toBeNull();
    expect(result.executionTimeMs).toBeTypeOf('number');
    expect(result.version).toBe(API_VERSION);
    expect(result.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('performs no permission evaluation or audit at the seam', () => {
    const sink = new InMemoryAuditSink();
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>();
    const manager = new AgentManager({ permissionEvaluator: { evaluate }, auditSink: sink });
    const result = manager.assign(makeRouterContext()) as AgentManagerResponse;
    expect(result.result).toBeNull();
    expect(evaluate).not.toHaveBeenCalled();
    expect(sink.query({})).toHaveLength(0);
  });

  it('satisfies the AgentCoordinator contract', () => {
    const manager = new AgentManager({ permissionEvaluator: makeAllowedEvaluator() });
    const coordinator: AgentCoordinator = manager;
    expect(typeof coordinator.assign).toBe('function');
  });
});
