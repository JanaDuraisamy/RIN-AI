import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  type CreateMemoryInput,
  type Memory,
  type MemoryAccessRequest,
  type MemoryAction,
  type MemoryApiResponse,
  type MemoryAuditEntry,
  type MemoryAuditor,
  type MemoryAuthorizationHook,
  type MemoryClassifier,
  type MemoryContextQuery,
  type MemoryEngine as MemoryEngineContract,
  type MemoryIdGenerator,
  type MemoryPolicyHook,
  type MemoryQuery,
  type MemoryRepository,
  type MemoryRequestContext,
  type MemoryValidationResult,
  type MemoryVersion,
  type UpdateMemoryInput,
} from '@rin/types';

import { DefaultMemoryClassifier } from './memory-classifier.js';
import { InMemoryMemoryRepository } from './memory-repository.js';
import { firstErrorCode, firstErrorMessage, MemoryValidator } from './validation.js';

export class MemoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
  }
}

export class DefaultMemoryIdGenerator implements MemoryIdGenerator {
  private counter = 0;

  nextId(): string {
    this.counter = (this.counter + 1) % 0xffff;
    return `${Date.now().toString(36)}-${this.counter.toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }
}

export interface MemoryEngineOptions {
  repository?: MemoryRepository;
  classifier?: MemoryClassifier;
  idGenerator?: MemoryIdGenerator;
  authorizationHook?: MemoryAuthorizationHook;
  auditor?: MemoryAuditor;
  policyHook?: MemoryPolicyHook;
}

export class MemoryEngine implements MemoryEngineContract {
  private readonly repository: MemoryRepository;
  private readonly classifier: MemoryClassifier;
  private readonly idGenerator: MemoryIdGenerator;
  private readonly validator = new MemoryValidator();
  private readonly authorizationHook: MemoryAuthorizationHook | undefined;
  private readonly auditor: MemoryAuditor | undefined;
  private readonly policyHook: MemoryPolicyHook | undefined;
  private readonly relationships = new Map<string, Set<string>>();
  private readonly versions = new Map<string, MemoryVersion[]>();

  constructor(options: MemoryEngineOptions = {}) {
    this.repository = options.repository ?? new InMemoryMemoryRepository();
    this.classifier = options.classifier ?? new DefaultMemoryClassifier();
    this.idGenerator = options.idGenerator ?? new DefaultMemoryIdGenerator();
    this.authorizationHook = options.authorizationHook;
    this.auditor = options.auditor;
    this.policyHook = options.policyHook;
  }

  async createMemory(
    input: CreateMemoryInput,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>> {
    return this.execute('create', undefined, context, () => {
      const structure = this.validator.validateCreate(input);
      if (!structure.valid) {
        throw new MemoryError(firstErrorCode(structure), firstErrorMessage(structure));
      }
      const classification = this.classifier.classify({
        title: input.title,
        content: input.content,
        source: input.source,
        tags: input.tags ?? [],
      });
      const memory: Memory = {
        id: this.idGenerator.nextId(),
        title: input.title.trim(),
        content: input.content,
        memoryType: input.memoryType ?? classification.memoryType,
        importance: input.importance ?? classification.importance,
        tags: input.tags ?? [],
        source: input.source,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
      };
      const integrity = this.validator.validateIntegrity(memory);
      if (!integrity.valid) {
        throw new MemoryError(firstErrorCode(integrity), firstErrorMessage(integrity));
      }
      const policy = this.validator.verifyPolicy(memory, this.policyHook);
      if (!policy.valid) {
        throw new MemoryError('policy-violation', firstErrorMessage(policy));
      }
      const duplicate = this.repository.findDuplicate(memory);
      if (duplicate !== null) {
        throw new MemoryError(
          'duplicate',
          'A memory with the same title, content, and source already exists',
        );
      }
      const relatedTo = input.relatedTo ?? [];
      this.assertRelationshipsExist(relatedTo);
      this.repository.save(memory);
      this.setRelationships(memory.id, relatedTo);
      this.versions.set(memory.id, [
        {
          memoryId: memory.id,
          version: 1,
          title: memory.title,
          content: memory.content,
          importance: memory.importance,
          tags: memory.tags,
          updatedAt: memory.updatedAt,
        },
      ]);
      return memory;
    });
  }

  async getMemory(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>> {
    return this.execute('read', memoryId, context, () => {
      const memory = this.repository.findById(memoryId);
      if (memory === null) {
        throw new MemoryError('not-found', 'Memory not found');
      }
      return memory;
    });
  }

  async queryMemories(
    query: MemoryQuery,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory[]>> {
    return this.execute('list', undefined, context, () => this.repository.find(query));
  }

  async queryContext(
    query: MemoryContextQuery,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory[]>> {
    return this.execute('list', undefined, context, () => {
      const memoryQuery: MemoryQuery = {};
      if (query.source !== undefined) {
        memoryQuery.source = query.source;
      }
      if (query.memoryType !== undefined) {
        memoryQuery.memoryType = query.memoryType;
      }
      if (query.createdAfter !== undefined) {
        memoryQuery.createdAfter = query.createdAfter;
      }
      if (query.createdBefore !== undefined) {
        memoryQuery.createdBefore = query.createdBefore;
      }
      return this.repository.find(memoryQuery);
    });
  }

  async getRelatedMemories(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory[]>> {
    return this.execute('read', memoryId, context, () => {
      const memory = this.repository.findById(memoryId);
      if (memory === null) {
        throw new MemoryError('not-found', 'Memory not found');
      }
      const relatedIds = this.relationships.get(memoryId) ?? new Set<string>();
      const result: Memory[] = [];
      for (const id of relatedIds) {
        const related = this.repository.findById(id);
        if (related !== null && related.archivedAt === null) {
          result.push(related);
        }
      }
      return result;
    });
  }

  async updateMemory(
    memoryId: string,
    input: UpdateMemoryInput,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>> {
    return this.execute('update', memoryId, context, () => {
      const current = this.repository.findById(memoryId);
      if (current === null) {
        throw new MemoryError('not-found', 'Memory not found');
      }
      const structure = this.validator.validateUpdate(input);
      if (!structure.valid) {
        throw new MemoryError(firstErrorCode(structure), firstErrorMessage(structure));
      }
      if (input.relatedTo !== undefined) {
        this.assertRelationshipsExist(input.relatedTo);
      }
      const updated: Memory = {
        ...current,
        title: input.title === undefined ? current.title : input.title.trim(),
        content: input.content ?? current.content,
        importance: input.importance ?? current.importance,
        tags: input.tags ?? current.tags,
        updatedAt: new Date().toISOString(),
      };
      if (input.title !== undefined || input.content !== undefined) {
        const duplicate = this.repository.findDuplicate(updated);
        if (duplicate !== null && duplicate.id !== memoryId) {
          throw new MemoryError(
            'duplicate',
            'A memory with the same title, content, and source already exists',
          );
        }
      }
      const integrity = this.validator.validateIntegrity(updated);
      if (!integrity.valid) {
        throw new MemoryError(firstErrorCode(integrity), firstErrorMessage(integrity));
      }
      const history = this.versions.get(memoryId) ?? [];
      history.push({
        memoryId,
        version: history.length + 1,
        title: updated.title,
        content: updated.content,
        importance: updated.importance,
        tags: updated.tags,
        updatedAt: updated.updatedAt,
      });
      this.versions.set(memoryId, history);
      this.repository.save(updated);
      if (input.relatedTo !== undefined) {
        this.setRelationships(memoryId, input.relatedTo);
      }
      return updated;
    });
  }

  async getVersionHistory(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<MemoryVersion[]>> {
    return this.execute('read', memoryId, context, () => {
      const memory = this.repository.findById(memoryId);
      if (memory === null) {
        throw new MemoryError('not-found', 'Memory not found');
      }
      return this.versions.get(memoryId) ?? [];
    });
  }

  async archiveMemory(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>> {
    return this.execute('archive', memoryId, context, () => {
      const current = this.repository.findById(memoryId);
      if (current === null) {
        throw new MemoryError('not-found', 'Memory not found');
      }
      if (current.archivedAt !== null) {
        throw new MemoryError('already-archived', 'Memory is already archived');
      }
      const archived = this.repository.archive(memoryId, new Date().toISOString());
      if (archived === null) {
        throw new MemoryError('not-found', 'Memory not found');
      }
      return archived;
    });
  }

  async removeMemory(
    memoryId: string,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<Memory>> {
    return this.execute('remove', memoryId, context, () => {
      const removed = this.repository.remove(memoryId);
      if (removed === null) {
        throw new MemoryError('not-found', 'Memory not found');
      }
      this.relationships.delete(memoryId);
      for (const [id, related] of this.relationships) {
        related.delete(memoryId);
        if (related.size === 0) {
          this.relationships.delete(id);
        }
      }
      this.versions.delete(memoryId);
      return removed;
    });
  }

  async validateMemory(
    input: CreateMemoryInput,
    context?: MemoryRequestContext,
  ): Promise<MemoryApiResponse<MemoryValidationResult>> {
    return this.execute('read', undefined, context, () => {
      const result = this.validator.validateCreate(input);
      if (!result.valid) {
        return result;
      }
      const classification = this.classifier.classify({
        title: input.title,
        content: input.content,
        source: input.source,
        tags: input.tags ?? [],
      });
      const candidate: Memory = {
        id: this.idGenerator.nextId(),
        title: input.title.trim(),
        content: input.content,
        memoryType: input.memoryType ?? classification.memoryType,
        importance: input.importance ?? classification.importance,
        tags: input.tags ?? [],
        source: input.source,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
      };
      const checks: MemoryValidationResult[] = [
        this.validator.validateIntegrity(candidate),
        this.validator.verifyPolicy(candidate, this.policyHook),
        this.validator.validateRelationships(
          input.relatedTo ?? [],
          (id) => this.repository.findById(id) !== null,
        ),
      ];
      if (this.repository.findDuplicate(candidate) !== null) {
        checks.push({
          valid: false,
          errors: [
            {
              code: 'duplicate',
              field: 'memory',
              message: 'A memory with the same title, content, and source already exists',
            },
          ],
        });
      }
      return mergeResults(checks);
    });
  }

  private async execute<T>(
    action: MemoryAction,
    memoryId: string | undefined,
    context: MemoryRequestContext | undefined,
    operation: () => T | Promise<T>,
  ): Promise<MemoryApiResponse<T>> {
    const traceId = randomUUID();
    const startedAt = Date.now();
    const actor = context?.authContext ?? 'memory-engine';
    const audit = (outcome: 'success' | 'denied' | 'error', errorCode?: string): void => {
      const entry: MemoryAuditEntry = {
        action,
        memoryId: memoryId ?? null,
        actor,
        outcome,
        timestamp: new Date().toISOString(),
      };
      if (errorCode !== undefined) {
        entry.errorCode = errorCode;
      }
      if (context?.requestId !== undefined) {
        entry.requestId = context.requestId;
      }
      void this.auditor?.record(entry);
    };
    try {
      if (
        this.authorizationHook !== undefined &&
        !this.authorizationHook.authorize(buildAccessRequest(action, memoryId, context))
      ) {
        audit('denied', 'unauthorized');
        return this.failure('unauthorized', 'Operation not authorized', traceId, startedAt);
      }
      const result = await operation();
      audit('success');
      return {
        status: 'success',
        result,
        error: null,
        executionTimeMs: Date.now() - startedAt,
        version: API_VERSION,
      };
    } catch (error) {
      const code = error instanceof MemoryError ? error.code : 'internal-error';
      const message =
        error instanceof MemoryError ? error.message : 'Unexpected memory engine failure';
      audit('error', code);
      return this.failure(code, message, traceId, startedAt);
    }
  }

  private failure(
    code: string,
    message: string,
    traceId: string,
    startedAt: number,
  ): MemoryApiResponse<never> {
    return {
      status: 'error',
      result: null,
      error: { code, message, traceId },
      executionTimeMs: Date.now() - startedAt,
      version: API_VERSION,
    };
  }

  private assertRelationshipsExist(relatedTo: string[]): void {
    const result = this.validator.validateRelationships(
      relatedTo,
      (id) => this.repository.findById(id) !== null,
    );
    if (!result.valid) {
      throw new MemoryError(firstErrorCode(result), firstErrorMessage(result));
    }
  }

  private setRelationships(memoryId: string, relatedTo: string[]): void {
    this.relationships.set(memoryId, new Set(relatedTo));
    for (const relatedId of relatedTo) {
      const incoming = this.relationships.get(relatedId) ?? new Set<string>();
      incoming.add(memoryId);
      this.relationships.set(relatedId, incoming);
    }
  }
}

function mergeResults(results: MemoryValidationResult[]): MemoryValidationResult {
  const errors = results.flatMap((result) => result.errors);
  return { valid: errors.length === 0, errors };
}

function buildAccessRequest(
  action: MemoryAction,
  memoryId: string | undefined,
  context: MemoryRequestContext | undefined,
): MemoryAccessRequest {
  const request: MemoryAccessRequest = { action };
  if (memoryId !== undefined) {
    request.memoryId = memoryId;
  }
  if (context?.authContext !== undefined) {
    request.authContext = context.authContext;
  }
  return request;
}
