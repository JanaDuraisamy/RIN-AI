import { describe, expect, it, vi } from 'vitest';

import type {
  MemoryAuditEntry,
  MemoryAuditor,
  MemoryAuthorizationHook,
  MemoryIdGenerator,
  MemoryPolicyHook,
  MemoryRepository,
} from '@rin/types';

import {
  DefaultMemoryClassifier,
  DefaultMemoryIdGenerator,
  InMemoryMemoryRepository,
  MemoryEngine,
} from './index.js';

function validInput(overrides: Partial<{ title: string; content: string; source: string }> = {}) {
  return {
    title: 'Engineering decision',
    content: 'The team approved the architecture lock.',
    source: 'conversation',
    ...overrides,
  };
}

function collectAuditor(): { auditor: MemoryAuditor; entries: MemoryAuditEntry[] } {
  const entries: MemoryAuditEntry[] = [];
  return {
    auditor: { record: (entry) => void entries.push(entry) },
    entries,
  };
}

describe('MemoryEngine', () => {
  it('creates a memory and returns a success envelope', async () => {
    const engine = new MemoryEngine();

    const response = await engine.createMemory(validInput());

    expect(response.status).toBe('success');
    expect(response.error).toBeNull();
    expect(response.version).toBe('0.1.0');
    expect(typeof response.executionTimeMs).toBe('number');
    expect(response.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(response.result).not.toBeNull();
    expect(response.result?.id).toMatch(/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
    expect(response.result?.archivedAt).toBeNull();
    expect(Date.parse(response.result?.createdAt ?? '')).not.toBeNaN();
  });

  it('applies explicit memoryType and importance over classifier defaults', async () => {
    const engine = new MemoryEngine();

    const response = await engine.createMemory(validInput({ title: 'Draft status' }));

    expect(response.result?.memoryType).toBe('short-term');

    const explicit = await engine.createMemory({
      ...validInput({ title: 'Another note' }),
      memoryType: 'long-term',
      importance: 4,
    });

    expect(explicit.result?.memoryType).toBe('long-term');
    expect(explicit.result?.importance).toBe(4);
  });

  it('classifies by default with the injected classifier heuristic', async () => {
    const engine = new MemoryEngine();

    const response = await engine.createMemory(validInput());

    expect(response.result?.memoryType).toBe('long-term');
    expect(response.result?.importance).toBe(5);
  });

  it('rejects structurally invalid input', async () => {
    const engine = new MemoryEngine();

    const response = await engine.createMemory(validInput({ title: '  ' }));

    expect(response.status).toBe('error');
    expect(response.result).toBeNull();
    expect(response.error?.code).toBe('invalid-title');
    expect(response.error?.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects duplicate memories with the same normalized title, content, and source', async () => {
    const engine = new MemoryEngine();
    await engine.createMemory(validInput());

    const duplicate = await engine.createMemory(validInput({ title: '  engineering DECISION ' }));

    expect(duplicate.status).toBe('error');
    expect(duplicate.error?.code).toBe('duplicate');
  });

  it('rejects creation when the policy hook blocks it', async () => {
    const policyHook: MemoryPolicyHook = {
      verify: () => ({
        valid: false,
        errors: [{ code: 'policy-violation', field: 'memory', message: 'Blocked by policy' }],
      }),
    };
    const engine = new MemoryEngine({ policyHook });

    const response = await engine.createMemory(validInput());

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('policy-violation');
  });

  it('rejects relationships to missing memories', async () => {
    const engine = new MemoryEngine();

    const response = await engine.createMemory({
      ...validInput(),
      relatedTo: ['missing-id'],
    });

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('invalid-relationship');
  });

  it('links related memories in both directions', async () => {
    const engine = new MemoryEngine();
    const first = await engine.createMemory(validInput({ title: 'First' }));
    const second = await engine.createMemory({
      ...validInput({ title: 'Second', content: 'Related content' }),
      relatedTo: [first.result?.id ?? ''],
    });

    expect(second.status).toBe('success');

    const relatedToFirst = await engine.getRelatedMemories(first.result?.id ?? '');
    expect(relatedToFirst.result?.map((memory) => memory.id)).toEqual([second.result?.id]);

    const relatedToSecond = await engine.getRelatedMemories(second.result?.id ?? '');
    expect(relatedToSecond.result?.map((memory) => memory.id)).toEqual([first.result?.id]);
  });

  it('retrieves a memory by identifier', async () => {
    const engine = new MemoryEngine();
    const created = await engine.createMemory(validInput());

    const response = await engine.getMemory(created.result?.id ?? '');

    expect(response.status).toBe('success');
    expect(response.result?.title).toBe('Engineering decision');
  });

  it('returns not-found for missing memories', async () => {
    const engine = new MemoryEngine();

    const response = await engine.getMemory('missing');

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('not-found');
  });

  it('retrieves archived memories by identifier', async () => {
    const engine = new MemoryEngine();
    const created = await engine.createMemory(validInput());
    await engine.archiveMemory(created.result?.id ?? '');

    const response = await engine.getMemory(created.result?.id ?? '');

    expect(response.status).toBe('success');
    expect(response.result?.archivedAt).not.toBeNull();
  });

  it('queries by category, source, tags, keyword, and time', async () => {
    const engine = new MemoryEngine();
    await engine.createMemory({
      title: 'Project plan',
      content: 'Q3 objectives and requirements',
      source: 'roadmap',
      tags: ['planning'],
    });
    await engine.createMemory({
      title: 'Draft notes',
      content: 'Current progress summary',
      source: 'conversation',
      tags: ['planning', 'wip'],
    });

    const byCategory = await engine.queryMemories({ memoryType: 'long-term' });
    expect(byCategory.result?.map((memory) => memory.title)).toEqual(['Project plan']);

    const bySource = await engine.queryMemories({ source: 'conversation' });
    expect(bySource.result?.map((memory) => memory.title)).toEqual(['Draft notes']);

    const byTags = await engine.queryMemories({ tags: ['planning', 'wip'] });
    expect(byTags.result?.map((memory) => memory.title)).toEqual(['Draft notes']);

    const byKeyword = await engine.queryMemories({ keyword: 'Q3 requirements' });
    expect(byKeyword.result?.map((memory) => memory.title)).toEqual(['Project plan']);

    const byTime = await engine.queryMemories({
      createdBefore: new Date(Date.now() + 1_000).toISOString(),
    });
    expect(byTime.result?.length).toBe(2);
  });

  it('excludes archived memories from queries', async () => {
    const engine = new MemoryEngine();
    const created = await engine.createMemory(validInput());
    await engine.archiveMemory(created.result?.id ?? '');

    const response = await engine.queryMemories({});

    expect(response.result).toEqual([]);
  });

  it('queries context with source, type, and time filters', async () => {
    const engine = new MemoryEngine();
    await engine.createMemory(validInput({ title: 'From conversation', source: 'conversation' }));
    await engine.createMemory(validInput({ title: 'From settings', source: 'settings' }));

    const response = await engine.queryContext({ kind: 'conversation', source: 'conversation' });

    expect(response.status).toBe('success');
    expect(response.result?.map((memory) => memory.title)).toEqual(['From conversation']);
  });

  it('updates content and metadata while preserving version history', async () => {
    const engine = new MemoryEngine();
    const created = await engine.createMemory(validInput());
    const id = created.result?.id ?? '';

    const updated = await engine.updateMemory(id, {
      content: 'Revised decision after review.',
      tags: ['revised'],
      importance: 4,
    });

    expect(updated.status).toBe('success');
    expect(updated.result?.content).toBe('Revised decision after review.');
    expect(updated.result?.tags).toEqual(['revised']);
    expect(updated.result?.importance).toBe(4);
    expect(Date.parse(updated.result?.updatedAt ?? '')).not.toBeNaN();

    const history = await engine.getVersionHistory(id);
    expect(history.result?.length).toBe(2);
    expect(history.result?.[0]?.version).toBe(1);
    expect(history.result?.[1]?.version).toBe(2);
    expect(history.result?.[1]?.content).toBe('Revised decision after review.');
  });

  it('trims titles on create and update', async () => {
    const engine = new MemoryEngine();
    const created = await engine.createMemory(validInput({ title: '  Padded title  ' }));

    expect(created.result?.title).toBe('Padded title');

    const updated = await engine.updateMemory(created.result?.id ?? '', {
      title: '  Padded again  ',
    });

    expect(updated.result?.title).toBe('Padded again');
  });

  it('rejects updates that would collide with another memory', async () => {
    const engine = new MemoryEngine();
    const first = await engine.createMemory(validInput({ title: 'First' }));
    await engine.createMemory({
      title: 'Second',
      content: 'The team approved the architecture lock.',
      source: 'conversation',
    });

    const response = await engine.updateMemory(first.result?.id ?? '', { title: 'Second' });

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('duplicate');
  });

  it('rejects updates with no fields and invalid values', async () => {
    const engine = new MemoryEngine();
    const created = await engine.createMemory(validInput());
    const id = created.result?.id ?? '';

    const empty = await engine.updateMemory(id, {});
    expect(empty.error?.code).toBe('empty-update');

    const invalid = await engine.updateMemory(id, { importance: 9 });
    expect(invalid.error?.code).toBe('invalid-importance');
  });

  it('returns not-found when updating a missing memory', async () => {
    const engine = new MemoryEngine();

    const response = await engine.updateMemory('missing', { title: 'X' });

    expect(response.error?.code).toBe('not-found');
  });

  it('archives a memory once and rejects repeated archiving', async () => {
    const engine = new MemoryEngine();
    const created = await engine.createMemory(validInput());
    const id = created.result?.id ?? '';

    const archived = await engine.archiveMemory(id);
    expect(archived.status).toBe('success');
    expect(archived.result?.archivedAt).not.toBeNull();

    const again = await engine.archiveMemory(id);
    expect(again.status).toBe('error');
    expect(again.error?.code).toBe('already-archived');
  });

  it('removes a memory permanently and cleans relationships and history', async () => {
    const engine = new MemoryEngine();
    const first = await engine.createMemory(validInput({ title: 'First' }));
    const second = await engine.createMemory({
      ...validInput({ title: 'Second', content: 'Related' }),
      relatedTo: [first.result?.id ?? ''],
    });

    const removed = await engine.removeMemory(first.result?.id ?? '');
    expect(removed.status).toBe('success');

    const missing = await engine.getMemory(first.result?.id ?? '');
    expect(missing.error?.code).toBe('not-found');

    const history = await engine.getVersionHistory(first.result?.id ?? '');
    expect(history.error?.code).toBe('not-found');

    const related = await engine.getRelatedMemories(second.result?.id ?? '');
    expect(related.result).toEqual([]);

    const missingAgain = await engine.removeMemory(first.result?.id ?? '');
    expect(missingAgain.error?.code).toBe('not-found');
  });

  it('denies operations when the authorization hook rejects them', async () => {
    const authorizationHook: MemoryAuthorizationHook = {
      authorize: ({ action, memoryId }) => action === 'create' && memoryId !== 'blocked-id',
    };
    const engine = new MemoryEngine({ authorizationHook });

    const created = await engine.createMemory(validInput());
    expect(created.status).toBe('success');

    const deniedRead = await engine.getMemory(created.result?.id ?? '');
    expect(deniedRead.status).toBe('error');
    expect(deniedRead.error?.code).toBe('unauthorized');

    const deniedArchive = await engine.archiveMemory('blocked-id');
    expect(deniedArchive.error?.code).toBe('unauthorized');
  });

  it('records audit entries for success, denial, and error outcomes without content', async () => {
    const { auditor, entries } = collectAuditor();
    const authorizationHook: MemoryAuthorizationHook = {
      authorize: () => false,
    };
    const engine = new MemoryEngine({ auditor, authorizationHook });

    const created = await engine.createMemory(validInput());
    void created;
    await engine.getMemory('missing');

    expect(entries.length).toBe(2);
    expect(entries[0]).toMatchObject({ action: 'create', outcome: 'denied' });
    expect(entries[1]).toMatchObject({ action: 'read', outcome: 'denied' });
    for (const entry of entries) {
      expect(JSON.stringify(entry)).not.toContain('content');
    }
  });

  it('records successful operations in the audit trail', async () => {
    const { auditor, entries } = collectAuditor();
    const engine = new MemoryEngine({ auditor });

    const created = await engine.createMemory(validInput(), {
      requestId: 'req-1',
      authContext: 'unit-test',
    });
    await engine.updateMemory(created.result?.id ?? '', { title: 'Renamed' });
    await engine.archiveMemory(created.result?.id ?? '');

    expect(entries.map((entry) => entry.action)).toEqual(['create', 'update', 'archive']);
    expect(entries[0]).toMatchObject({
      outcome: 'success',
      actor: 'unit-test',
      requestId: 'req-1',
    });
  });

  it('uses an injected id generator', async () => {
    const idGenerator: MemoryIdGenerator = {
      nextId: () => 'fixed-id',
    };
    const engine = new MemoryEngine({ idGenerator });

    const response = await engine.createMemory(validInput());

    expect(response.result?.id).toBe('fixed-id');
  });

  it('uses an injected repository', async () => {
    const repository: MemoryRepository = new InMemoryMemoryRepository();
    const engine = new MemoryEngine({ repository });

    const created = await engine.createMemory(validInput());

    expect(repository.findById(created.result?.id ?? '')).not.toBeNull();
  });

  it('validates a candidate memory without creating it', async () => {
    const engine = new MemoryEngine();

    const valid = await engine.validateMemory(validInput());
    expect(valid.status).toBe('success');
    expect(valid.result?.valid).toBe(true);

    const invalid = await engine.validateMemory(validInput({ title: '' }));
    expect(invalid.result?.valid).toBe(false);
    expect(invalid.result?.errors[0]?.code).toBe('invalid-title');
  });

  it('detects duplicates and policy violations during validation', async () => {
    const policyHook: MemoryPolicyHook = {
      verify: () => ({
        valid: false,
        errors: [{ code: 'policy-violation', field: 'memory', message: 'Blocked' }],
      }),
    };
    const repository = new InMemoryMemoryRepository();
    const creating = new MemoryEngine({ repository });
    await creating.createMemory(validInput());
    const engine = new MemoryEngine({ repository, policyHook });

    const duplicate = await engine.validateMemory(validInput());
    expect(duplicate.result?.errors.map((error) => error.code)).toContain('duplicate');

    const different = await engine.validateMemory(validInput({ title: 'Different title' }));
    expect(different.result?.valid).toBe(false);
    expect(different.result?.errors.map((error) => error.code)).toContain('policy-violation');
  });

  it('reports relationship problems during validation', async () => {
    const engine = new MemoryEngine();

    const response = await engine.validateMemory({
      ...validInput({ title: 'Related note' }),
      relatedTo: ['nope'],
    });

    expect(response.result?.valid).toBe(false);
    expect(response.result?.errors[0]?.code).toBe('invalid-relationship');
  });

  it('keeps the engine usable when no options are provided', () => {
    const engine = new MemoryEngine();
    const classifier = new DefaultMemoryClassifier();
    const generator = new DefaultMemoryIdGenerator();

    expect(classifier).toBeDefined();
    expect(generator.nextId()).toMatch(/^[a-z0-9]+/);
    expect(engine).toBeInstanceOf(MemoryEngine);
  });

  it('passes the memory id and auth context to the authorization hook', async () => {
    const authorize = vi.fn<(_: unknown) => boolean>(() => true);
    const engine = new MemoryEngine({ authorizationHook: { authorize } });
    const created = await engine.createMemory(validInput(), { authContext: 'operator' });
    await engine.getMemory(created.result?.id ?? '', { authContext: 'operator' });

    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', authContext: 'operator' }),
    );
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'read', memoryId: created.result?.id }),
    );
  });

  it('returns memories sorted deterministically from the repository', async () => {
    const engine = new MemoryEngine();
    await engine.createMemory(validInput({ title: 'First', source: 'a' }));
    await engine.createMemory(validInput({ title: 'Second', source: 'a' }));

    const response = await engine.queryMemories({ source: 'a' });

    expect(response.result?.length).toBe(2);
  });
});
