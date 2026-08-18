import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  type AgentCoordinator,
  type AuditSink,
  type CoreApiResponse,
  type PermissionEvaluator,
  type PermissionRequest,
  type RouterContext,
} from '@rin/types';

const AGENT_MANAGER_CALLER = 'agent-manager';
const COORDINATE_ACTION = 'agent-manager:coordinate';
const COORDINATION_RESOURCE = 'agent-manager';
const GENERIC_ERROR_CODE = 'internal-error';

export interface AgentManagerOptions {
  permissionEvaluator: PermissionEvaluator;
  auditSink?: AuditSink;
}

export interface AgentManagerRequest {
  requestId: string;
  timestamp: string;
  callingComponent: string;
  authContext?: string;
  input: unknown;
  traceId?: string;
}

export interface AgentManagerResponse extends CoreApiResponse<unknown> {
  traceId: string;
}

export class AgentManager implements AgentCoordinator {
  private readonly permissionEvaluator: PermissionEvaluator;
  private readonly auditSink: AuditSink | undefined;

  constructor(options: AgentManagerOptions) {
    this.permissionEvaluator = options.permissionEvaluator;
    this.auditSink = options.auditSink;
  }

  coordinate(request: AgentManagerRequest): AgentManagerResponse {
    const traceId = request.traceId === undefined ? randomUUID() : request.traceId;
    const startedAt = Date.now();
    const fail = (message: string, outcome: 'denied' | 'error'): AgentManagerResponse => {
      this.audit(traceId, outcome);
      return {
        status: 'error',
        result: null,
        error: { code: GENERIC_ERROR_CODE, message, traceId },
        executionTimeMs: Date.now() - startedAt,
        version: API_VERSION,
        traceId,
      };
    };
    try {
      if (!isValidRequest(request)) {
        return fail('invalid agent manager request', 'error');
      }
      const decision = this.permissionEvaluator.evaluate(
        this.buildPermissionRequest(request, traceId),
      );
      if (!decision.permitted) {
        return fail('coordination permission denied', 'denied');
      }
      this.audit(traceId, 'success');
      return {
        status: 'success',
        result: null,
        error: null,
        executionTimeMs: Date.now() - startedAt,
        version: API_VERSION,
        traceId,
      };
    } catch {
      return fail('unexpected agent manager failure', 'error');
    }
  }

  assign(context: RouterContext): unknown {
    void context;
    return this.deferredCoordination();
  }

  private deferredCoordination(): AgentManagerResponse {
    const startedAt = Date.now();
    return {
      status: 'success',
      result: null,
      error: null,
      executionTimeMs: Date.now() - startedAt,
      version: API_VERSION,
      traceId: randomUUID(),
    };
  }

  private buildPermissionRequest(request: AgentManagerRequest, traceId: string): PermissionRequest {
    const permission: PermissionRequest = {
      action: COORDINATE_ACTION,
      resource: COORDINATION_RESOURCE,
      caller: AGENT_MANAGER_CALLER,
      requestId: traceId,
      timestamp: request.timestamp,
    };
    if (request.authContext !== undefined) {
      permission.authContext = request.authContext;
    }
    return permission;
  }

  private audit(traceId: string, outcome: 'success' | 'denied' | 'error'): void {
    if (this.auditSink === undefined) {
      return;
    }
    this.auditSink.append({
      id: randomUUID(),
      actor: AGENT_MANAGER_CALLER,
      action: COORDINATE_ACTION,
      resource: COORDINATION_RESOURCE,
      timestamp: new Date().toISOString(),
      outcome,
      metadata: {},
      requestId: traceId,
    });
  }
}

function isValidRequest(request: AgentManagerRequest): boolean {
  return (
    request.requestId.trim() !== '' &&
    request.timestamp.trim() !== '' &&
    request.callingComponent.trim() !== ''
  );
}
