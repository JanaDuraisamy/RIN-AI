import { randomUUID } from 'node:crypto';

import type {
  PermissionCategory,
  PermissionDecision,
  PermissionEvaluator,
  PermissionPolicy,
  PermissionPolicyValidationResult,
  PermissionRegistry,
  PermissionRequest,
  SecurityErrorCode,
  SecurityErrorInfo,
} from '@rin/types';

export class SecurityError extends Error {
  readonly code: SecurityErrorCode;
  readonly traceId: string;

  constructor(code: SecurityErrorCode, message: string, traceId?: string) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.traceId = traceId ?? randomUUID();
  }

  info(): SecurityErrorInfo {
    return {
      code: this.code,
      message: this.message,
      traceId: this.traceId,
    };
  }
}

export class InMemoryPermissionRegistry implements PermissionRegistry {
  private readonly policies = new Map<string, PermissionPolicy>();

  register(policy: PermissionPolicy): void {
    const validation = this.validate(policy);
    if (!validation.valid) {
      throw new SecurityError('invalid-permission-request', 'invalid permission policy');
    }
    if (this.policies.has(policy.id)) {
      throw new SecurityError('invalid-permission-request', 'permission policy already registered');
    }
    this.policies.set(policy.id, { ...policy });
  }

  resolve(request: PermissionRequest): PermissionPolicy | null {
    const matches: PermissionPolicy[] = [];
    for (const policy of this.policies.values()) {
      if (
        policy.caller === request.caller &&
        policy.action === request.action &&
        (policy.resource === '*' || policy.resource === request.resource)
      ) {
        matches.push(policy);
      }
    }
    if (matches.length === 1) {
      const policy = matches[0];
      if (policy !== undefined) {
        return policy;
      }
    }
    return null;
  }

  remove(id: string): boolean {
    return this.policies.delete(id);
  }

  enumerate(): PermissionPolicy[] {
    return [...this.policies.values()].map((policy) => ({ ...policy }));
  }

  validate(policy: PermissionPolicy): PermissionPolicyValidationResult {
    const issues: string[] = [];
    if (policy.id.trim() === '') {
      issues.push('policy id must not be empty');
    }
    if (policy.caller.trim() === '') {
      issues.push('policy caller must not be empty');
    }
    if (policy.action.trim() === '') {
      issues.push('policy action must not be empty');
    }
    if (policy.resource.trim() === '') {
      issues.push('policy resource must not be empty');
    }
    if (!isPermissionCategory(policy.category)) {
      issues.push('policy category is invalid');
    }
    return { valid: issues.length === 0, issues };
  }
}

export class DefaultPermissionEvaluator implements PermissionEvaluator {
  private readonly registry: PermissionRegistry;

  constructor(registry: PermissionRegistry) {
    this.registry = registry;
  }

  evaluate(request: PermissionRequest): PermissionDecision {
    if (!isValidRequest(request)) {
      throw new SecurityError('invalid-permission-request', 'invalid permission request');
    }
    let policy: PermissionPolicy | null;
    try {
      policy = this.registry.resolve(request);
    } catch {
      throw new SecurityError('permission-unavailable', 'permission evaluation failed');
    }
    if (policy === null) {
      return deny(request);
    }
    switch (policy.category) {
      case 'always-allowed':
        return {
          action: request.action,
          resource: request.resource,
          category: 'always-allowed',
          permitted: true,
          status: 'approved',
        };
      case 'confirmation-required':
        if (request.authContext === undefined) {
          return deny(request);
        }
        return {
          action: request.action,
          resource: request.resource,
          category: 'confirmation-required',
          permitted: false,
          status: 'confirmation-required',
        };
      case 'restricted':
        if (request.authContext === undefined) {
          return deny(request);
        }
        return {
          action: request.action,
          resource: request.resource,
          category: 'restricted',
          permitted: false,
          status: 'restricted',
        };
      case 'denied':
        return deny(request);
    }
  }
}

function isPermissionCategory(value: string): value is PermissionCategory {
  return (
    value === 'always-allowed' ||
    value === 'confirmation-required' ||
    value === 'restricted' ||
    value === 'denied'
  );
}

function isValidRequest(request: PermissionRequest): boolean {
  return (
    request.action.trim() !== '' &&
    request.resource.trim() !== '' &&
    request.caller.trim() !== '' &&
    request.requestId.trim() !== '' &&
    request.timestamp.trim() !== ''
  );
}

function deny(request: PermissionRequest): PermissionDecision {
  return {
    action: request.action,
    resource: request.resource,
    category: 'denied',
    permitted: false,
    status: 'denied',
  };
}
