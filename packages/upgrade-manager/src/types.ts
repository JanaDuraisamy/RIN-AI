import type {
  AuditSink,
  CompatibilityInfo,
  CoreApiResponse,
  PermissionEvaluator,
  RuntimeVersionInfo,
} from '@rin/types';

export type ReleaseStage = 'alpha' | 'beta' | 'rc' | 'stable';

export interface UpgradeTargetReference {
  version: string;
  stage?: ReleaseStage;
}

export interface UpgradeRequest {
  requestId: string;
  timestamp: string;
  callingComponent: string;
  authContext?: string;
  input: unknown;
  traceId?: string;
  target?: UpgradeTargetReference;
}

export interface ReleaseMetadata {
  stage: ReleaseStage;
  releaseNotes?: string;
  integrity?: unknown;
  rollbackSource?: string;
}

export interface UpgradeTarget {
  version: string;
  compatibility: CompatibilityInfo;
  requiredMigrations: number[];
  metadata: ReleaseMetadata;
}

export interface CompatibilityCheck {
  currentRuntimeVersion: string;
  currentApiVersion: string;
  minimumApiVersion: string;
  targetVersion: string;
  compatible: boolean;
  requiredMigrations: number[];
  missingMigrations: number[];
}

export type PlanStage =
  | 'request'
  | 'classify'
  | 'permission'
  | 'confirmation'
  | 'plan'
  | 'precheck'
  | 'backup'
  | 'apply'
  | 'migrate'
  | 'verify'
  | 'restart'
  | 'health'
  | 'success'
  | 'rollback';

export interface UpgradePlan {
  targetVersion: string;
  compatibility: CompatibilityCheck;
  stages: PlanStage[];
  confirmationRequired: boolean;
  actions: [];
  summary: string;
}

export type ConfirmationStatus = 'not-required' | 'required' | 'confirmed';

export interface ApplyBoundary {
  action: string;
  resource: string;
  confirmation: ConfirmationStatus;
  permitted: boolean;
}

export interface UpgradeResult extends CoreApiResponse<UpgradePlan> {
  traceId: string;
}

export interface UpgradeVersionService {
  getRuntimeVersion(): RuntimeVersionInfo;
  getCompatibility(): CompatibilityInfo;
}

export interface UpgradeManagerOptions {
  versionService: UpgradeVersionService;
  permissionEvaluator: PermissionEvaluator;
  auditSink?: AuditSink;
}
