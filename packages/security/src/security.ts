import { randomUUID } from 'node:crypto';

import type { AuditEntry, AuditOutcome, AuditSink } from '@rin/types';
import type {
  PermissionDecision,
  PermissionEvaluator,
  PermissionPolicy,
  PermissionRegistry,
  PermissionRequest,
} from '@rin/types';

import { InMemoryAuditSink } from './audit.js';
import {
  DefaultPermissionEvaluator,
  InMemoryPermissionRegistry,
  SecurityError,
} from './permission.js';

export interface SecurityFoundationOptions {
  evaluator?: PermissionEvaluator;
  registry?: PermissionRegistry;
  auditSink?: AuditSink;
}

export class SecurityFoundation {
  readonly evaluator: PermissionEvaluator;
  readonly registry: PermissionRegistry;
  readonly auditSink: AuditSink;

  constructor(options: SecurityFoundationOptions = {}) {
    this.registry = options.registry ?? new InMemoryPermissionRegistry();
    this.evaluator = options.evaluator ?? new DefaultPermissionEvaluator(this.registry);
    this.auditSink = options.auditSink ?? new InMemoryAuditSink();
  }

  decide(request: PermissionRequest): PermissionDecision {
    let decision: PermissionDecision;
    try {
      decision = this.evaluator.evaluate(request);
    } catch (error) {
      if (error instanceof SecurityError) {
        this.recordError(request, error.code);
        throw error;
      }
      this.recordError(request, 'permission-unavailable');
      throw new SecurityError('permission-unavailable', 'permission evaluation failed');
    }
    this.auditDecision(request, decision);
    return decision;
  }

  enforce(request: PermissionRequest): PermissionDecision {
    const decision = this.decide(request);
    if (decision.permitted) {
      return decision;
    }
    switch (decision.status) {
      case 'confirmation-required':
        throw new SecurityError(
          'requires-confirmation',
          'confirmation required for this operation',
        );
      case 'restricted':
        throw new SecurityError(
          'requires-elevated-authorization',
          'elevated authorization required for this operation',
        );
      default:
        throw new SecurityError('denied', 'operation not authorized');
    }
  }

  seedBetaMemoryPolicies(caller: string): void {
    for (const action of BETA_MEMORY_ACTIONS) {
      const id = `beta-memory-${action}`;
      const exists = this.registry.enumerate().some((policy) => policy.id === id);
      if (exists) {
        continue;
      }
      const policy: PermissionPolicy = {
        id,
        caller,
        action: `memory:${action}`,
        resource: '*',
        category: 'always-allowed',
      };
      this.registry.register(policy);
    }
  }

  private auditDecision(request: PermissionRequest, decision: PermissionDecision): void {
    const outcome: AuditOutcome = decision.permitted ? 'success' : 'denied';
    this.auditSink.append(buildAuditEntry(request, outcome, request.requestId));
  }

  private recordError(request: PermissionRequest, code: string): void {
    const entry = buildAuditEntry(request, 'error', request.requestId);
    entry.metadata = { code };
    this.auditSink.append(entry);
  }
}

function buildAuditEntry(
  request: PermissionRequest,
  outcome: AuditOutcome,
  requestId: string | undefined,
): AuditEntry {
  const entry: AuditEntry = {
    id: randomUUID(),
    actor: request.caller,
    action: request.action,
    resource: request.resource,
    timestamp: request.timestamp,
    outcome,
    metadata: {},
  };
  if (requestId !== undefined) {
    entry.requestId = requestId;
  }
  return entry;
}

const BETA_MEMORY_ACTIONS = ['create', 'read', 'update', 'archive', 'remove', 'query'] as const;
