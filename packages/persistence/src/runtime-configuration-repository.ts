import type { RuntimeConfiguration } from '@rin/types';

import type { PersistenceAuthorizationAdapter } from './authorization.js';
import { PersistenceConnection } from './connection.js';
import { PersistenceError } from './errors.js';
import {
  runtimeConfigurationFromRow,
  runtimeConfigurationToRow,
  type StoredRow,
} from './mapping.js';

export interface RuntimeConfigurationRepository {
  upsert(configuration: RuntimeConfiguration): RuntimeConfiguration;
  find(configurationKey: string): RuntimeConfiguration | null;
}

export interface SqliteRuntimeConfigurationRepositoryOptions {
  connection: PersistenceConnection;
  authorization: PersistenceAuthorizationAdapter;
}

export class SqliteRuntimeConfigurationRepository implements RuntimeConfigurationRepository {
  private readonly connection: PersistenceConnection;
  private readonly authorization: PersistenceAuthorizationAdapter;

  constructor(options: SqliteRuntimeConfigurationRepositoryOptions) {
    this.connection = options.connection;
    this.authorization = options.authorization;
  }

  upsert(configuration: RuntimeConfiguration): RuntimeConfiguration {
    const row = runtimeConfigurationToRow(configuration);
    this.assertOpen();
    this.authorize('configuration:upsert', configuration.configurationKey);
    this.connection.database
      .prepare(
        `INSERT INTO runtime_configuration (id, configurationKey, configurationValue, environment, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(configurationKey) DO UPDATE SET
           configurationValue = excluded.configurationValue,
           environment = excluded.environment,
           updatedAt = excluded.updatedAt`,
      )
      .run(row.id, row.configurationKey, row.configurationValue, row.environment, row.updatedAt);
    const stored = this.findRow(configuration.configurationKey);
    if (stored === undefined) {
      throw new PersistenceError('not-found', 'runtime configuration not found after upsert');
    }
    return runtimeConfigurationFromRow(stored);
  }

  find(configurationKey: string): RuntimeConfiguration | null {
    this.assertOpen();
    this.authorize('configuration:find', configurationKey);
    const row = this.findRow(configurationKey);
    return row === undefined ? null : runtimeConfigurationFromRow(row);
  }

  private findRow(configurationKey: string): StoredRow | undefined {
    return this.connection.database
      .prepare(
        'SELECT id, configurationKey, configurationValue, environment, updatedAt FROM runtime_configuration WHERE configurationKey = ?',
      )
      .get(configurationKey);
  }

  private assertOpen(): void {
    if (!this.connection.isOpen) {
      throw new PersistenceError('connection-closed', 'persistence connection is not open');
    }
  }

  private authorize(action: 'configuration:upsert' | 'configuration:find', resource: string): void {
    if (!this.authorization.authorize(action, resource)) {
      throw new PersistenceError('denied', 'operation not authorized');
    }
  }
}
