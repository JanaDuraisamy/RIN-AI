import type { AuditLog } from '@rin/types';

import type { PersistenceAuthorizationAdapter } from './authorization.js';
import { PersistenceConnection } from './connection.js';
import { PersistenceError } from './errors.js';
import { auditLogFromRow, auditLogToRow } from './mapping.js';

export interface AuditLogQuery {
  actor?: string;
  action?: string;
  resource?: string;
  outcome?: string;
  from?: string;
  to?: string;
}

export interface AuditLogRepository {
  append(entry: AuditLog): void;
  query(filter: AuditLogQuery): AuditLog[];
}

export interface SqliteAuditLogRepositoryOptions {
  connection: PersistenceConnection;
  authorization: PersistenceAuthorizationAdapter;
}

export class SqliteAuditLogRepository implements AuditLogRepository {
  private readonly connection: PersistenceConnection;
  private readonly authorization: PersistenceAuthorizationAdapter;

  constructor(options: SqliteAuditLogRepositoryOptions) {
    this.connection = options.connection;
    this.authorization = options.authorization;
  }

  append(entry: AuditLog): void {
    const row = auditLogToRow(entry);
    this.assertOpen();
    this.authorize('audit-log:append', '*');
    try {
      this.connection.database
        .prepare(
          'INSERT INTO audit_log (id, actor, action, resource, timestamp, outcome, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(row.id, row.actor, row.action, row.resource, row.timestamp, row.outcome, row.metadata);
    } catch (error) {
      if (isConstraintViolation(error)) {
        throw new PersistenceError('duplicate', 'audit log entry already exists');
      }
      throw error;
    }
  }

  query(filter: AuditLogQuery): AuditLog[] {
    this.assertOpen();
    this.authorize('audit-log:query', '*');
    const { sql, params } = buildQuery(filter);
    const rows = this.connection.database.prepare(sql).all(...params);
    return rows.map((row) => auditLogFromRow(row));
  }

  private assertOpen(): void {
    if (!this.connection.isOpen) {
      throw new PersistenceError('connection-closed', 'persistence connection is not open');
    }
  }

  private authorize(action: 'audit-log:append' | 'audit-log:query', resource: string): void {
    if (!this.authorization.authorize(action, resource)) {
      throw new PersistenceError('denied', 'operation not authorized');
    }
  }
}

function buildQuery(filter: AuditLogQuery): { sql: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];
  if (filter.actor !== undefined) {
    conditions.push('actor = ?');
    params.push(filter.actor);
  }
  if (filter.action !== undefined) {
    conditions.push('action = ?');
    params.push(filter.action);
  }
  if (filter.resource !== undefined) {
    conditions.push('resource = ?');
    params.push(filter.resource);
  }
  if (filter.outcome !== undefined) {
    conditions.push('outcome = ?');
    params.push(filter.outcome);
  }
  if (filter.from !== undefined) {
    conditions.push('timestamp >= ?');
    params.push(filter.from);
  }
  if (filter.to !== undefined) {
    conditions.push('timestamp <= ?');
    params.push(filter.to);
  }
  const where = conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`;
  return {
    sql: `SELECT id, actor, action, resource, timestamp, outcome, metadata FROM audit_log${where} ORDER BY timestamp ASC, rowid ASC`,
    params,
  };
}

function isConstraintViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const errcode = (error as { errcode?: unknown }).errcode;
  if (typeof errcode === 'number' && (errcode & 0xff) === 19) {
    return true;
  }
  return error.message.includes('constraint failed');
}
