export type PermissionCategory =
  'always-allowed' | 'confirmation-required' | 'restricted' | 'denied';

export type PermissionStatus = 'approved' | 'confirmation-required' | 'restricted' | 'denied';

export interface PermissionRequest {
  action: string;
  resource: string;
  caller: string;
  authContext?: string;
  requestId: string;
  timestamp: string;
}

export interface PermissionDecision {
  action: string;
  resource: string;
  category: PermissionCategory;
  permitted: boolean;
  status: PermissionStatus;
  reason?: string;
}

export interface PermissionPolicy {
  id: string;
  caller: string;
  action: string;
  resource: string;
  category: PermissionCategory;
}

export interface PermissionPolicyValidationResult {
  valid: boolean;
  issues: string[];
}

export interface PermissionEvaluator {
  evaluate(request: PermissionRequest): PermissionDecision;
}

export interface PermissionRegistry {
  register(policy: PermissionPolicy): void;
  resolve(request: PermissionRequest): PermissionPolicy | null;
  remove(id: string): boolean;
  enumerate(): PermissionPolicy[];
  validate(policy: PermissionPolicy): PermissionPolicyValidationResult;
}

export type SecurityErrorCode =
  | 'denied'
  | 'requires-confirmation'
  | 'requires-elevated-authorization'
  | 'permission-unavailable'
  | 'invalid-permission-request';

export interface SecurityErrorInfo {
  code: SecurityErrorCode;
  message: string;
  traceId: string;
}
