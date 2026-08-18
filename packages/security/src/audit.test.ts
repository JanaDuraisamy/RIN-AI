import { describe, expect, it } from 'vitest';

import type { AuditEntry } from '@rin/types';

import { InMemoryAuditSink, SecurityFoundation } from './index.js';
import type { PermissionRequest } from '@rin/types';

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'entry-1',
    actor: 'memory-engine',
    action: 'memory:create',
    resource: 'mem-1',
    timestamp: '2026-08-18T00:00:00.000Z',
    outcome: 'success',
    metadata: {},
    requestId: 'req-1',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<PermissionRequest> = {}): PermissionRequest {
  return {
    action: 'memory:read',
    resource: 'mem-1',
    caller: 'memory-engine',
    requestId: 'req-1',
    timestamp: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryAuditSink', () => {
  it('appends entries', () => {
    const sink = new InMemoryAuditSink();
    sink.append(makeEntry());

    expect(sink.query({}).length).toBe(1);
  });

  it('rejects malformed entries', () => {
    const sink = new InMemoryAuditSink();

    expect(() => sink.append(makeEntry({ action: ' ' }))).toThrow('invalid audit entry');
    expect(() => sink.append(makeEntry({ outcome: 'unsupported' as 'success' }))).toThrow(
      'invalid audit entry',
    );
  });

  it('queries by each filter field', () => {
    const sink = new InMemoryAuditSink();
    sink.append(makeEntry({ id: 'entry-1', actor: 'memory-engine', action: 'memory:create' }));
    sink.append(makeEntry({ id: 'entry-2', actor: 'agent', action: 'memory:read' }));
    sink.append(makeEntry({ id: 'entry-3', actor: 'agent', action: 'memory:remove' }));

    expect(sink.query({ actor: 'agent' }).map((entry) => entry.id)).toEqual(['entry-2', 'entry-3']);
    expect(sink.query({ action: 'memory:create' }).map((entry) => entry.id)).toEqual(['entry-1']);
    expect(sink.query({ outcome: 'success' }).length).toBe(3);
    expect(sink.query({ resource: 'mem-1' }).length).toBe(3);
    expect(sink.query({ requestId: 'req-1' }).length).toBe(3);
    expect(sink.query({ correlationId: 'corr-1' }).length).toBe(0);
  });

  it('combines filters with AND semantics', () => {
    const sink = new InMemoryAuditSink();
    sink.append(makeEntry({ id: 'entry-1', actor: 'agent', outcome: 'success' }));
    sink.append(makeEntry({ id: 'entry-2', actor: 'agent', outcome: 'denied' }));

    expect(sink.query({ actor: 'agent', outcome: 'denied' }).map((entry) => entry.id)).toEqual([
      'entry-2',
    ]);
  });

  it('exposes an append-only surface', () => {
    const sink = new InMemoryAuditSink();
    const surface = sink as unknown as Record<string, unknown>;

    expect(surface.update).toBeUndefined();
    expect(surface.delete).toBeUndefined();
    expect(surface.remove).toBeUndefined();
    expect(surface.clear).toBeUndefined();
  });

  it('returns copies that cannot mutate stored entries', () => {
    const sink = new InMemoryAuditSink();
    sink.append(makeEntry());

    const [queried] = sink.query({});
    if (queried !== undefined) {
      queried.metadata = { tampered: true };
    }

    expect(sink.query({})[0]?.metadata).toEqual({});
  });
});

describe('SecurityFoundation audit integration', () => {
  it('audits a successful authorization decision', () => {
    const sink = new InMemoryAuditSink();
    const foundation = new SecurityFoundation({ auditSink: sink });
    foundation.registry.register({
      id: 'policy-1',
      caller: 'memory-engine',
      action: 'memory:read',
      resource: '*',
      category: 'always-allowed',
    });

    foundation.decide(makeRequest());

    const entries = sink.query({ outcome: 'success' });
    expect(entries.length).toBe(1);
    expect(entries[0]).toMatchObject({
      actor: 'memory-engine',
      action: 'memory:read',
      resource: 'mem-1',
      requestId: 'req-1',
      timestamp: '2026-08-18T00:00:00.000Z',
      outcome: 'success',
    });
  });

  it('audits a denied authorization decision', () => {
    const sink = new InMemoryAuditSink();
    const foundation = new SecurityFoundation({ auditSink: sink });

    foundation.decide(makeRequest());

    expect(sink.query({ outcome: 'denied' }).length).toBe(1);
    expect(sink.query({ outcome: 'success' }).length).toBe(0);
  });

  it('audits an authorization error', () => {
    const sink = new InMemoryAuditSink();
    const evaluator = {
      evaluate: () => {
        throw new Error('evaluator failure');
      },
    };
    const foundation = new SecurityFoundation({ evaluator, auditSink: sink });

    expect(() => foundation.decide(makeRequest())).toThrow();

    const entries = sink.query({ outcome: 'error' });
    expect(entries.length).toBe(1);
    expect(entries[0]).toMatchObject({
      actor: 'memory-engine',
      action: 'memory:read',
      resource: 'mem-1',
      outcome: 'error',
    });
  });

  it('never records sensitive content in audit entries', () => {
    const sink = new InMemoryAuditSink();
    const foundation = new SecurityFoundation({ auditSink: sink });
    foundation.registry.register({
      id: 'policy-1',
      caller: 'memory-engine',
      action: 'memory:create',
      resource: '*',
      category: 'always-allowed',
    });

    foundation.decide(
      makeRequest({
        action: 'memory:create',
        caller: 'memory-engine',
      }),
    );
    foundation.decide(makeRequest({ action: 'memory:remove' }));

    const serialized = JSON.stringify(sink.query({}));
    expect(serialized).not.toContain('title');
    expect(serialized).not.toContain('content');
    expect(serialized).not.toContain('payload');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('password');
  });
});
