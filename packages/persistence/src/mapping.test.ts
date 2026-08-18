import { describe, expect, it } from 'vitest';

import type { AuditLog, RuntimeConfiguration } from '@rin/types';

import { PersistenceError, type PersistenceErrorCode } from './index.js';
import {
  auditLogFromRow,
  auditLogToRow,
  runtimeConfigurationFromRow,
  runtimeConfigurationToRow,
  type StoredRow,
} from './index.js';

function makeAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
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

function makeConfiguration(overrides: Partial<RuntimeConfiguration> = {}): RuntimeConfiguration {
  return {
    id: 'config-1',
    configurationKey: 'runtime.conversation.timeout',
    configurationValue: { seconds: 60 },
    environment: 'development',
    updatedAt: '2026-01-01T00:00:00.000Z',
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

describe('audit log mapping', () => {
  it('maps an audit log entity to a row', () => {
    const row = auditLogToRow(makeAuditLog({ metadata: { code: 'x' } }));
    expect(row.id).toBe('audit-1');
    expect(row.actor).toBe('system');
    expect(row.action).toBe('core:boot');
    expect(row.resource).toBe('runtime');
    expect(row.timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(row.outcome).toBe('success');
    expect(JSON.parse(row.metadata)).toEqual({ code: 'x' });
  });

  it('round-trips an audit log entity', () => {
    const entry = makeAuditLog({ outcome: 'denied', metadata: { code: 'unauthorized' } });
    const row = auditLogToRow(entry);
    const restored = auditLogFromRow(toStoredRow(row));
    expect(restored).toEqual(entry);
  });

  it('throws invalid-entity for malformed audit entries', () => {
    expectPersistenceError(() => auditLogToRow(makeAuditLog({ actor: ' ' })), 'invalid-entity');
    expectPersistenceError(
      () => auditLogToRow(makeAuditLog({ outcome: 'maybe' })),
      'invalid-entity',
    );
  });

  it('throws corrupt-data when stored metadata is not valid JSON', () => {
    expectPersistenceError(
      () => auditLogFromRow(toStoredRow({ ...auditLogToRow(makeAuditLog()), metadata: '{' })),
      'corrupt-data',
    );
  });

  it('throws corrupt-data when stored metadata is not an object', () => {
    expectPersistenceError(
      () =>
        auditLogFromRow(
          toStoredRow({ ...auditLogToRow(makeAuditLog()), metadata: JSON.stringify(['a']) }),
        ),
      'corrupt-data',
    );
  });

  it('throws corrupt-data when a stored column is not text', () => {
    expectPersistenceError(
      () => auditLogFromRow(toStoredRow({ ...auditLogToRow(makeAuditLog()), id: 7 })),
      'corrupt-data',
    );
    expectPersistenceError(() => auditLogFromRow(toStoredRow({ actor: 'x' })), 'corrupt-data');
  });
});

describe('runtime configuration mapping', () => {
  it('round-trips a runtime configuration entity', () => {
    const configuration = makeConfiguration({ configurationValue: { enabled: true, limit: 5 } });
    const row = runtimeConfigurationToRow(configuration);
    expect(row.configurationKey).toBe('runtime.conversation.timeout');
    expect(JSON.parse(row.configurationValue)).toEqual({ enabled: true, limit: 5 });
    const restored = runtimeConfigurationFromRow(toStoredRow(row));
    expect(restored).toEqual(configuration);
  });

  it('throws invalid-entity for malformed configurations', () => {
    expectPersistenceError(
      () => runtimeConfigurationToRow(makeConfiguration({ configurationKey: '' })),
      'invalid-entity',
    );
  });

  it('throws invalid-entity when the value cannot be serialized', () => {
    expectPersistenceError(
      () => runtimeConfigurationToRow(makeConfiguration({ configurationValue: undefined })),
      'invalid-entity',
    );
  });

  it('throws corrupt-data when the stored value is not valid JSON', () => {
    const row = runtimeConfigurationToRow(makeConfiguration());
    expectPersistenceError(
      () => runtimeConfigurationFromRow(toStoredRow({ ...row, configurationValue: '{' })),
      'corrupt-data',
    );
  });
});

function toStoredRow<T extends object>(row: T): StoredRow {
  return Object.fromEntries(Object.entries(row));
}
