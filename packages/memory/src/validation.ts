import type {
  CreateMemoryInput,
  Memory,
  MemoryPolicyHook,
  MemoryType,
  MemoryValidationCode,
  MemoryValidationError,
  MemoryValidationResult,
  UpdateMemoryInput,
} from '@rin/types';

export const IMPORTANCE_MIN = 1;
export const IMPORTANCE_MAX = 5;

const MEMORY_TYPES: readonly MemoryType[] = ['working', 'short-term', 'long-term'];

export class MemoryValidator {
  validateCreate(input: CreateMemoryInput): MemoryValidationResult {
    return this.validateFields(input.title, input.content, input.source, input.tags);
  }

  validateUpdate(input: UpdateMemoryInput): MemoryValidationResult {
    if (
      input.title === undefined &&
      input.content === undefined &&
      input.tags === undefined &&
      input.importance === undefined &&
      input.relatedTo === undefined
    ) {
      return invalid([{ code: 'empty-update', field: null, message: 'Update contains no fields' }]);
    }
    const errors: MemoryValidationError[] = [];
    if (input.title !== undefined) {
      errors.push(...validateTitle(input.title));
    }
    if (input.content !== undefined) {
      errors.push(...validateContent(input.content));
    }
    if (input.tags !== undefined) {
      errors.push(...validateTags(input.tags));
    }
    if (input.importance !== undefined) {
      errors.push(...validateImportance(input.importance));
    }
    if (input.relatedTo !== undefined) {
      errors.push(...validateRelatedTo(input.relatedTo));
    }
    return errors.length === 0 ? valid() : invalid(errors);
  }

  validateIntegrity(memory: Memory): MemoryValidationResult {
    const errors: MemoryValidationError[] = [];
    if (memory.id.trim().length === 0) {
      errors.push({ code: 'invalid-title', field: 'id', message: 'Memory id must not be empty' });
    }
    errors.push(...validateTitle(memory.title));
    errors.push(...validateContent(memory.content));
    errors.push(...validateSource(memory.source));
    errors.push(...validateTags(memory.tags));
    errors.push(...validateImportance(memory.importance));
    if (!MEMORY_TYPES.includes(memory.memoryType)) {
      errors.push({
        code: 'invalid-memory-type',
        field: 'memoryType',
        message: `Unsupported memory type: ${memory.memoryType}`,
      });
    }
    for (const timestamp of [memory.createdAt, memory.updatedAt]) {
      if (Number.isNaN(Date.parse(timestamp))) {
        errors.push({
          code: 'invalid-title',
          field: 'timestamps',
          message: 'Timestamps must be valid ISO date strings',
        });
        break;
      }
    }
    if (memory.archivedAt !== null && Number.isNaN(Date.parse(memory.archivedAt))) {
      errors.push({
        code: 'invalid-title',
        field: 'archivedAt',
        message: 'archivedAt must be a valid ISO date string or null',
      });
    }
    return errors.length === 0 ? valid() : invalid(errors);
  }

  validateRelationships(ids: string[], exists: (id: string) => boolean): MemoryValidationResult {
    const missing = ids.filter((id) => !exists(id));
    if (missing.length === 0) {
      return valid();
    }
    return invalid(
      missing.map((id) => ({
        code: 'invalid-relationship',
        field: 'relatedTo',
        message: `Related memory not found: ${id}`,
      })),
    );
  }

  verifyPolicy(memory: Memory, hook: MemoryPolicyHook | undefined): MemoryValidationResult {
    if (hook === undefined) {
      return valid();
    }
    return hook.verify(memory);
  }

  private validateFields(
    title: string,
    content: string,
    source: string,
    tags: string[] | undefined,
  ): MemoryValidationResult {
    const errors: MemoryValidationError[] = [];
    errors.push(...validateTitle(title));
    errors.push(...validateContent(content));
    errors.push(...validateSource(source));
    if (tags !== undefined) {
      errors.push(...validateTags(tags));
    }
    return errors.length === 0 ? valid() : invalid(errors);
  }
}

function validateTitle(title: string): MemoryValidationError[] {
  if (title.trim().length === 0) {
    return [{ code: 'invalid-title', field: 'title', message: 'Title must not be empty' }];
  }
  return [];
}

function validateContent(content: string): MemoryValidationError[] {
  if (content.trim().length === 0) {
    return [{ code: 'invalid-content', field: 'content', message: 'Content must not be empty' }];
  }
  return [];
}

function validateSource(source: string): MemoryValidationError[] {
  if (source.trim().length === 0) {
    return [{ code: 'invalid-source', field: 'source', message: 'Source must not be empty' }];
  }
  return [];
}

function validateTags(tags: string[]): MemoryValidationError[] {
  if (tags.some((tag) => tag.trim().length === 0)) {
    return [{ code: 'invalid-tags', field: 'tags', message: 'Tags must not be empty strings' }];
  }
  return [];
}

function validateImportance(importance: number): MemoryValidationError[] {
  if (!Number.isInteger(importance) || importance < IMPORTANCE_MIN || importance > IMPORTANCE_MAX) {
    return [
      {
        code: 'invalid-importance',
        field: 'importance',
        message: `Importance must be an integer between ${IMPORTANCE_MIN} and ${IMPORTANCE_MAX}`,
      },
    ];
  }
  return [];
}

function validateRelatedTo(relatedTo: string[]): MemoryValidationError[] {
  if (relatedTo.some((id) => id.trim().length === 0)) {
    return [
      {
        code: 'invalid-relationship',
        field: 'relatedTo',
        message: 'Related ids must not be empty',
      },
    ];
  }
  return [];
}

function valid(): MemoryValidationResult {
  return { valid: true, errors: [] };
}

function invalid(errors: MemoryValidationError[]): MemoryValidationResult {
  return { valid: false, errors };
}

export function firstErrorMessage(result: MemoryValidationResult): string {
  const first = result.errors[0];
  return first === undefined ? 'Validation failed' : first.message;
}

export function firstErrorCode(result: MemoryValidationResult): MemoryValidationCode {
  const first = result.errors[0];
  return first === undefined ? 'invalid-title' : first.code;
}
