import { describe, expect, it } from 'vitest';

import type { PermissionPolicy, RuntimeConfiguration } from '@rin/types';
import { SecurityFoundation } from '@rin/security';

import { PersistenceAuthorizationAdapter } from './index.js';
import { PersistenceConnection } from './index.js';
import { PersistenceError, type PersistenceErrorCode } from './index.js';
import { MigrationRunner } from './index.js';
import { SqliteRuntimeConfigurationRepository } from './index.js';

const ACTIONS = [
  'persistence:audit-log:append',
  'persistence:audit-log:query',
  'persistence:configuration:upsert',
  'persistence:configuration:find',
  'persistence:migration:run',
] as const;

function setup(): {
  connection: PersistenceConnection;
  repository: SqliteRuntimeConfigurationRepository;
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
  const repository = new SqliteRuntimeConfigurationRepository({ connection, authorization });
  return { connection, repository };
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

describe('SqliteRuntimeConfigurationRepository', () => {
  it('upserts and finds a configuration', () => {
    const { repository } = setup();
    const configuration = makeConfiguration();

    const stored = repository.upsert(configuration);

    expect(stored).toEqual(configuration);
    expect(repository.find('runtime.conversation.timeout')).toEqual(configuration);
  });

  it('updates an existing key while preserving the original id', () => {
    const { repository } = setup();
    repository.upsert(makeConfiguration());

    const updated = repository.upsert(
      makeConfiguration({
        id: 'different-id',
        configurationValue: { seconds: 120 },
        environment: 'production',
        updatedAt: '2026-02-01T00:00:00.000Z',
      }),
    );

    expect(updated).toEqual({
      id: 'config-1',
      configurationKey: 'runtime.conversation.timeout',
      configurationValue: { seconds: 120 },
      environment: 'production',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
  });

  it('stores and restores scalar and object values', () => {
    const { repository } = setup();
    repository.upsert(
      makeConfiguration({ id: 'a', configurationKey: 'flag.enabled', configurationValue: true }),
    );
    repository.upsert(
      makeConfiguration({ id: 'b', configurationKey: 'label', configurationValue: 'welcome' }),
    );

    expect(repository.find('flag.enabled')?.configurationValue).toBe(true);
    expect(repository.find('label')?.configurationValue).toBe('welcome');
  });

  it('returns null when a configuration is missing', () => {
    const { repository } = setup();

    expect(repository.find('missing.key')).toBeNull();
  });

  it('rejects malformed configurations', () => {
    const { repository } = setup();

    expectPersistenceError(
      () => repository.upsert(makeConfiguration({ configurationKey: '' })),
      'invalid-entity',
    );
  });

  it('denies operations without a matching policy (fail closed)', () => {
    const connection = new PersistenceConnection();
    connection.open();
    const foundation = new SecurityFoundation();
    const authorization = new PersistenceAuthorizationAdapter({ foundation });
    const repository = new SqliteRuntimeConfigurationRepository({ connection, authorization });

    expectPersistenceError(() => repository.upsert(makeConfiguration()), 'denied');
    expectPersistenceError(() => repository.find('runtime.conversation.timeout'), 'denied');
    const entries = foundation.auditSink.query({ action: 'persistence:configuration:upsert' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('denied');
    connection.close();
  });

  it('throws connection-closed when the connection is not open', () => {
    const connection = new PersistenceConnection();
    const foundation = new SecurityFoundation();
    const authorization = new PersistenceAuthorizationAdapter({ foundation });
    const repository = new SqliteRuntimeConfigurationRepository({ connection, authorization });

    expectPersistenceError(() => repository.upsert(makeConfiguration()), 'connection-closed');
    expectPersistenceError(
      () => repository.find('runtime.conversation.timeout'),
      'connection-closed',
    );
  });

  it('throws corrupt-data when the stored value cannot be mapped', () => {
    const { connection, repository } = setup();
    repository.upsert(makeConfiguration());
    connection.database
      .prepare('UPDATE runtime_configuration SET configurationValue = ? WHERE configurationKey = ?')
      .run('{', 'runtime.conversation.timeout');

    expectPersistenceError(() => repository.find('runtime.conversation.timeout'), 'corrupt-data');
  });
});
