import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  type AgentCoordinator,
  type AIRouter,
  type AuditOutcome,
  type AuditSink,
  type MemoryEngine,
  type MemoryRelevanceEvaluator,
  type MemoryRequestContext,
  type PermissionEvaluator,
  type PermissionRequest,
  type ReasoningStrategySelector,
  type RouterContext,
  type RouterRequest,
  type RouterRequestClassifier,
  type RouterResponse,
} from '@rin/types';

const ROUTER_CALLER = 'ai-router';
const COORDINATE_EXECUTION_ACTION = 'router:coordinate-execution';
const COORDINATION_RESOURCE = 'router';
const GENERIC_ERROR_CODE = 'internal-error';

export interface AIRouterOptions {
  memoryEngine?: MemoryEngine;
  permissionEvaluator?: PermissionEvaluator;
  auditSink?: AuditSink;
  classifier?: RouterRequestClassifier;
  relevanceEvaluator?: MemoryRelevanceEvaluator;
  strategySelector?: ReasoningStrategySelector;
  agentCoordinator?: AgentCoordinator;
}

export class DefaultAIRouter implements AIRouter {
  private readonly memoryEngine: MemoryEngine | undefined;
  private readonly permissionEvaluator: PermissionEvaluator | undefined;
  private readonly auditSink: AuditSink | undefined;
  private readonly classifier: RouterRequestClassifier | undefined;
  private readonly relevanceEvaluator: MemoryRelevanceEvaluator | undefined;
  private readonly strategySelector: ReasoningStrategySelector | undefined;
  private readonly agentCoordinator: AgentCoordinator | undefined;

  constructor(options: AIRouterOptions = {}) {
    this.memoryEngine = options.memoryEngine;
    this.permissionEvaluator = options.permissionEvaluator;
    this.auditSink = options.auditSink;
    this.classifier = options.classifier;
    this.relevanceEvaluator = options.relevanceEvaluator;
    this.strategySelector = options.strategySelector;
    this.agentCoordinator = options.agentCoordinator;
  }

  async route(request: RouterRequest): Promise<RouterResponse> {
    const traceId = request.traceId === undefined ? randomUUID() : request.traceId;
    const startedAt = Date.now();
    const fail = (message: string, outcome: AuditOutcome): RouterResponse => {
      this.audit(traceId, outcome);
      return {
        status: 'error',
        result: null,
        error: { code: GENERIC_ERROR_CODE, message, traceId },
        executionTimeMs: Date.now() - startedAt,
        version: API_VERSION,
        traceId,
      };
    };
    try {
      if (!isValidRequest(request)) {
        return fail('invalid router request', 'error');
      }
      const context = this.buildContext();
      if (this.classifier === undefined) {
        return fail('request classification unavailable', 'error');
      }
      const classification = this.classifier.classify(request);
      if (classification === undefined) {
        return fail('request classification failed', 'error');
      }
      if (this.relevanceEvaluator !== undefined && this.memoryEngine !== undefined) {
        if (this.relevanceEvaluator.isRelevant(context)) {
          const longTerm = await this.memoryEngine.queryContext(
            { kind: 'long-term' },
            this.buildMemoryContext(request, traceId),
          );
          if (longTerm.status !== 'success' || longTerm.result === null) {
            return fail('memory retrieval failed', 'error');
          }
          context.longTermMemory = longTerm.result;
          const shortTerm = await this.memoryEngine.queryContext(
            { kind: 'session' },
            this.buildMemoryContext(request, traceId),
          );
          if (shortTerm.status !== 'success' || shortTerm.result === null) {
            return fail('memory retrieval failed', 'error');
          }
          context.shortTermMemory = shortTerm.result;
        }
      }
      if (this.strategySelector !== undefined) {
        this.strategySelector.select(context);
      }
      if (this.agentCoordinator !== undefined) {
        this.agentCoordinator.assign(context);
      }
      if (this.permissionEvaluator === undefined) {
        return fail('coordination permission denied', 'denied');
      }
      const decision = this.permissionEvaluator.evaluate(
        this.buildPermissionRequest(request, traceId),
      );
      if (!decision.permitted) {
        return fail('coordination permission denied', 'denied');
      }
      this.audit(traceId, 'success');
      return {
        status: 'success',
        result: null,
        error: null,
        executionTimeMs: Date.now() - startedAt,
        version: API_VERSION,
        traceId,
      };
    } catch {
      return fail('unexpected router failure', 'error');
    }
  }

  private buildContext(): RouterContext {
    return {
      conversation: null,
      longTermMemory: [],
      shortTermMemory: [],
      currentProject: undefined,
      runtimeStatus: undefined,
    };
  }

  private buildMemoryContext(request: RouterRequest, traceId: string): MemoryRequestContext {
    const context: MemoryRequestContext = {
      requestId: traceId,
      callingComponent: ROUTER_CALLER,
    };
    if (request.authContext !== undefined) {
      context.authContext = request.authContext;
    }
    return context;
  }

  private buildPermissionRequest(request: RouterRequest, traceId: string): PermissionRequest {
    const permission: PermissionRequest = {
      action: COORDINATE_EXECUTION_ACTION,
      resource: COORDINATION_RESOURCE,
      caller: ROUTER_CALLER,
      requestId: traceId,
      timestamp: request.timestamp,
    };
    if (request.authContext !== undefined) {
      permission.authContext = request.authContext;
    }
    return permission;
  }

  private audit(traceId: string, outcome: AuditOutcome): void {
    if (this.auditSink === undefined) {
      return;
    }
    this.auditSink.append({
      id: randomUUID(),
      actor: ROUTER_CALLER,
      action: COORDINATE_EXECUTION_ACTION,
      resource: COORDINATION_RESOURCE,
      timestamp: new Date().toISOString(),
      outcome,
      metadata: {},
      requestId: traceId,
    });
  }
}

function isValidRequest(request: RouterRequest): boolean {
  return (
    request.requestId.trim() !== '' &&
    request.timestamp.trim() !== '' &&
    request.callingComponent.trim() !== ''
  );
}
