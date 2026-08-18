import { describe, expect, it } from 'vitest';

import { MemoryEngine } from '@rin/memory';
import type { MemoryAction } from '@rin/types';

import { InMemoryAuditSink, MemoryAuthorizationAdapter, SecurityFoundation } from './index.js';

describe('MemoryAuthorizationAdapter action mapping', () => {
  it.each<MemoryAction>(['create', 'read', 'update', 'archive', 'remove', 'list'])(
    'authorizes %s under the beta seed policies',
    (action) => {
      const foundation = new SecurityFoundation();
      const adapter = new MemoryAuthorizationAdapter({ foundation });

      expect(adapter.authorize({ action })).toBe(true);
    },
  );

  it('maps list operations to the memory:query permission action', () => {
    const foundation = new SecurityFoundation();
    foundation.registry.register({
      id: 'deny-list',
      caller: 'memory-engine',
      action: 'memory:query',
      resource: '*',
      category: 'denied',
    });
    foundation.registry.register({
      id: 'allow-read',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'always-allowed',
    });
    const adapter = new MemoryAuthorizationAdapter({
      foundation,
      seedBetaPolicies: false,
    });

    expect(adapter.authorize({ action: 'list' })).toBe(false);
    expect(adapter.authorize({ action: 'read', memoryId: 'mem-1' })).toBe(true);
  });

  it('passes the memory id as the resource for scoped operations', () => {
    const foundation = new SecurityFoundation();
    foundation.registry.register({
      id: 'deny-mem-1',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: 'mem-1',
      category: 'denied',
    });
    foundation.registry.register({
      id: 'allow-read',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'always-allowed',
    });
    const adapter = new MemoryAuthorizationAdapter({
      foundation,
      seedBetaPolicies: false,
    });

    expect(adapter.authorize({ action: 'read', memoryId: 'mem-1' })).toBe(false);
    expect(adapter.authorize({ action: 'read', memoryId: 'mem-2' })).toBe(true);
  });

  it('forwards authContext to the permission request', () => {
    const foundation = new SecurityFoundation();
    foundation.registry.register({
      id: 'confirmation',
      caller: 'memory-engine',
      action: 'memory:update',
      resource: '*',
      category: 'confirmation-required',
    });
    const adapter = new MemoryAuthorizationAdapter({
      foundation,
      seedBetaPolicies: false,
    });

    expect(adapter.authorize({ action: 'update', authContext: 'ctx-1' })).toBe(false);
  });
});

describe('MemoryAuthorizationAdapter fail-closed behavior', () => {
  it('denies when the permission service fails', () => {
    const evaluator = {
      evaluate: () => {
        throw new Error('evaluator failure');
      },
    };
    const foundation = new SecurityFoundation({ evaluator });
    const adapter = new MemoryAuthorizationAdapter({
      foundation,
      seedBetaPolicies: false,
    });

    expect(adapter.authorize({ action: 'create' })).toBe(false);
  });

  it('denies when no policy matches', () => {
    const foundation = new SecurityFoundation();
    const adapter = new MemoryAuthorizationAdapter({
      foundation,
      seedBetaPolicies: false,
    });

    expect(adapter.authorize({ action: 'create' })).toBe(false);
  });
});

describe('MemoryAuthorizationAdapter audit behavior', () => {
  it('audits granted and denied decisions without content leakage', () => {
    const auditSink = new InMemoryAuditSink();
    const foundation = new SecurityFoundation({ auditSink });
    foundation.registry.register({
      id: 'deny-create',
      caller: 'memory-engine',
      action: 'memory:create',
      resource: '*',
      category: 'denied',
    });
    foundation.registry.register({
      id: 'allow-read',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'always-allowed',
    });
    const adapter = new MemoryAuthorizationAdapter({
      foundation,
      seedBetaPolicies: false,
    });

    adapter.authorize({ action: 'create' });
    adapter.authorize({ action: 'read', memoryId: 'mem-1' });

    const entries = auditSink.query({});
    expect(entries.length).toBe(2);
    expect(entries[0]?.outcome).toBe('denied');
    expect(entries[1]?.outcome).toBe('success');
    expect(entries[0]?.action).toBe('memory:create');
    expect(entries[1]?.action).toBe('memory:read');
    expect(entries[1]?.resource).toBe('mem-1');

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain('title');
    expect(serialized).not.toContain('content');
    expect(serialized).not.toContain('payload');
  });
});

describe('MemoryEngine integration', () => {
  it('preserves the Phase 3 open-access behavior with seeded policies', async () => {
    const foundation = new SecurityFoundation();
    const adapter = new MemoryAuthorizationAdapter({ foundation });
    const engine = new MemoryEngine({ authorizationHook: adapter });

    const created = await engine.createMemory({
      title: 'Beta note',
      content: 'Open access preserved through the authorization adapter',
      source: 'adapter-test',
    });

    expect(created.status).toBe('success');
    const id = created.result?.id ?? 'missing';
    const retrieved = await engine.getMemory(id);
    expect(retrieved.status).toBe('success');
  });

  it('maps an adapter denial to the unauthorized memory error', async () => {
    const foundation = new SecurityFoundation();
    foundation.registry.register({
      id: 'deny-create',
      caller: 'memory-engine',
      action: 'memory:create',
      resource: '*',
      category: 'denied',
    });
    const adapter = new MemoryAuthorizationAdapter({
      foundation,
      seedBetaPolicies: false,
    });
    const engine = new MemoryEngine({ authorizationHook: adapter });

    const created = await engine.createMemory({
      title: 'Blocked note',
      content: 'This create must be denied',
      source: 'adapter-test',
    });

    expect(created.status).toBe('error');
    expect(created.error?.code).toBe('unauthorized');
    expect(created.result).toBeNull();
  });

  it('supports a configurable adapter actor', () => {
    const foundation = new SecurityFoundation();
    const adapter = new MemoryAuthorizationAdapter({
      foundation,
      actor: 'test-caller',
    });

    expect(adapter.actor).toBe('test-caller');
    const policies = foundation.registry.enumerate();
    expect(policies.every((policy) => policy.caller === 'test-caller')).toBe(true);
  });

  it('keeps the open-access default when no hook is supplied', async () => {
    const engine = new MemoryEngine();

    const created = await engine.createMemory({
      title: 'Unhooked note',
      content: 'No authorization hook provided',
      source: 'adapter-test',
    });

    expect(created.status).toBe('success');
  });
});
