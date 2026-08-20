import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  type AuditOutcome,
  type AuditSink,
  type PermissionEvaluator,
  type PermissionRequest,
} from '@rin/types';

import {
  type ApplyBoundary,
  type CompatibilityCheck,
  type PlanStage,
  type ReleaseStage,
  type UpgradeManagerOptions,
  type UpgradePlan,
  type UpgradeRequest,
  type UpgradeResult,
  type UpgradeTarget,
  type UpgradeVersionService,
} from './types.js';

export type { UpgradeManagerOptions } from './types.js';

const UPGRADE_MANAGER_CALLER = 'upgrade-manager';
const PLAN_ACTION = 'upgrade:plan';
const APPLY_ACTION = 'upgrade:apply';
const UPGRADE_RESOURCE = 'upgrade';
const GENERIC_ERROR_CODE = 'internal-error';

const RELEASE_STAGES: readonly ReleaseStage[] = ['alpha', 'beta', 'rc', 'stable'];

const PLAN_STAGES: readonly PlanStage[] = [
  'request',
  'classify',
  'permission',
  'confirmation',
  'plan',
  'precheck',
  'backup',
  'apply',
  'migrate',
  'verify',
  'restart',
  'health',
  'success',
  'rollback',
];

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function isValidRequest(request: UpgradeRequest): boolean {
  return (
    request.requestId.trim() !== '' &&
    request.timestamp.trim() !== '' &&
    request.callingComponent.trim() !== ''
  );
}

function isReleaseStage(value: string): value is ReleaseStage {
  return (RELEASE_STAGES as readonly string[]).includes(value);
}

function isValidTarget(target: UpgradeTarget): boolean {
  return (
    SEMVER_PATTERN.test(target.version) &&
    isReleaseStage(target.metadata.stage) &&
    Array.isArray(target.requiredMigrations) &&
    target.requiredMigrations.every((migration) => Number.isInteger(migration) && migration >= 0)
  );
}

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);
  if (aMajor !== bMajor) {
    return aMajor - bMajor;
  }
  if (aMinor !== bMinor) {
    return aMinor - bMinor;
  }
  return aPatch - bPatch;
}

function isApiCompatible(current: string, minimum: string): boolean {
  return compareVersions(current, minimum) >= 0;
}

export class UpgradeManager {
  private readonly versionService: UpgradeVersionService;
  private readonly permissionEvaluator: PermissionEvaluator;
  private readonly auditSink: AuditSink | undefined;

  constructor(options: UpgradeManagerOptions) {
    this.versionService = options.versionService;
    this.permissionEvaluator = options.permissionEvaluator;
    this.auditSink = options.auditSink;
  }

  plan(request: UpgradeRequest, target: UpgradeTarget, currentSchemaVersion = 0): UpgradeResult {
    const traceId = request.traceId === undefined ? randomUUID() : request.traceId;
    const startedAt = Date.now();
    const fail = (message: string, outcome: AuditOutcome): UpgradeResult => {
      this.audit(traceId, PLAN_ACTION, outcome);
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
        return fail('invalid upgrade request', 'error');
      }
      if (!isValidTarget(target)) {
        return fail('invalid upgrade target', 'error');
      }
      if (request.target !== undefined && request.target.version !== target.version) {
        return fail('upgrade target mismatch', 'error');
      }
      const decision = this.permissionEvaluator.evaluate(
        this.buildPermissionRequest(request, traceId, PLAN_ACTION),
      );
      if (!decision.permitted) {
        return fail('upgrade planning permission denied', 'denied');
      }
      const compatibility = this.buildCompatibilityCheck(target, currentSchemaVersion);
      const plan: UpgradePlan = {
        targetVersion: target.version,
        compatibility,
        stages: [...PLAN_STAGES],
        confirmationRequired: false,
        actions: [],
        summary: `plan for ${target.version} requires ${compatibility.missingMigrations.length} migration(s)`,
      };
      this.audit(traceId, PLAN_ACTION, 'success');
      return {
        status: 'success',
        result: plan,
        error: null,
        executionTimeMs: Date.now() - startedAt,
        version: API_VERSION,
        traceId,
      };
    } catch {
      return fail('unexpected upgrade manager failure', 'error');
    }
  }

  applyBoundary(request: UpgradeRequest): ApplyBoundary {
    const traceId = request.traceId === undefined ? randomUUID() : request.traceId;
    if (!isValidRequest(request)) {
      this.audit(traceId, APPLY_ACTION, 'error');
      return {
        action: APPLY_ACTION,
        resource: UPGRADE_RESOURCE,
        confirmation: 'required',
        permitted: false,
      };
    }
    try {
      const decision = this.permissionEvaluator.evaluate(
        this.buildPermissionRequest(request, traceId, APPLY_ACTION),
      );
      this.audit(traceId, APPLY_ACTION, decision.permitted ? 'success' : 'denied');
      return {
        action: APPLY_ACTION,
        resource: UPGRADE_RESOURCE,
        confirmation: 'required',
        permitted: decision.permitted,
      };
    } catch {
      this.audit(traceId, APPLY_ACTION, 'error');
      return {
        action: APPLY_ACTION,
        resource: UPGRADE_RESOURCE,
        confirmation: 'required',
        permitted: false,
      };
    }
  }

  private buildCompatibilityCheck(
    target: UpgradeTarget,
    currentSchemaVersion: number,
  ): CompatibilityCheck {
    const runtime = this.versionService.getRuntimeVersion();
    const current = this.versionService.getCompatibility();
    const minimumApiVersion = target.compatibility.minimumApiVersion;
    return {
      currentRuntimeVersion: runtime.runtimeVersion,
      currentApiVersion: runtime.apiVersion,
      minimumApiVersion,
      targetVersion: target.version,
      compatible: current.compatible && isApiCompatible(runtime.apiVersion, minimumApiVersion),
      requiredMigrations: [...target.requiredMigrations],
      missingMigrations: target.requiredMigrations.filter(
        (migration) => migration > currentSchemaVersion,
      ),
    };
  }

  private buildPermissionRequest(
    request: UpgradeRequest,
    traceId: string,
    action: string,
  ): PermissionRequest {
    const permission: PermissionRequest = {
      action,
      resource: UPGRADE_RESOURCE,
      caller: UPGRADE_MANAGER_CALLER,
      requestId: traceId,
      timestamp: request.timestamp,
    };
    if (request.authContext !== undefined) {
      permission.authContext = request.authContext;
    }
    return permission;
  }

  private audit(traceId: string, action: string, outcome: AuditOutcome): void {
    if (this.auditSink === undefined) {
      return;
    }
    this.auditSink.append({
      id: randomUUID(),
      actor: UPGRADE_MANAGER_CALLER,
      action,
      resource: UPGRADE_RESOURCE,
      timestamp: new Date().toISOString(),
      outcome,
      metadata: {},
      requestId: traceId,
    });
  }
}
