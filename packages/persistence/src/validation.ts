import type { AuditLog, RuntimeConfiguration } from '@rin/types';

import { PersistenceError } from './errors.js';

export function validateAuditLog(entry: AuditLog): void {
  if (
    entry.id.trim() === '' ||
    entry.actor.trim() === '' ||
    entry.action.trim() === '' ||
    entry.resource.trim() === '' ||
    entry.timestamp.trim() === '' ||
    !isAuditOutcome(entry.outcome)
  ) {
    throw new PersistenceError('invalid-entity', 'invalid audit log entry');
  }
}

export function validateRuntimeConfiguration(configuration: RuntimeConfiguration): void {
  if (
    configuration.id.trim() === '' ||
    configuration.configurationKey.trim() === '' ||
    configuration.environment.trim() === '' ||
    configuration.updatedAt.trim() === ''
  ) {
    throw new PersistenceError('invalid-entity', 'invalid runtime configuration');
  }
}

function isAuditOutcome(value: string): boolean {
  return value === 'success' || value === 'denied' || value === 'error';
}
