import { describe, expect, it } from 'vitest';

import type { Memory } from '@rin/types';

import { InMemoryMemoryRepository } from './index.js';

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-1',
    title: 'Test memory',
    content: 'Some content',
    memoryType: 'long-term',
    importance: 3,
    tags: ['test'],
    source: 'unit-test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    ...overrides,
  };
}

describe('InMemoryMemoryRepository', () => {
  it('saves and retrieves a memory by id', () => {
    const repository = new InMemoryMemoryRepository();
    const memory = makeMemory();

    repository.save(memory);

    expect(repository.findById('mem-1')).toEqual(memory);
  });

  it('returns null when retrieving a missing memory', () => {
    const repository = new InMemoryMemoryRepository();

    expect(repository.findById('missing')).toBeNull();
  });

  it('filters by memoryType', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory({ id: 'a', memoryType: 'long-term' }));
    repository.save(makeMemory({ id: 'b', memoryType: 'short-term' }));

    const result = repository.find({ memoryType: 'short-term' });
    expect(result.map((memory) => memory.id)).toEqual(['b']);
  });

  it('filters by source', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory({ id: 'a', source: 'conversation' }));
    repository.save(makeMemory({ id: 'b', source: 'settings' }));

    const result = repository.find({ source: 'settings' });
    expect(result.map((memory) => memory.id)).toEqual(['b']);
  });

  it('filters by tags requiring every provided tag', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory({ id: 'a', tags: ['project', 'planning'] }));
    repository.save(makeMemory({ id: 'b', tags: ['project'] }));

    const result = repository.find({ tags: ['project', 'planning'] });
    expect(result.map((memory) => memory.id)).toEqual(['a']);
  });

  it('filters by keyword with all terms and case-insensitive substring matching', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory({ id: 'a', title: 'Alpha plan', content: 'first draft content' }));
    repository.save(makeMemory({ id: 'b', title: 'Beta report', content: 'second draft' }));

    expect(repository.find({ keyword: 'DRAFT' }).map((memory) => memory.id)).toEqual(['a', 'b']);
    expect(repository.find({ keyword: 'alpha draft' }).map((memory) => memory.id)).toEqual(['a']);
    expect(repository.find({ keyword: 'alpha report' }).map((memory) => memory.id)).toEqual([]);
  });

  it('filters by time windows', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }));
    repository.save(makeMemory({ id: 'b', createdAt: '2026-06-01T00:00:00.000Z' }));

    const result = repository.find({
      createdAfter: '2026-02-01T00:00:00.000Z',
      createdBefore: '2026-07-01T00:00:00.000Z',
    });
    expect(result.map((memory) => memory.id)).toEqual(['b']);
  });

  it('excludes archived memories from find results', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory({ id: 'a' }));
    repository.save(makeMemory({ id: 'b', archivedAt: '2026-02-01T00:00:00.000Z' }));

    const result = repository.find({});
    expect(result.map((memory) => memory.id)).toEqual(['a']);
  });

  it('detects duplicates by normalized title, content, and source', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory({ id: 'a', title: '  Same Title ', content: 'Same content' }));

    const duplicate = repository.findDuplicate(
      makeMemory({ id: 'b', title: 'same title', content: 'SAME CONTENT' }),
    );
    expect(duplicate?.id).toBe('a');

    const distinct = repository.findDuplicate(
      makeMemory({ id: 'b', title: 'Other title', content: 'Same content' }),
    );
    expect(distinct).toBeNull();
  });

  it('detects duplicates across archived memories', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory({ id: 'a', archivedAt: '2026-02-01T00:00:00.000Z' }));

    const duplicate = repository.findDuplicate(makeMemory({ id: 'b' }));
    expect(duplicate?.id).toBe('a');
  });

  it('archives a memory and returns the archived copy', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory());

    const archived = repository.archive('mem-1', '2026-02-01T00:00:00.000Z');

    expect(archived?.archivedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(repository.findById('mem-1')?.archivedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('returns null when archiving or removing a missing memory', () => {
    const repository = new InMemoryMemoryRepository();

    expect(repository.archive('missing', '2026-02-01T00:00:00.000Z')).toBeNull();
    expect(repository.remove('missing')).toBeNull();
  });

  it('removes a memory permanently', () => {
    const repository = new InMemoryMemoryRepository();
    repository.save(makeMemory());

    const removed = repository.remove('mem-1');

    expect(removed?.id).toBe('mem-1');
    expect(repository.findById('mem-1')).toBeNull();
  });
});
