import { describe, expect, it } from 'vitest';

import type { PermissionPolicy } from '@rin/types';
import { SecurityFoundation } from '@rin/security';

import { PersistenceAuthorizationAdapter } from './index.js';
import { PersistenceConnection } from './index.js';
import { PersistenceError, type PersistenceErrorCode } from './index.js';
import { MigrationRunner, MIGRATIONS, V1_MIGRATION, type Migration } from './index.js';

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

function setup(): {
  connection: PersistenceConnection;
  foundation: SecurityFoundation;
  authorization: PersistenceAuthorizationAdapter;
} {
  const connection = new PersistenceConnection();
  connection.open();
  const foundation = new SecurityFoundation();
  const authorization = new PersistenceAuthorizationAdapter({ foundation });
  return { connection, foundation, authorization };
}

function allowMigrations(foundation: SecurityFoundation): void {
  const policy: PermissionPolicy = {
    id: 'test-migration-run',
    caller: 'persistence',
    action: 'persistence:migration:run',
    resource: '*',
    category: 'always-allowed',
  };
  foundation.registry.register(policy);
}

function tableNames(connection: PersistenceConnection): string[] {
  const rows = connection.database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all();
  return rows.map((row) => String(row['name']));
}

function indexNames(connection: PersistenceConnection): string[] {
  const rows = connection.database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
    .all();
  return rows.map((row) => String(row['name']));
}

describe('MigrationRunner', () => {
  it('applies the v1 schema with the approved tables and indexes', () => {
    const { connection, foundation, authorization } = setup();
    allowMigrations(foundation);
    const runner = new MigrationRunner({ connection, authorization });

    runner.migrate();

    expect(tableNames(connection).sort()).toEqual([
      'audit_log',
      'runtime_configuration',
      'schema_migrations',
    ]);
    expect(indexNames(connection)).toContain('idx_audit_log_actor_timestamp');
    const versions = connection.database.prepare('SELECT version FROM schema_migrations').all();
    expect(versions.map((row) => row['version'])).toEqual([1]);
    connection.close();
  });

  it('is idempotent across repeated runs', () => {
    const { connection, foundation, authorization } = setup();
    allowMigrations(foundation);
    const runner = new MigrationRunner({ connection, authorization });

    runner.migrate();
    runner.migrate();

    const versions = connection.database
      .prepare('SELECT COUNT(*) AS count FROM schema_migrations')
      .get();
    expect(versions?.['count']).toBe(1);
    connection.close();
  });

  it('denies migration when no policy exists (fail closed, no schema side effects)', () => {
    const { connection, authorization } = setup();
    const runner = new MigrationRunner({ connection, authorization });

    expectPersistenceError(() => runner.migrate(), 'denied');
    expect(tableNames(connection)).toEqual([]);
    connection.close();
  });

  it('rolls back a failing migration, records it as failed, and stops', () => {
    const { connection, foundation, authorization } = setup();
    allowMigrations(foundation);
    const failing: Migration[] = [
      V1_MIGRATION,
      {
        version: 2,
        name: 'create-should-not-exist',
        apply(database) {
          database.exec('CREATE TABLE should_not_exist (id TEXT PRIMARY KEY)');
          throw new Error('boom');
        },
      },
    ];
    const runner = new MigrationRunner({
      connection,
      authorization,
      auditSink: foundation.auditSink,
      migrations: failing,
    });

    expectPersistenceError(() => runner.migrate(), 'migration-failed');
    expect(tableNames(connection)).not.toContain('should_not_exist');
    const versions = connection.database.prepare('SELECT version FROM schema_migrations').all();
    expect(versions.map((row) => row['version'])).toEqual([1]);
    const audit = foundation.auditSink.query({ action: 'persistence:migration' });
    const failed = audit.find((entry) => entry.resource === '2');
    expect(failed?.outcome).toBe('error');
    expect(failed?.metadata).toEqual({ code: 'migration-failed' });
    connection.close();
  });

  it('audits successful migrations with content-free entries', () => {
    const { connection, foundation, authorization } = setup();
    allowMigrations(foundation);
    const runner = new MigrationRunner({
      connection,
      authorization,
      auditSink: foundation.auditSink,
    });

    runner.migrate();

    const audit = foundation.auditSink.query({ action: 'persistence:migration' });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor: 'persistence-migrations',
      action: 'persistence:migration',
      resource: '1',
      outcome: 'success',
      metadata: {},
    });
    connection.close();
  });

  it('runs migrations in version order regardless of provided order', () => {
    const { connection, foundation, authorization } = setup();
    allowMigrations(foundation);
    const reversed: Migration[] = [...MIGRATIONS].reverse();
    const runner = new MigrationRunner({ connection, authorization, migrations: reversed });

    runner.migrate();

    const versions = connection.database.prepare('SELECT version FROM schema_migrations').all();
    expect(versions.map((row) => row['version'])).toEqual([1]);
    connection.close();
  });

  it('rejects invalid migration versions', () => {
    const { connection, foundation, authorization } = setup();
    allowMigrations(foundation);
    const invalid: Migration[] = [{ version: 0, name: 'zero', apply() {} }];

    expectPersistenceError(
      () => new MigrationRunner({ connection, authorization, migrations: invalid }),
      'invalid-migration',
    );
    connection.close();
  });
});
