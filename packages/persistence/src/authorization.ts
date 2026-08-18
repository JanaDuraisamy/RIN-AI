import { randomUUID } from 'node:crypto';

import type { PermissionRequest } from '@rin/types';
import type { SecurityFoundation } from '@rin/security';

export type PersistenceAction =
  | 'audit-log:append'
  | 'audit-log:query'
  | 'configuration:upsert'
  | 'configuration:find'
  | 'migration:run';

export interface PersistenceAuthorizationAdapterOptions {
  foundation: SecurityFoundation;
  actor?: string;
}

export class PersistenceAuthorizationAdapter {
  readonly actor: string;

  private readonly foundation: SecurityFoundation;

  constructor(options: PersistenceAuthorizationAdapterOptions) {
    this.foundation = options.foundation;
    this.actor = options.actor ?? 'persistence';
  }

  authorize(action: PersistenceAction, resource: string): boolean {
    const request: PermissionRequest = {
      action: `persistence:${action}`,
      resource,
      caller: this.actor,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    try {
      return this.foundation.decide(request).permitted;
    } catch {
      return false;
    }
  }
}
