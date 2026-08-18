import { describe, expect, it, vi, type Mock } from 'vitest';

import {
  API_VERSION,
  type AgentCoordinator,
  type Memory,
  type MemoryApiResponse,
  type MemoryContextQuery,
  type MemoryEngine,
  type MemoryRelevanceEvaluator,
  type MemoryRequestContext,
  type PermissionDecision,
  type PermissionEvaluator,
  type PermissionRequest,
  type ReasoningStrategySelector,
  type RouterContext,
  type RouterRequest,
  type RouterRequestClassifier,
} from '@rin/types';
import { InMemoryAuditSink } from '@rin/security';
import { DefaultPermissionEvaluator, InMemoryPermissionRegistry } from '@rin/security';

import { DefaultAIRouter } from './ai-router.js';

const COORDINATE_ACTION = 'router:coordinate-execution';

function makeRequest(overrides: Partial<RouterRequest> = {}): RouterRequest {
  return {
    requestId: 'req-1',
    timestamp: '2026-08-18T00:00:00.000Z',
    callingComponent: 'voice',
    input: { text: 'hello' },
    ...overrides,
  };
}

function makeRouter(options: ConstructorParameters<typeof DefaultAIRouter>[0] = {}) {
  return new DefaultAIRouter(options);
}

interface SpiedClassifier extends RouterRequestClassifier {
  classify: Mock<(request: RouterRequest) => unknown>;
}

interface SpiedRelevanceEvaluator extends MemoryRelevanceEvaluator {
  isRelevant: Mock<(context: RouterContext) => boolean>;
}

interface SpiedStrategySelector extends ReasoningStrategySelector {
  select: Mock<(context: RouterContext) => unknown>;
}

interface SpiedAgentCoordinator extends AgentCoordinator {
  assign: Mock<(context: RouterContext) => unknown>;
}

interface SpiedPermissionEvaluator extends PermissionEvaluator {
  evaluate: Mock<(request: PermissionRequest) => PermissionDecision>;
}

interface SpiedMemoryEngine extends MemoryEngine {
  queryContext: Mock<
    (
      query: MemoryContextQuery,
      context?: MemoryRequestContext,
    ) => Promise<MemoryApiResponse<Memory[]>>
  >;
}

function makeOpaqueClassifier(): SpiedClassifier {
  return {
    classify: vi.fn<(request: RouterRequest) => unknown>(() => ({ intent: 'opaque' })),
  };
}

function makeRelevanceEvaluator(relevant = true): SpiedRelevanceEvaluator {
  return {
    isRelevant: vi.fn<(context: RouterContext) => boolean>(() => relevant),
  };
}

function makeStrategySelector(): SpiedStrategySelector {
  return {
    select: vi.fn<(context: RouterContext) => unknown>(() => ({ strategy: 'opaque' })),
  };
}

function makeAgentCoordinator(): SpiedAgentCoordinator {
  return {
    assign: vi.fn<(context: RouterContext) => unknown>(() => ({ assignment: 'opaque' })),
  };
}

const APPROVED_DECISION: PermissionDecision = {
  action: COORDINATE_ACTION,
  resource: 'router',
  category: 'always-allowed',
  permitted: true,
  status: 'approved',
};

function makePermissionEvaluator(
  decision: PermissionDecision = APPROVED_DECISION,
): SpiedPermissionEvaluator {
  return {
    evaluate: vi.fn<(request: PermissionRequest) => PermissionDecision>(() => decision),
  };
}

const EMPTY_MEMORY_RESULT: MemoryApiResponse<Memory[]> = {
  status: 'success',
  result: [],
  error: null,
  executionTimeMs: 1,
  version: API_VERSION,
};

function makeMemoryEngine(
  result: MemoryApiResponse<Memory[]> = EMPTY_MEMORY_RESULT,
): SpiedMemoryEngine {
  return {
    queryContext: vi.fn<
      (
        query: MemoryContextQuery,
        context?: MemoryRequestContext,
      ) => Promise<MemoryApiResponse<Memory[]>>
    >(() => Promise.resolve(result)),
  } as unknown as SpiedMemoryEngine;
}

function allowedPermissionRouter() {
  return {
    permissionEvaluator: makePermissionEvaluator(),
    classifier: makeOpaqueClassifier(),
  };
}

describe('DefaultAIRouter request intake', () => {
  it('routes a valid request through the pipeline to success', async () => {
    const router = makeRouter(allowedPermissionRouter());
    const response = await router.route(makeRequest());

    expect(response.status).toBe('success');
    expect(response.result).toBeNull();
    expect(response.error).toBeNull();
    expect(response.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(response.version).toBe(API_VERSION);
    expect(response.traceId.length).toBeGreaterThan(0);
  });

  it('rejects a request with an empty requestId', async () => {
    const response = await makeRouter(allowedPermissionRouter()).route(
      makeRequest({ requestId: '  ' }),
    );

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('internal-error');
    expect(response.error?.message).toBe('invalid router request');
  });

  it('rejects a request with an empty timestamp', async () => {
    const response = await makeRouter(allowedPermissionRouter()).route(
      makeRequest({ timestamp: '' }),
    );

    expect(response.status).toBe('error');
  });

  it('rejects a request with an empty callingComponent', async () => {
    const response = await makeRouter(allowedPermissionRouter()).route(
      makeRequest({ callingComponent: '' }),
    );

    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid router request');
  });
});

describe('DefaultAIRouter traceId handling', () => {
  it('generates a traceId when the request does not provide one', async () => {
    const response = await makeRouter(allowedPermissionRouter()).route(makeRequest());

    expect(response.traceId.length).toBeGreaterThan(0);
  });

  it('preserves the caller-provided traceId in the response', async () => {
    const response = await makeRouter(allowedPermissionRouter()).route(
      makeRequest({ traceId: 'trace-1' }),
    );

    expect(response.traceId).toBe('trace-1');
  });

  it('propagates the traceId to memory requests and audit entries', async () => {
    const auditSink = new InMemoryAuditSink();
    const memoryEngine = makeMemoryEngine();
    const router = makeRouter({
      ...allowedPermissionRouter(),
      auditSink,
      memoryEngine,
      relevanceEvaluator: makeRelevanceEvaluator(),
    });

    const response = await router.route(makeRequest({ traceId: 'trace-1' }));

    expect(response.traceId).toBe('trace-1');
    expect(memoryEngine.queryContext).toHaveBeenCalledTimes(2);
    expect(memoryEngine.queryContext).toHaveBeenCalledWith(
      { kind: 'long-term' },
      expect.objectContaining({ requestId: 'trace-1' }),
    );
    const entries = auditSink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.requestId).toBe('trace-1');
  });

  it('keeps the intake traceId in error responses', async () => {
    const response = await makeRouter({}).route(makeRequest({ traceId: 'trace-1', requestId: '' }));

    expect(response.traceId).toBe('trace-1');
    expect(response.error?.traceId).toBe('trace-1');
  });
});

describe('DefaultAIRouter pipeline ordering', () => {
  it('executes stages in the locked S1 to S8 order', async () => {
    const order: string[] = [];
    const classifier = makeOpaqueClassifier();
    classifier.classify.mockImplementation((request: RouterRequest) => {
      order.push('S3-classify');
      return { intent: request.requestId };
    });
    const relevanceEvaluator = makeRelevanceEvaluator();
    relevanceEvaluator.isRelevant.mockImplementation(() => {
      order.push('S4-relevance');
      return true;
    });
    const memoryEngine = makeMemoryEngine();
    memoryEngine.queryContext.mockImplementation(() => {
      order.push('S4-retrieve');
      return Promise.resolve(EMPTY_MEMORY_RESULT);
    });
    const strategySelector = makeStrategySelector();
    strategySelector.select.mockImplementation(() => {
      order.push('S5-strategy');
      return { strategy: 'opaque' };
    });
    const agentCoordinator = makeAgentCoordinator();
    agentCoordinator.assign.mockImplementation(() => {
      order.push('S6-agents');
      return { assignment: 'opaque' };
    });
    const permissionEvaluator = makePermissionEvaluator();
    permissionEvaluator.evaluate.mockImplementation(() => {
      order.push('S7-permission');
      return APPROVED_DECISION;
    });
    const router = makeRouter({
      classifier,
      relevanceEvaluator,
      memoryEngine,
      strategySelector,
      agentCoordinator,
      permissionEvaluator,
    });

    const response = await router.route(makeRequest({ traceId: 'trace-1' }));

    expect(response.status).toBe('success');
    expect(order).toEqual([
      'S3-classify',
      'S4-relevance',
      'S4-retrieve',
      'S4-retrieve',
      'S5-strategy',
      'S6-agents',
      'S7-permission',
    ]);
  });

  it('makes context available to the strategy and agent seams', async () => {
    const strategySelector = makeStrategySelector();
    const agentCoordinator = makeAgentCoordinator();
    const memory = {
      id: 'm-1',
      title: 't',
      content: 'c',
      memoryType: 'long-term' as const,
      importance: 1,
      tags: [],
      source: 's',
      createdAt: 'x',
      updatedAt: 'x',
      archivedAt: null,
    };
    const router = makeRouter({
      ...allowedPermissionRouter(),
      memoryEngine: makeMemoryEngine({
        status: 'success',
        result: [memory],
        error: null,
        executionTimeMs: 1,
        version: API_VERSION,
      }),
      relevanceEvaluator: makeRelevanceEvaluator(),
      strategySelector,
      agentCoordinator,
    });

    await router.route(makeRequest());

    const context = strategySelector.select.mock.calls[0]?.[0];
    expect(context).toBeDefined();
    expect(context?.conversation).toBeNull();
    expect(context?.longTermMemory).toEqual([memory]);
    expect(context?.shortTermMemory).toEqual([memory]);
    expect(agentCoordinator.assign).toHaveBeenCalledWith(context);
  });
});

describe('DefaultAIRouter classification seam', () => {
  it('invokes the classifier once with the request', async () => {
    const classifier = makeOpaqueClassifier();
    const request = makeRequest();
    const router = makeRouter({ ...allowedPermissionRouter(), classifier });

    await router.route(request);

    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(classifier.classify).toHaveBeenCalledWith(request);
  });

  it('accepts an opaque classification result', async () => {
    const classifier = makeOpaqueClassifier();
    const response = await makeRouter({
      ...allowedPermissionRouter(),
      classifier,
    }).route(makeRequest());

    expect(response.status).toBe('success');
  });

  it('fails closed when no classifier is configured', async () => {
    const relevanceEvaluator = makeRelevanceEvaluator();
    const strategySelector = makeStrategySelector();
    const agentCoordinator = makeAgentCoordinator();
    const permissionEvaluator = makePermissionEvaluator();
    const router = makeRouter({
      relevanceEvaluator,
      strategySelector,
      agentCoordinator,
      permissionEvaluator,
    });

    const response = await router.route(makeRequest({ traceId: 'trace-1' }));

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('internal-error');
    expect(response.error?.message).toBe('request classification unavailable');
    expect(relevanceEvaluator.isRelevant).not.toHaveBeenCalled();
    expect(strategySelector.select).not.toHaveBeenCalled();
    expect(agentCoordinator.assign).not.toHaveBeenCalled();
    expect(permissionEvaluator.evaluate).not.toHaveBeenCalled();
  });

  it('fails closed when classification produces no valid result', async () => {
    const classifier = makeOpaqueClassifier();
    classifier.classify.mockReturnValue(undefined);
    const permissionEvaluator = makePermissionEvaluator();
    const router = makeRouter({ classifier, permissionEvaluator });

    const response = await router.route(makeRequest());

    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('request classification failed');
    expect(permissionEvaluator.evaluate).not.toHaveBeenCalled();
  });
});

describe('DefaultAIRouter memory relevance', () => {
  it('evaluates relevance before retrieval', async () => {
    const order: string[] = [];
    const relevanceEvaluator = makeRelevanceEvaluator();
    relevanceEvaluator.isRelevant.mockImplementation(() => {
      order.push('relevance');
      return true;
    });
    const memoryEngine = makeMemoryEngine();
    memoryEngine.queryContext.mockImplementation(() => {
      order.push('retrieval');
      return Promise.resolve(EMPTY_MEMORY_RESULT);
    });
    const router = makeRouter({
      ...allowedPermissionRouter(),
      relevanceEvaluator,
      memoryEngine,
    });

    await router.route(makeRequest());

    expect(order).toEqual(['relevance', 'retrieval', 'retrieval']);
  });

  it('does not retrieve memory when no relevance evaluator is configured', async () => {
    const memoryEngine = makeMemoryEngine();
    const router = makeRouter({ ...allowedPermissionRouter(), memoryEngine });

    await router.route(makeRequest());

    expect(memoryEngine.queryContext).not.toHaveBeenCalled();
  });

  it('does not retrieve memory when relevance is not met', async () => {
    const memoryEngine = makeMemoryEngine();
    const router = makeRouter({
      ...allowedPermissionRouter(),
      memoryEngine,
      relevanceEvaluator: makeRelevanceEvaluator(false),
    });

    const response = await router.route(makeRequest());

    expect(response.status).toBe('success');
    expect(memoryEngine.queryContext).not.toHaveBeenCalled();
  });

  it('propagates a failed memory retrieval as an error', async () => {
    const memoryEngine = makeMemoryEngine({
      status: 'error',
      result: null,
      error: { code: 'internal-error', message: 'boom', traceId: 't' },
      executionTimeMs: 1,
      version: API_VERSION,
    });
    const router = makeRouter({
      ...allowedPermissionRouter(),
      memoryEngine,
      relevanceEvaluator: makeRelevanceEvaluator(),
    });

    const response = await router.route(makeRequest({ traceId: 'trace-1' }));

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('internal-error');
    expect(response.error?.message).toBe('memory retrieval failed');
    expect(response.error?.traceId).toBe('trace-1');
  });

  it('uses the locked long-term and session kinds for retrieval', async () => {
    const memoryEngine = makeMemoryEngine();
    const router = makeRouter({
      ...allowedPermissionRouter(),
      memoryEngine,
      relevanceEvaluator: makeRelevanceEvaluator(),
    });

    await router.route(makeRequest());

    expect(memoryEngine.queryContext).toHaveBeenNthCalledWith(
      1,
      { kind: 'long-term' },
      expect.any(Object),
    );
    expect(memoryEngine.queryContext).toHaveBeenNthCalledWith(
      2,
      { kind: 'session' },
      expect.any(Object),
    );
  });
});

describe('DefaultAIRouter reasoning strategy seam', () => {
  it('invokes the strategy selector with the context when configured', async () => {
    const strategySelector = makeStrategySelector();
    const router = makeRouter({ ...allowedPermissionRouter(), strategySelector });

    const response = await router.route(makeRequest());

    expect(response.status).toBe('success');
    expect(strategySelector.select).toHaveBeenCalledTimes(1);
  });

  it('keeps the strategy result opaque', async () => {
    const strategySelector = makeStrategySelector();
    strategySelector.select.mockReturnValue({ opaque: true });
    const response = await makeRouter({
      ...allowedPermissionRouter(),
      strategySelector,
    }).route(makeRequest());

    expect(response.status).toBe('success');
  });

  it('completes with deferred no-selection behavior when no selector is configured', async () => {
    const response = await makeRouter(allowedPermissionRouter()).route(makeRequest());

    expect(response.status).toBe('success');
  });
});

describe('DefaultAIRouter permission integration', () => {
  it('invokes the permission evaluator before coordination completes', async () => {
    const permissionEvaluator = makePermissionEvaluator();
    const router = makeRouter({
      classifier: makeOpaqueClassifier(),
      permissionEvaluator,
    });

    const response = await router.route(
      makeRequest({ traceId: 'trace-1', authContext: 'owner-token' }),
    );

    expect(response.status).toBe('success');
    expect(permissionEvaluator.evaluate).toHaveBeenCalledTimes(1);
    const permissionRequest = permissionEvaluator.evaluate.mock.calls[0]?.[0];
    expect(permissionRequest?.action).toBe(COORDINATE_ACTION);
    expect(permissionRequest?.resource).toBe('router');
    expect(permissionRequest?.caller).toBe('ai-router');
    expect(permissionRequest?.requestId).toBe('trace-1');
    expect(permissionRequest?.timestamp).toBe('2026-08-18T00:00:00.000Z');
    expect(permissionRequest?.authContext).toBe('owner-token');
  });

  it('fails closed when no permission evaluator is configured', async () => {
    const response = await makeRouter({ classifier: makeOpaqueClassifier() }).route(
      makeRequest({ traceId: 'trace-1' }),
    );

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('internal-error');
    expect(response.error?.message).toBe('coordination permission denied');
    expect(response.error?.traceId).toBe('trace-1');
  });

  it('fails closed when no policy matches the request', async () => {
    const registry = new InMemoryPermissionRegistry();
    const router = makeRouter({
      classifier: makeOpaqueClassifier(),
      permissionEvaluator: new DefaultPermissionEvaluator(registry),
    });

    const response = await router.route(makeRequest());

    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('coordination permission denied');
  });

  it('fails closed when permission is denied', async () => {
    const permissionEvaluator = makePermissionEvaluator({
      action: COORDINATE_ACTION,
      resource: 'router',
      category: 'denied',
      permitted: false,
      status: 'denied',
    });
    const response = await makeRouter({
      classifier: makeOpaqueClassifier(),
      permissionEvaluator,
    }).route(makeRequest());

    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('coordination permission denied');
  });

  it('fails closed when confirmation is required', async () => {
    const permissionEvaluator = makePermissionEvaluator({
      action: COORDINATE_ACTION,
      resource: 'router',
      category: 'confirmation-required',
      permitted: false,
      status: 'confirmation-required',
    });
    const response = await makeRouter({
      classifier: makeOpaqueClassifier(),
      permissionEvaluator,
    }).route(makeRequest());

    expect(response.status).toBe('error');
  });

  it('fails closed when execution is restricted', async () => {
    const permissionEvaluator = makePermissionEvaluator({
      action: COORDINATE_ACTION,
      resource: 'router',
      category: 'restricted',
      permitted: false,
      status: 'restricted',
    });
    const response = await makeRouter({
      classifier: makeOpaqueClassifier(),
      permissionEvaluator,
    }).route(makeRequest());

    expect(response.status).toBe('error');
  });

  it('fails closed when permission evaluation is unavailable', async () => {
    const permissionEvaluator = makePermissionEvaluator();
    permissionEvaluator.evaluate.mockImplementation(() => {
      throw new Error('evaluation backend unavailable');
    });
    const response = await makeRouter({
      classifier: makeOpaqueClassifier(),
      permissionEvaluator,
    }).route(makeRequest({ traceId: 'trace-1' }));

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('internal-error');
    expect(response.error?.traceId).toBe('trace-1');
  });

  it('succeeds when an always-allowed policy matches', async () => {
    const registry = new InMemoryPermissionRegistry();
    registry.register({
      id: 'router-coordinate',
      caller: 'ai-router',
      action: COORDINATE_ACTION,
      resource: 'router',
      category: 'always-allowed',
    });
    const router = makeRouter({
      classifier: makeOpaqueClassifier(),
      permissionEvaluator: new DefaultPermissionEvaluator(registry),
    });

    const response = await router.route(makeRequest());

    expect(response.status).toBe('success');
  });
});

describe('DefaultAIRouter error envelope', () => {
  it('always returns the generic error envelope with code, message, and traceId', async () => {
    const responses = [
      await makeRouter({}).route(makeRequest({ requestId: '' })),
      await makeRouter({ classifier: makeOpaqueClassifier() }).route(makeRequest()),
      await makeRouter({}).route(makeRequest()),
    ];

    for (const response of responses) {
      expect(response.status).toBe('error');
      expect(response.result).toBeNull();
      expect(response.error?.code).toBe('internal-error');
      expect(typeof response.error?.message).toBe('string');
      expect(response.error?.message.length).toBeGreaterThan(0);
      expect(typeof response.error?.traceId).toBe('string');
      expect(response.error?.traceId.length).toBeGreaterThan(0);
    }
  });

  it('keeps the intake traceId in every error response', async () => {
    const responses = [
      await makeRouter({}).route(makeRequest({ traceId: 'trace-1', requestId: '' })),
      await makeRouter({}).route(makeRequest({ traceId: 'trace-1' })),
    ];

    for (const response of responses) {
      expect(response.traceId).toBe('trace-1');
      expect(response.error?.traceId).toBe('trace-1');
    }
  });

  it('reports classification failures with the intake traceId', async () => {
    const classifier = makeOpaqueClassifier();
    classifier.classify.mockImplementation(() => {
      throw new Error('classifier failure');
    });
    const response = await makeRouter({ classifier }).route(makeRequest({ traceId: 'trace-1' }));

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('internal-error');
    expect(response.error?.message).toBe('unexpected router failure');
    expect(response.error?.traceId).toBe('trace-1');
  });
});

describe('DefaultAIRouter audit traceability', () => {
  it('records a single content-free audit entry on success', async () => {
    const auditSink = new InMemoryAuditSink();
    const router = makeRouter({ ...allowedPermissionRouter(), auditSink });

    const response = await router.route(makeRequest({ traceId: 'trace-1' }));

    expect(response.status).toBe('success');
    const entries = auditSink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actor).toBe('ai-router');
    expect(entries[0]?.action).toBe(COORDINATE_ACTION);
    expect(entries[0]?.resource).toBe('router');
    expect(entries[0]?.outcome).toBe('success');
    expect(entries[0]?.requestId).toBe('trace-1');
    expect(entries[0]?.metadata).toEqual({});
    expect(entries[0]?.id.length).toBeGreaterThan(0);
  });

  it('records a denied outcome when coordination is denied', async () => {
    const auditSink = new InMemoryAuditSink();
    const router = makeRouter({
      classifier: makeOpaqueClassifier(),
      auditSink,
    });

    const response = await router.route(makeRequest({ traceId: 'trace-1' }));

    expect(response.status).toBe('error');
    expect(auditSink.query({})[0]?.outcome).toBe('denied');
    expect(auditSink.query({})[0]?.requestId).toBe('trace-1');
  });

  it('records an error outcome when classification fails closed', async () => {
    const auditSink = new InMemoryAuditSink();
    const router = makeRouter({ auditSink });

    const response = await router.route(makeRequest({ traceId: 'trace-1' }));

    expect(response.status).toBe('error');
    expect(auditSink.query({})[0]?.outcome).toBe('error');
    expect(auditSink.query({})[0]?.requestId).toBe('trace-1');
  });

  it('queries audit entries by request identity', async () => {
    const auditSink = new InMemoryAuditSink();
    const router = makeRouter({ ...allowedPermissionRouter(), auditSink });

    await router.route(makeRequest({ traceId: 'trace-1' }));
    await router.route(makeRequest({ traceId: 'trace-2' }));

    expect(auditSink.query({ requestId: 'trace-1' })).toHaveLength(1);
    expect(auditSink.query({ requestId: 'trace-2' })).toHaveLength(1);
    expect(auditSink.query({})).toHaveLength(2);
  });
});

describe('DefaultAIRouter agent placeholder', () => {
  it('invokes the agent coordinator with the context when configured', async () => {
    const agentCoordinator = makeAgentCoordinator();
    const router = makeRouter({ ...allowedPermissionRouter(), agentCoordinator });

    const response = await router.route(makeRequest());

    expect(response.status).toBe('success');
    expect(agentCoordinator.assign).toHaveBeenCalledTimes(1);
  });

  it('completes with deferred no-assignment behavior when no coordinator is configured', async () => {
    const response = await makeRouter(allowedPermissionRouter()).route(makeRequest());

    expect(response.status).toBe('success');
  });
});

describe('DefaultAIRouter context container', () => {
  it('builds the locked five-member context with safe defaults', async () => {
    const strategySelector = makeStrategySelector();
    const router = makeRouter({
      ...allowedPermissionRouter(),
      strategySelector,
    });

    await router.route(makeRequest());

    const context = strategySelector.select.mock.calls[0]?.[0];
    expect(context?.conversation).toBeNull();
    expect(context?.longTermMemory).toEqual([]);
    expect(context?.shortTermMemory).toEqual([]);
    expect(context?.currentProject).toBeUndefined();
    expect(context?.runtimeStatus).toBeUndefined();
  });

  it('populates memory members only after approved relevance', async () => {
    const memory = {
      id: 'm-1',
      title: 't',
      content: 'c',
      memoryType: 'long-term' as const,
      importance: 1,
      tags: [],
      source: 's',
      createdAt: 'x',
      updatedAt: 'x',
      archivedAt: null,
    };
    const strategySelector = makeStrategySelector();
    const router = makeRouter({
      ...allowedPermissionRouter(),
      memoryEngine: makeMemoryEngine({
        status: 'success',
        result: [memory],
        error: null,
        executionTimeMs: 1,
        version: API_VERSION,
      }),
      relevanceEvaluator: makeRelevanceEvaluator(),
      strategySelector,
    });

    await router.route(makeRequest());

    const context = strategySelector.select.mock.calls[0]?.[0];
    expect(context?.longTermMemory).toEqual([memory]);
    expect(context?.shortTermMemory).toEqual([memory]);
  });
});

describe('DefaultAIRouter audit sink absence', () => {
  it('completes without an audit sink', async () => {
    const response = await makeRouter(allowedPermissionRouter()).route(makeRequest());

    expect(response.status).toBe('success');
  });
});

describe('DefaultAIRouter with real memory engine', () => {
  it('retrieves stored memories through the MemoryEngine contract', async () => {
    const { MemoryEngine } = await import('@rin/memory');
    const memoryEngine = new MemoryEngine();
    const created = await memoryEngine.createMemory({
      title: 'Router note',
      content: 'Stored for router context',
      source: 'router-test',
    });
    expect(created.status).toBe('success');

    const router = makeRouter({
      ...allowedPermissionRouter(),
      memoryEngine,
      relevanceEvaluator: makeRelevanceEvaluator(),
    });

    const response = await router.route(makeRequest());

    expect(response.status).toBe('success');
  });
});
