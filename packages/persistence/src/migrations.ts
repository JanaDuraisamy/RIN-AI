import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type { AuditEntry, AuditSink } from '@rin/types';

import type { PersistenceAuthorizationAdapter } from './authorization.js';
import { PersistenceConnection } from './connection.js';
import { PersistenceError } from './errors.js';

export interface Migration {
  version: number;
  name: string;
  apply(database: DatabaseSync): void;
}

export interface MigrationRunnerOptions {
  connection: PersistenceConnection;
  authorization: PersistenceAuthorizationAdapter;
  auditSink?: AuditSink;
  migrations?: Migration[];
}

const SCHEMA_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    appliedAt TEXT NOT NULL
  )
`;

const V1_SCHEMA = `
  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    outcome TEXT NOT NULL,
    metadata TEXT NOT NULL
  );
  CREATE INDEX idx_audit_log_actor_timestamp ON audit_log (actor, timestamp);
  CREATE TABLE runtime_configuration (
    id TEXT PRIMARY KEY,
    configurationKey TEXT NOT NULL UNIQUE,
    configurationValue TEXT NOT NULL,
    environment TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

export const V1_MIGRATION: Migration = {
  version: 1,
  name: 'create-audit-log-and-runtime-configuration',
  apply(database) {
    database.exec(V1_SCHEMA);
  },
};

export const MIGRATIONS: Migration[] = [V1_MIGRATION];

export class MigrationRunner {
  private readonly connection: PersistenceConnection;
  private readonly authorization: PersistenceAuthorizationAdapter;
  private readonly auditSink: AuditSink | undefined;
  private readonly migrations: Migration[];

  constructor(options: MigrationRunnerOptions) {
    this.connection = options.connection;
    this.authorization = options.authorization;
    this.auditSink = options.auditSink;
    this.migrations = [...(options.migrations ?? MIGRATIONS)].sort((a, b) => a.version - b.version);
    for (const migration of this.migrations) {
      if (!Number.isInteger(migration.version) || migration.version < 1) {
        throw new PersistenceError(
          'invalid-migration',
          'migration version must be a positive integer',
        );
      }
    }
  }

  migrate(): void {
    const database = this.connection.database;
    if (!this.authorization.authorize('migration:run', '*')) {
      throw new PersistenceError('denied', 'migration operation not authorized');
    }
    database.exec(SCHEMA_MIGRATIONS_TABLE);
    const applied = this.appliedVersions(database);
    for (const migration of this.migrations) {
      if (applied.has(migration.version)) {
        continue;
      }
      database.exec('BEGIN');
      try {
        migration.apply(database);
        this.recordApplied(database, migration.version);
        database.exec('COMMIT');
      } catch {
        database.exec('ROLLBACK');
        this.audit(migration.version, 'error', 'migration-failed');
        throw new PersistenceError('migration-failed', `migration ${migration.version} failed`);
      }
      this.audit(migration.version, 'success');
    }
  }

  private appliedVersions(database: DatabaseSync): Set<number> {
    const rows = database.prepare('SELECT version FROM schema_migrations').all();
    const versions = new Set<number>();
    for (const row of rows) {
      const version = row['version'];
      if (typeof version === 'number') {
        versions.add(version);
      }
    }
    return versions;
  }

  private recordApplied(database: DatabaseSync, version: number): void {
    database
      .prepare('INSERT INTO schema_migrations (version, appliedAt) VALUES (?, ?)')
      .run(version, new Date().toISOString());
  }

  private audit(version: number, outcome: 'success' | 'error', code?: string): void {
    if (this.auditSink === undefined) {
      return;
    }
    const entry: AuditEntry = {
      id: randomUUID(),
      actor: 'persistence-migrations',
      action: 'persistence:migration',
      resource: String(version),
      timestamp: new Date().toISOString(),
      outcome,
      metadata: code === undefined ? {} : { code },
    };
    this.auditSink.append(entry);
  }
}
