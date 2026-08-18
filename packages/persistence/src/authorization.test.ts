import { describe, expect, it } from 'vitest';

import type { PermissionEvaluator, PermissionPolicy } from '@rin/types';
import { SecurityFoundation } from '@rin/security';

import { PersistenceAuthorizationAdapter } from './index.js';

function makeFoundation(): SecurityFoundation {
  return new SecurityFoundation();
}

function register(
  foundation: SecurityFoundation,
  caller: string,
  action: string,
  resource: string,
  category: PermissionPolicy['category'] = 'always-allowed',
): void {
  const policy: PermissionPolicy = {
    id: `test-${caller}-${action}-${resource}`,
    caller,
    action,
    resource,
    category,
  };
  foundation.registry.register(policy);
}

describe('PersistenceAuthorizationAdapter', () => {
  it('uses the persistence actor by default', () => {
    const adapter = new PersistenceAuthorizationAdapter({ foundation: makeFoundation() });
    expect(adapter.actor).toBe('persistence');
  });

  it('accepts a custom actor', () => {
    const adapter = new PersistenceAuthorizationAdapter({
      foundation: makeFoundation(),
      actor: 'persistence-test',
    });
    expect(adapter.actor).toBe('persistence-test');
  });

  it('allows an operation covered by an always-allowed policy', () => {
    const foundation = makeFoundation();
    register(foundation, 'persistence', 'persistence:audit-log:append', '*');
    const adapter = new PersistenceAuthorizationAdapter({ foundation });

    expect(adapter.authorize('audit-log:append', '*')).toBe(true);
  });

  it('denies an operation without any policy (fail closed)', () => {
    const foundation = makeFoundation();
    const adapter = new PersistenceAuthorizationAdapter({ foundation });

    expect(adapter.authorize('configuration:upsert', '*')).toBe(false);
  });

  it('denies an operation covered by a denied policy', () => {
    const foundation = makeFoundation();
    register(foundation, 'persistence', 'persistence:configuration:find', '*', 'denied');
    const adapter = new PersistenceAuthorizationAdapter({ foundation });

    expect(adapter.authorize('configuration:find', '*')).toBe(false);
  });

  it('honors resource-scoped policies', () => {
    const foundation = makeFoundation();
    register(foundation, 'persistence', 'persistence:configuration:find', 'key-a');
    const adapter = new PersistenceAuthorizationAdapter({ foundation });

    expect(adapter.authorize('configuration:find', 'key-a')).toBe(true);
    expect(adapter.authorize('configuration:find', 'key-b')).toBe(false);
  });

  it('denies when permission evaluation fails (fail closed)', () => {
    const evaluator: PermissionEvaluator = {
      evaluate() {
        throw new Error('evaluator exploded');
      },
    };
    const foundation = new SecurityFoundation({ evaluator });
    const adapter = new PersistenceAuthorizationAdapter({ foundation });

    expect(adapter.authorize('audit-log:query', '*')).toBe(false);
    const entries = foundation.auditSink.query({ action: 'persistence:audit-log:query' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('error');
    expect(entries[0]?.metadata).toEqual({ code: 'permission-unavailable' });
  });
});
