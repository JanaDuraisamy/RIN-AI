import { describe, expect, it } from 'vitest';

import type { Memory, MemoryPolicyHook } from '@rin/types';

import { IMPORTANCE_MAX, IMPORTANCE_MIN, MemoryValidator } from './index.js';

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

describe('MemoryValidator', () => {
  const validator = new MemoryValidator();

  describe('validateCreate', () => {
    it('accepts a valid creation input', () => {
      const result = validator.validateCreate({
        title: 'Title',
        content: 'Content',
        source: 'source',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects an empty title', () => {
      const result = validator.validateCreate({
        title: '   ',
        content: 'Content',
        source: 'source',
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('invalid-title');
      expect(result.errors[0]?.field).toBe('title');
    });

    it('rejects an empty content', () => {
      const result = validator.validateCreate({
        title: 'Title',
        content: '',
        source: 'source',
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('invalid-content');
    });

    it('rejects an empty source', () => {
      const result = validator.validateCreate({
        title: 'Title',
        content: 'Content',
        source: ' ',
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('invalid-source');
    });

    it('rejects empty tags', () => {
      const result = validator.validateCreate({
        title: 'Title',
        content: 'Content',
        source: 'source',
        tags: ['ok', ' '],
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('invalid-tags');
    });

    it('collects multiple structural errors', () => {
      const result = validator.validateCreate({ title: '', content: '', source: '' });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('validateUpdate', () => {
    it('rejects an update with no fields', () => {
      const result = validator.validateUpdate({});

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('empty-update');
    });

    it('accepts a partial update', () => {
      expect(validator.validateUpdate({ title: 'New title' }).valid).toBe(true);
      expect(validator.validateUpdate({ importance: 5 }).valid).toBe(true);
      expect(validator.validateUpdate({ tags: ['a'] }).valid).toBe(true);
    });

    it('rejects invalid fields in an update', () => {
      const result = validator.validateUpdate({ content: '', importance: 0 });

      expect(result.valid).toBe(false);
      expect(result.errors.map((error) => error.code)).toContain('invalid-content');
      expect(result.errors.map((error) => error.code)).toContain('invalid-importance');
    });
  });

  describe('validateIntegrity', () => {
    it('accepts a well-formed stored memory', () => {
      expect(validator.validateIntegrity(makeMemory()).valid).toBe(true);
    });

    it('rejects an unsupported memory type', () => {
      const result = validator.validateIntegrity(
        makeMemory({ memoryType: 'episodic' as 'long-term' }),
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('invalid-memory-type');
    });

    it(`rejects importance outside ${IMPORTANCE_MIN}..${IMPORTANCE_MAX}`, () => {
      expect(validator.validateIntegrity(makeMemory({ importance: 0 })).valid).toBe(false);
      expect(validator.validateIntegrity(makeMemory({ importance: 6 })).valid).toBe(false);
      expect(validator.validateIntegrity(makeMemory({ importance: 2.5 })).valid).toBe(false);
    });

    it('rejects invalid timestamps', () => {
      expect(validator.validateIntegrity(makeMemory({ createdAt: 'not-a-date' })).valid).toBe(
        false,
      );
      expect(validator.validateIntegrity(makeMemory({ archivedAt: 'not-a-date' })).valid).toBe(
        false,
      );
    });
  });

  describe('validateRelationships', () => {
    it('accepts when every related memory exists', () => {
      const result = validator.validateRelationships(['a', 'b'], (id) => id !== 'c');

      expect(result.valid).toBe(true);
    });

    it('reports missing related memories', () => {
      const result = validator.validateRelationships(['a', 'missing'], (id) => id === 'a');

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('invalid-relationship');
      expect(result.errors[0]?.message).toContain('missing');
    });
  });

  describe('verifyPolicy', () => {
    it('passes without a policy hook', () => {
      expect(validator.verifyPolicy(makeMemory(), undefined).valid).toBe(true);
    });

    it('delegates to the provided policy hook', () => {
      const hook: MemoryPolicyHook = {
        verify: () => ({
          valid: false,
          errors: [{ code: 'policy-violation', field: 'memory', message: 'Blocked by policy' }],
        }),
      };

      const result = validator.verifyPolicy(makeMemory(), hook);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('policy-violation');
    });
  });
});
