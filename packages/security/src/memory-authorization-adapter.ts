import { randomUUID } from 'node:crypto';

import type { MemoryAccessRequest, MemoryAction, PermissionRequest } from '@rin/types';

import type { SecurityFoundation } from './security.js';

export interface MemoryAuthorizationAdapterOptions {
  foundation: SecurityFoundation;
  actor?: string;
  seedBetaPolicies?: boolean;
}

const MEMORY_ACTION_MAP: Record<MemoryAction, string> = {
  create: 'memory:create',
  read: 'memory:read',
  update: 'memory:update',
  archive: 'memory:archive',
  remove: 'memory:remove',
  list: 'memory:query',
};

export class MemoryAuthorizationAdapter {
  readonly actor: string;

  private readonly foundation: SecurityFoundation;

  constructor(options: MemoryAuthorizationAdapterOptions) {
    this.foundation = options.foundation;
    this.actor = options.actor ?? 'memory-engine';
    if (options.seedBetaPolicies !== false) {
      this.foundation.seedBetaMemoryPolicies(this.actor);
    }
  }

  authorize(request: MemoryAccessRequest): boolean {
    const permissionRequest: PermissionRequest = {
      action: MEMORY_ACTION_MAP[request.action],
      resource: request.memoryId ?? '*',
      caller: this.actor,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    if (request.authContext !== undefined) {
      permissionRequest.authContext = request.authContext;
    }
    try {
      return this.foundation.decide(permissionRequest).permitted;
    } catch {
      return false;
    }
  }
}
