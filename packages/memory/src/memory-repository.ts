import type { Memory, MemoryQuery, MemoryRepository } from '@rin/types';

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly store = new Map<string, Memory>();

  save(memory: Memory): void {
    this.store.set(memory.id, memory);
  }

  findById(id: string): Memory | null {
    return this.store.get(id) ?? null;
  }

  find(query: MemoryQuery): Memory[] {
    const result: Memory[] = [];
    for (const memory of this.store.values()) {
      if (memory.archivedAt !== null) {
        continue;
      }
      if (query.memoryType !== undefined && memory.memoryType !== query.memoryType) {
        continue;
      }
      if (query.source !== undefined && memory.source !== query.source) {
        continue;
      }
      if (query.tags !== undefined && !hasAllTags(memory.tags, query.tags)) {
        continue;
      }
      if (query.keyword !== undefined && !matchesKeyword(memory, query.keyword)) {
        continue;
      }
      if (query.createdAfter !== undefined && isBefore(memory.createdAt, query.createdAfter)) {
        continue;
      }
      if (query.createdBefore !== undefined && isAfter(memory.createdAt, query.createdBefore)) {
        continue;
      }
      result.push(memory);
    }
    return result;
  }

  findDuplicate(memory: Memory): Memory | null {
    for (const stored of this.store.values()) {
      if (
        stored.title.trim().toLowerCase() === memory.title.trim().toLowerCase() &&
        stored.content.trim().toLowerCase() === memory.content.trim().toLowerCase() &&
        stored.source === memory.source
      ) {
        return stored;
      }
    }
    return null;
  }

  archive(id: string, archivedAt: string): Memory | null {
    const memory = this.store.get(id);
    if (memory === undefined) {
      return null;
    }
    const archived: Memory = { ...memory, archivedAt };
    this.store.set(id, archived);
    return archived;
  }

  remove(id: string): Memory | null {
    const memory = this.store.get(id);
    if (memory === undefined) {
      return null;
    }
    this.store.delete(id);
    return memory;
  }
}

function hasAllTags(stored: string[], required: string[]): boolean {
  return required.every((tag) => stored.includes(tag));
}

function matchesKeyword(memory: Memory, keyword: string): boolean {
  const terms = keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
  if (terms.length === 0) {
    return true;
  }
  const haystack = `${memory.title}\n${memory.content}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function isBefore(createdAt: string, bound: string): boolean {
  const created = Date.parse(createdAt);
  const boundary = Date.parse(bound);
  return Number.isNaN(created) || Number.isNaN(boundary) ? false : created <= boundary;
}

function isAfter(createdAt: string, bound: string): boolean {
  const created = Date.parse(createdAt);
  const boundary = Date.parse(bound);
  return Number.isNaN(created) || Number.isNaN(boundary) ? false : created >= boundary;
}
