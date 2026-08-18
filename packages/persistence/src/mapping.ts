import type { AuditLog, RuntimeConfiguration } from '@rin/types';

import { PersistenceError } from './errors.js';
import { validateAuditLog, validateRuntimeConfiguration } from './validation.js';

export type StoredRow = Record<string, string | number | bigint | Uint8Array | null>;

export interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  outcome: string;
  metadata: string;
}

export interface RuntimeConfigurationRow {
  id: string;
  configurationKey: string;
  configurationValue: string;
  environment: string;
  updatedAt: string;
}

export function auditLogToRow(entry: AuditLog): AuditLogRow {
  validateAuditLog(entry);
  return {
    id: entry.id,
    actor: entry.actor,
    action: entry.action,
    resource: entry.resource,
    timestamp: entry.timestamp,
    outcome: entry.outcome,
    metadata: JSON.stringify(entry.metadata),
  };
}

export function auditLogFromRow(row: StoredRow): AuditLog {
  return rowToAuditLog({
    id: readString(row, 'id'),
    actor: readString(row, 'actor'),
    action: readString(row, 'action'),
    resource: readString(row, 'resource'),
    timestamp: readString(row, 'timestamp'),
    outcome: readString(row, 'outcome'),
    metadata: readString(row, 'metadata'),
  });
}

export function runtimeConfigurationToRow(
  configuration: RuntimeConfiguration,
): RuntimeConfigurationRow {
  validateRuntimeConfiguration(configuration);
  const value = JSON.stringify(configuration.configurationValue);
  if (value === undefined) {
    throw new PersistenceError(
      'invalid-entity',
      'runtime configuration value cannot be serialized',
    );
  }
  return {
    id: configuration.id,
    configurationKey: configuration.configurationKey,
    configurationValue: value,
    environment: configuration.environment,
    updatedAt: configuration.updatedAt,
  };
}

export function runtimeConfigurationFromRow(row: StoredRow): RuntimeConfiguration {
  return rowToRuntimeConfiguration({
    id: readString(row, 'id'),
    configurationKey: readString(row, 'configurationKey'),
    configurationValue: readString(row, 'configurationValue'),
    environment: readString(row, 'environment'),
    updatedAt: readString(row, 'updatedAt'),
  });
}

function rowToAuditLog(row: AuditLogRow): AuditLog {
  let metadata: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(row.metadata);
    if (!isRecord(parsed)) {
      throw new Error('metadata must be an object');
    }
    metadata = parsed;
  } catch {
    throw new PersistenceError('corrupt-data', 'audit log metadata is corrupt');
  }
  const entry: AuditLog = {
    id: row.id,
    actor: row.actor,
    action: row.action,
    resource: row.resource,
    timestamp: row.timestamp,
    outcome: row.outcome,
    metadata,
  };
  validateAuditLog(entry);
  return entry;
}

function rowToRuntimeConfiguration(row: RuntimeConfigurationRow): RuntimeConfiguration {
  let configurationValue: unknown;
  try {
    configurationValue = JSON.parse(row.configurationValue);
  } catch {
    throw new PersistenceError('corrupt-data', 'runtime configuration value is corrupt');
  }
  const configuration: RuntimeConfiguration = {
    id: row.id,
    configurationKey: row.configurationKey,
    configurationValue,
    environment: row.environment,
    updatedAt: row.updatedAt,
  };
  validateRuntimeConfiguration(configuration);
  return configuration;
}

function readString(row: StoredRow, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new PersistenceError('corrupt-data', `stored value for ${key} is not text`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
