import { describe, expect, it } from 'vitest';

import type { AuditLog, PermissionPolicy } from '@rin/types';
import { SecurityFoundation } from '@rin/security';

import { PersistenceAuthorizationAdapter } from './index.js';
import { PersistenceConnection } from './index.js';
import { PersistenceError, type PersistenceErrorCode } from './index.js';
import { MigrationRunner } from './index.js';
import { SqliteAuditLogRepository } from './index.js';

const ACTIONS = [
  'persistence:audit-log:append',
  'persistence:audit-log:query',
  'persistence:configuration:upsert',
  'persistence:configuration:find',
  'persistence:migration:run',
] as const;

function setup(): {
  connection: PersistenceConnection;
  repository: SqliteAuditLogRepository;
} {
  const connection = new PersistenceConnection();
  connection.open();
  const foundation = new SecurityFoundation();
  for (const action of ACTIONS) {
    const policy: PermissionPolicy = {
      id: `test-${action}`,
      caller: 'persistence',
      action,
      resource: '*',
      category: 'always-allowed',
    };
    foundation.registry.register(policy);
  }
  const authorization = new PersistenceAuthorizationAdapter({ foundation });
  new MigrationRunner({ connection, authorization }).migrate();
  const repository = new SqliteAuditLogRepository({ connection, authorization });
  return { connection, repository };
}

function makeEntry(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'audit-1',
    actor: 'system',
    action: 'core:boot',
    resource: 'runtime',
    timestamp: '2026-01-01T00:00:00.000Z',
    outcome: 'success',
    metadata: {},
    ...overrides,
  };
}

function expectPersistenceError(operation: () => unknown, code: PersistenceErrorCode): void {
  let caught: unknown;
  try {
    operation();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PersistenceError);
  expect((caught as PersistenceError).code).toBe(code);
}

describe('SqliteAuditLogRepository', () => {
  it('appends and queries audit entries', () => {
    const { repository } = setup();
    const entry = makeEntry();

    repository.append(entry);

    expect(repository.query({})).toEqual([entry]);
  });

  it('filters by actor, action, resource, and outcome', () => {
    const { repository } = setup();
    repository.append(
      makeEntry({
        id: 'a',
        actor: 'alice',
        action: 'core:boot',
        resource: 'runtime',
        outcome: 'success',
      }),
    );
    repository.append(
      makeEntry({
        id: 'b',
        actor: 'bob',
        action: 'memory:create',
        resource: 'memory',
        outcome: 'denied',
      }),
    );
    repository.append(
      makeEntry({
        id: 'c',
        actor: 'alice',
        action: 'memory:create',
        resource: 'memory',
        outcome: 'error',
      }),
    );

    expect(repository.query({ actor: 'alice' }).map((e) => e.id)).toEqual(['a', 'c']);
    expect(repository.query({ action: 'memory:create' }).map((e) => e.id)).toEqual(['b', 'c']);
    expect(repository.query({ resource: 'runtime' }).map((e) => e.id)).toEqual(['a']);
    expect(repository.query({ outcome: 'denied' }).map((e) => e.id)).toEqual(['b']);
    expect(repository.query({ actor: 'alice', outcome: 'error' }).map((e) => e.id)).toEqual(['c']);
    expect(repository.query({ resource: 'memory' }).map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('filters by timestamp bounds', () => {
    const { repository } = setup();
    repository.append(makeEntry({ id: 'a', timestamp: '2026-01-01T00:00:00.000Z' }));
    repository.append(makeEntry({ id: 'b', timestamp: '2026-01-02T00:00:00.000Z' }));
    repository.append(makeEntry({ id: 'c', timestamp: '2026-01-03T00:00:00.000Z' }));

    expect(repository.query({ from: '2026-01-02T00:00:00.000Z' }).map((e) => e.id)).toEqual([
      'b',
      'c',
    ]);
    expect(repository.query({ to: '2026-01-02T00:00:00.000Z' }).map((e) => e.id)).toEqual([
      'a',
      'b',
    ]);
    expect(
      repository
        .query({ from: '2026-01-02T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' })
        .map((e) => e.id),
    ).toEqual(['b']);
  });

  it('returns entries in timestamp order and preserves insertion order for equal timestamps', () => {
    const { repository } = setup();
    repository.append(makeEntry({ id: 'early', timestamp: '2026-01-01T00:00:00.000Z' }));
    repository.append(makeEntry({ id: 'same-1', timestamp: '2026-01-01T00:00:00.000Z' }));
    repository.append(makeEntry({ id: 'same-2', timestamp: '2026-01-01T00:00:00.000Z' }));
    repository.append(makeEntry({ id: 'late', timestamp: '2026-01-03T00:00:00.000Z' }));

    expect(repository.query({}).map((e) => e.id)).toEqual(['early', 'same-1', 'same-2', 'late']);
  });

  it('returns an empty list when nothing matches', () => {
    const { repository } = setup();
    repository.append(makeEntry());

    expect(repository.query({ actor: 'nobody' })).toEqual([]);
  });

  it('preserves metadata across a round trip', () => {
    const { repository } = setup();
    const entry = makeEntry({ metadata: { code: 'unauthorized' } });

    repository.append(entry);

    expect(repository.query({})[0]).toEqual(entry);
  });

  it('rejects duplicate ids', () => {
    const { repository } = setup();
    repository.append(makeEntry());

    expectPersistenceError(() => repository.append(makeEntry()), 'duplicate');
  });

  it('rejects malformed entries', () => {
    const { repository } = setup();

    expectPersistenceError(() => repository.append(makeEntry({ actor: '' })), 'invalid-entity');
  });

  it('denies operations without a matching policy (fail closed)', () => {
    const connection = new PersistenceConnection();
    connection.open();
    const foundation = new SecurityFoundation();
    const authorization = new PersistenceAuthorizationAdapter({ foundation });
    const repository = new SqliteAuditLogRepository({ connection, authorization });

    expectPersistenceError(() => repository.append(makeEntry()), 'denied');
    expectPersistenceError(() => repository.query({}), 'denied');
    const entries = foundation.auditSink.query({ action: 'persistence:audit-log:append' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('denied');
    connection.close();
  });

  it('throws connection-closed when the connection is not open', () => {
    const connection = new PersistenceConnection();
    const foundation = new SecurityFoundation();
    const authorization = new PersistenceAuthorizationAdapter({ foundation });
    const repository = new SqliteAuditLogRepository({ connection, authorization });

    expectPersistenceError(() => repository.append(makeEntry()), 'connection-closed');
    expectPersistenceError(() => repository.query({}), 'connection-closed');
  });

  it('throws corrupt-data when stored rows cannot be mapped', () => {
    const { connection, repository } = setup();
    repository.append(makeEntry());
    connection.database
      .prepare('UPDATE audit_log SET metadata = ? WHERE id = ?')
      .run('{', 'audit-1');

    expectPersistenceError(() => repository.query({}), 'corrupt-data');
  });
});
