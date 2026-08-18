import type { Conversation, CoreApiError, CoreApiStatus, Memory } from './index.js';

export interface RouterRequest {
  requestId: string;
  timestamp: string;
  callingComponent: string;
  authContext?: string;
  input: unknown;
  traceId?: string;
}

export interface RouterResponse {
  status: CoreApiStatus;
  result: unknown;
  error: CoreApiError | null;
  executionTimeMs: number;
  version: string;
  traceId: string;
}

export type RouterError = CoreApiError;

export interface RouterContext {
  conversation: Conversation | null;
  longTermMemory: Memory[];
  shortTermMemory: Memory[];
  currentProject: unknown;
  runtimeStatus: unknown;
}

export interface RouterRequestClassifier {
  classify(request: RouterRequest): unknown;
}

export interface MemoryRelevanceEvaluator {
  isRelevant(context: RouterContext): boolean;
}

export interface ReasoningStrategySelector {
  select(context: RouterContext): unknown;
}

export interface AgentCoordinator {
  assign(context: RouterContext): unknown;
}

export interface AIRouter {
  route(request: RouterRequest): Promise<RouterResponse>;
}
