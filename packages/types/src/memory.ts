import type { Memory, MemoryType } from './index.js';

export type MemoryApiStatus = 'success' | 'error';

export interface MemoryApiError {
  code: string;
  message: string;
  traceId: string;
}

export interface MemoryApiResponse<T> {
  status: MemoryApiStatus;
  result: T | null;
  error: MemoryApiError | null;
  executionTimeMs: number;
  version: string;
}

export interface MemoryRequestContext {
  requestId?: string;
  callingComponent?: string;
  authContext?: string;
}

export interface CreateMemoryInput {
  title: string;
  content: string;
  source: string;
  tags?: string[];
  memoryType?: MemoryType;
  importance?: number;
  relatedTo?: string[];
}

export interface UpdateMemoryInput {
  title?: string;
  content?: string;
  tags?: string[];
  importance?: number;
  relatedTo?: string[];
}

export interface MemoryQuery {
  memoryType?: MemoryType;
  source?: string;
  tags?: string[];
  keyword?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface MemoryContextQuery {
  kind: 'active' | 'conversation' | 'session' | 'long-term';
  source?: string;
  memoryType?: MemoryType;
  createdAfter?: string;
  createdBefore?: string;
}

export interface MemoryVersion {
  memoryId: string;
  version: number;
  title: string;
  content: string;
  importance: number;
  tags: string[];
  updatedAt: string;
}

export interface MemoryClassificationInput {
  title: string;
  content: string;
  source: string;
  tags: string[];
}

export interface MemoryClassificationResult {
  memoryType: MemoryType;
  importance: number;
}

export interface MemoryClassifier {
  classify(input: MemoryClassificationInput): MemoryClassificationResult;
}

export type MemoryValidationCode =
  | 'invalid-title'
  | 'invalid-content'
  | 'invalid-source'
  | 'invalid-tags'
  | 'invalid-importance'
  | 'invalid-memory-type'
  | 'empty-update'
  | 'duplicate'
  | 'invalid-relationship'
  | 'policy-violation';

export interface MemoryValidationError {
  code: MemoryValidationCode;
  field: string | null;
  message: string;
}

export interface MemoryValidationResult {
  valid: boolean;
  errors: MemoryValidationError[];
}

export interface MemoryRepository {
  save(memory: Memory): void;
  findById(id: string): Memory | null;
  find(query: MemoryQuery): Memory[];
  findDuplicate(memory: Memory): Memory | null;
  archive(id: string, archivedAt: string): Memory | null;
  remove(id: string): Memory | null;
}

export type MemoryAction = 'create' | 'read' | 'update' | 'archive' | 'remove' | 'list';

export interface MemoryAccessRequest {
  action: MemoryAction;
  memoryId?: string;
  authContext?: string;
}

export interface MemoryAuthorizationHook {
  authorize(request: MemoryAccessRequest): boolean;
}

export interface MemoryAuditEntry {
  action: MemoryAction;
  memoryId: string | null;
  actor: string;
  outcome: 'success' | 'denied' | 'error';
  errorCode?: string;
  timestamp: string;
  requestId?: string;
}

export interface MemoryAuditor {
  record(entry: MemoryAuditEntry): void | Promise<void>;
}

export interface MemoryPolicyHook {
  verify(memory: Memory): MemoryValidationResult;
}

export interface MemoryIdGenerator {
  nextId(): string;
}

export interface MemoryEngine {
  createMemory(
    input: CreateMemoryInput,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>>;
  getMemory(memoryId: string, context?: MemoryRequestContext): Promise<MemoryApiResponse<Memory>>;
  queryMemories(
    query: MemoryQuery,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory[]>>;
  queryContext(
    query: MemoryContextQuery,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory[]>>;
  getRelatedMemories(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory[]>>;
  updateMemory(
    memoryId: string,
    input: UpdateMemoryInput,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>>;
  getVersionHistory(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<MemoryVersion[]>>;
  archiveMemory(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>>;
  removeMemory(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>>;
  validateMemory(
    input: CreateMemoryInput,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<MemoryValidationResult>>;
}
