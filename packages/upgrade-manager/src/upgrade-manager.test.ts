import { describe, expect, it, vi } from 'vitest';

import { API_VERSION, type PermissionDecision, type PermissionEvaluator } from '@rin/types';
import {
  DefaultPermissionEvaluator,
  InMemoryAuditSink,
  InMemoryPermissionRegistry,
} from '@rin/security';

import {
  UpgradeManager,
  type ReleaseMetadata,
  type UpgradeManagerOptions,
  type UpgradeRequest,
  type UpgradeTarget,
  type UpgradeVersionService,
} from './index.js';

const UPGRADE_MANAGER_CALLER = 'upgrade-manager';
const PLAN_ACTION = 'upgrade:plan';
const APPLY_ACTION = 'upgrade:apply';
const UPGRADE_RESOURCE = 'upgrade';

const LOCKED_PLAN_STAGES = [
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

function makeRequest(overrides: Partial<UpgradeRequest> = {}): UpgradeRequest {
  return {
    requestId: 'upg-1',
    timestamp: '2026-08-18T00:00:00.000Z',
    callingComponent: 'ai-router',
    input: { text: 'upgrade to 0.2.0' },
    ...overrides,
  };
}

function makeTarget(overrides: Partial<UpgradeTarget> = {}): UpgradeTarget {
  return {
    version: '0.2.0',
    compatibility: { minimumApiVersion: '0.1.0', currentApiVersion: '0.1.0', compatible: true },
    requiredMigrations: [1, 2],
    metadata: { stage: 'beta', releaseNotes: 'release-notes/0.2.0.md' },
    ...overrides,
  };
}

function makeTargetWithMetadata(metadata: ReleaseMetadata): UpgradeTarget {
  return { ...makeTarget(), metadata };
}

function makeVersionService(overrides: Partial<UpgradeVersionService> = {}): UpgradeVersionService {
  return {
    getRuntimeVersion: () => ({ runtimeVersion: '0.1.0', apiVersion: '0.1.0' }),
    getCompatibility: () => ({
      minimumApiVersion: '0.1.0',
      currentApiVersion: '0.1.0',
      compatible: true,
    }),
    ...overrides,
  };
}

function makeRegistry(
  category: 'always-allowed' | 'confirmation-required' | 'restricted' | 'denied',
  action: string = PLAN_ACTION,
): InMemoryPermissionRegistry {
  const registry = new InMemoryPermissionRegistry();
  registry.register({
    id: 'policy-1',
    caller: UPGRADE_MANAGER_CALLER,
    action,
    resource: UPGRADE_RESOURCE,
    category,
  });
  return registry;
}

function makeDecision(action: string): PermissionDecision {
  return {
    action,
    resource: UPGRADE_RESOURCE,
    category: 'always-allowed',
    permitted: true,
    status: 'approved',
  };
}

function makeManager(options: Partial<UpgradeManagerOptions> = {}): UpgradeManager {
  return new UpgradeManager({
    versionService: makeVersionService(),
    permissionEvaluator: new DefaultPermissionEvaluator(makeRegistry('always-allowed')),
    ...options,
  });
}

describe('UpgradeManager request validation', () => {
  it('returns a success envelope for a valid request', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.status).toBe('success');
    expect(response.result).not.toBeNull();
    expect(response.error).toBeNull();
  });

  it('rejects a request with an empty requestId', () => {
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>();
    const manager = new UpgradeManager({
      versionService: makeVersionService(),
      permissionEvaluator: { evaluate },
    });
    const response = manager.plan(makeRequest({ requestId: '  ' }), makeTarget());
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade request');
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('rejects a request with an empty timestamp', () => {
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>();
    const manager = new UpgradeManager({
      versionService: makeVersionService(),
      permissionEvaluator: { evaluate },
    });
    const response = manager.plan(makeRequest({ timestamp: '  ' }), makeTarget());
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade request');
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('rejects a request with an empty callingComponent', () => {
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>();
    const manager = new UpgradeManager({
      versionService: makeVersionService(),
      permissionEvaluator: { evaluate },
    });
    const response = manager.plan(makeRequest({ callingComponent: '  ' }), makeTarget());
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade request');
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('generates a traceId when none is provided', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('preserves the provided traceId', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.traceId).toBe('trace-1');
  });

  it('forwards authContext to the permission request', () => {
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>(() => makeDecision(PLAN_ACTION));
    const manager = new UpgradeManager({
      versionService: makeVersionService(),
      permissionEvaluator: { evaluate },
    });
    manager.plan(makeRequest({ authContext: 'user-1', traceId: 'trace-1' }), makeTarget());
    expect(evaluate).toHaveBeenCalledWith({
      action: PLAN_ACTION,
      resource: UPGRADE_RESOURCE,
      caller: UPGRADE_MANAGER_CALLER,
      requestId: 'trace-1',
      timestamp: '2026-08-18T00:00:00.000Z',
      authContext: 'user-1',
    });
  });
});

describe('UpgradeManager target validation', () => {
  it('accepts a valid semantic version', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget({ version: '1.4.2' }));
    expect(response.status).toBe('success');
  });

  it('rejects an invalid semantic version', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget({ version: '1.0' }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade target');
  });

  it('rejects a malformed semantic version', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget({ version: '0.2.0-beta_1' }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade target');
  });

  it('accepts a valid release stage', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.status).toBe('success');
  });

  it('rejects an invalid release stage', () => {
    const manager = makeManager();
    const target = makeTargetWithMetadata({ stage: 'stable2' as ReleaseMetadata['stage'] });
    const response = manager.plan(makeRequest(), target);
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade target');
  });

  it('requires the target metadata stage', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTargetWithMetadata({ stage: 'rc' }));
    expect(response.status).toBe('success');
  });

  it('rejects negative migration identifiers', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget({ requiredMigrations: [1, -1] }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade target');
  });

  it('rejects non-integer migration identifiers', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget({ requiredMigrations: [1, 1.5] }));
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade target');
  });

  it('rejects a target that contradicts the requested reference', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest({ target: { version: '9.9.9' } }), makeTarget());
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('upgrade target mismatch');
  });

  it('treats integrity as opaque data without validating it', () => {
    const manager = makeManager();
    const integrity = { algorithm: 'sha-256', digest: 'abc' };
    const target = makeTarget({ metadata: { ...makeTarget().metadata, integrity } });
    const response = manager.plan(makeRequest(), target);
    expect(response.status).toBe('success');
    expect(response.result?.compatibility.missingMigrations).toEqual([1, 2]);
  });

  it('treats rollback source as opaque data without resolving it', () => {
    const manager = makeManager();
    const target = makeTarget({
      metadata: { ...makeTarget().metadata, rollbackSource: 'backup/0.1.0' },
    });
    const response = manager.plan(makeRequest(), target);
    expect(response.status).toBe('success');
  });

  it('does not mutate the supplied target', () => {
    const manager = makeManager();
    const target = makeTarget({
      metadata: { ...makeTarget().metadata, integrity: { token: 'abc' } },
    });
    const before = JSON.stringify(target);
    manager.plan(makeRequest(), target);
    expect(JSON.stringify(target)).toBe(before);
  });
});

describe('UpgradeManager compatibility inspection', () => {
  it('reports a compatible target when the runtime API satisfies the minimum', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.compatibility.compatible).toBe(true);
  });

  it('reports an incompatible target when the runtime API is below the minimum', () => {
    const service = makeVersionService({
      getRuntimeVersion: () => ({ runtimeVersion: '0.1.0', apiVersion: '0.1.0' }),
    });
    const manager = makeManager({ versionService: service });
    const response = manager.plan(
      makeRequest(),
      makeTarget({
        compatibility: { minimumApiVersion: '2.0.0', currentApiVersion: '0.1.0', compatible: true },
      }),
    );
    expect(response.result?.compatibility.compatible).toBe(false);
  });

  it('compares API versions across minor versions', () => {
    const service = makeVersionService({
      getRuntimeVersion: () => ({ runtimeVersion: '0.1.0', apiVersion: '1.2.0' }),
    });
    const manager = makeManager({ versionService: service });
    const compatible = manager.plan(
      makeRequest(),
      makeTarget({
        compatibility: { minimumApiVersion: '1.2.0', currentApiVersion: '1.2.0', compatible: true },
      }),
    );
    const incompatible = manager.plan(
      makeRequest(),
      makeTarget({
        compatibility: { minimumApiVersion: '1.3.0', currentApiVersion: '1.2.0', compatible: true },
      }),
    );
    expect(compatible.result?.compatibility.compatible).toBe(true);
    expect(incompatible.result?.compatibility.compatible).toBe(false);
  });

  it('reports the current runtime version', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.compatibility.currentRuntimeVersion).toBe('0.1.0');
  });

  it('reports the current API version and target minimum', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.compatibility.currentApiVersion).toBe('0.1.0');
    expect(response.result?.compatibility.minimumApiVersion).toBe('0.1.0');
  });

  it('reports the target version', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.compatibility.targetVersion).toBe('0.2.0');
  });

  it('fails compatibility when the current compatibility assessment is negative', () => {
    const service = makeVersionService({
      getCompatibility: () => ({
        minimumApiVersion: '0.1.0',
        currentApiVersion: '0.1.0',
        compatible: false,
      }),
    });
    const manager = makeManager({ versionService: service });
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.compatibility.compatible).toBe(false);
  });

  it('represents required migrations from the target', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.compatibility.requiredMigrations).toEqual([1, 2]);
  });

  it('computes missing migrations from the current schema version', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget(), 1);
    expect(response.result?.compatibility.missingMigrations).toEqual([2]);
  });

  it('reports all migrations as missing when the schema version is below them', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget(), 0);
    expect(response.result?.compatibility.missingMigrations).toEqual([1, 2]);
  });

  it('reports no missing migrations when all are applied', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget(), 2);
    expect(response.result?.compatibility.missingMigrations).toEqual([]);
  });
});

describe('UpgradeManager planning', () => {
  it('produces a pure plan with the correct target', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.status).toBe('success');
    expect(response.result?.targetVersion).toBe('0.2.0');
  });

  it('embeds the compatibility result in the plan', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.compatibility).toMatchObject({
      targetVersion: '0.2.0',
      compatible: true,
      requiredMigrations: [1, 2],
    });
  });

  it('embeds the required migration information in the plan', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget(), 1);
    expect(response.result?.compatibility.missingMigrations).toEqual([2]);
  });

  it('represents confirmation as not required for planning', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.confirmationRequired).toBe(false);
  });

  it('embeds the locked lifecycle stages in the plan', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.stages).toEqual(LOCKED_PLAN_STAGES);
  });

  it('carries no executable actions', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.actions).toEqual([]);
    expect(JSON.parse(JSON.stringify(response.result))).toEqual(response.result);
  });

  it('does not mutate the request input', () => {
    const manager = makeManager();
    const request = makeRequest({ input: { text: 'upgrade to 0.2.0', secret: 'abc' } });
    const before = JSON.stringify(request);
    manager.plan(request, makeTarget());
    expect(JSON.stringify(request)).toBe(before);
  });
});

describe('UpgradeManager permission mapping', () => {
  it('succeeds when the upgrade:plan policy allows the request', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.status).toBe('success');
  });

  it('fails closed when no policy exists for the request', () => {
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());
    const manager = makeManager({ permissionEvaluator: evaluator });
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.status).toBe('error');
    expect(response.error).toEqual({
      code: 'internal-error',
      message: 'upgrade planning permission denied',
      traceId: 'trace-1',
    });
  });

  it('fails closed when the policy category is denied', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('denied'));
    const manager = makeManager({ permissionEvaluator: evaluator });
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('upgrade planning permission denied');
  });

  it('fails closed when the evaluator throws', () => {
    const evaluator: PermissionEvaluator = {
      evaluate: vi.fn<PermissionEvaluator['evaluate']>(() => {
        throw new Error('boom');
      }),
    };
    const manager = makeManager({ permissionEvaluator: evaluator });
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.status).toBe('error');
    expect(response.error).toEqual({
      code: 'internal-error',
      message: 'unexpected upgrade manager failure',
      traceId: 'trace-1',
    });
  });

  it('maps the apply boundary to a confirmation-required result without executing', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed', APPLY_ACTION));
    const manager = makeManager({ permissionEvaluator: evaluator });
    const boundary = manager.applyBoundary(makeRequest({ traceId: 'trace-1' }));
    expect(boundary).toEqual({
      action: APPLY_ACTION,
      resource: UPGRADE_RESOURCE,
      confirmation: 'required',
      permitted: true,
    });
  });

  it('returns an unpermitted apply boundary when the apply policy denies', () => {
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());
    const manager = makeManager({ permissionEvaluator: evaluator });
    const boundary = manager.applyBoundary(makeRequest({ traceId: 'trace-1' }));
    expect(boundary.action).toBe(APPLY_ACTION);
    expect(boundary.resource).toBe(UPGRADE_RESOURCE);
    expect(boundary.confirmation).toBe('required');
    expect(boundary.permitted).toBe(false);
  });

  it('exposes no execution surface from the apply boundary', () => {
    const manager = makeManager();
    const boundary = manager.applyBoundary(makeRequest());
    expect(Object.keys(boundary)).toEqual(['action', 'resource', 'confirmation', 'permitted']);
  });

  it('returns an unpermitted apply boundary for an invalid request', () => {
    const sink = new InMemoryAuditSink();
    const evaluate = vi.fn<PermissionEvaluator['evaluate']>();
    const manager = new UpgradeManager({
      versionService: makeVersionService(),
      permissionEvaluator: { evaluate },
      auditSink: sink,
    });
    const boundary = manager.applyBoundary(makeRequest({ requestId: '  ' }));
    expect(boundary).toEqual({
      action: APPLY_ACTION,
      resource: UPGRADE_RESOURCE,
      confirmation: 'required',
      permitted: false,
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(sink.query({})).toHaveLength(1);
    expect(sink.query({})[0]?.outcome).toBe('error');
  });

  it('fails closed when the apply evaluator throws', () => {
    const sink = new InMemoryAuditSink();
    const evaluator: PermissionEvaluator = {
      evaluate: vi.fn<PermissionEvaluator['evaluate']>(() => {
        throw new Error('boom');
      }),
    };
    const manager = new UpgradeManager({
      versionService: makeVersionService(),
      permissionEvaluator: evaluator,
      auditSink: sink,
    });
    const boundary = manager.applyBoundary(makeRequest({ traceId: 'trace-1' }));
    expect(boundary).toEqual({
      action: APPLY_ACTION,
      resource: UPGRADE_RESOURCE,
      confirmation: 'required',
      permitted: false,
    });
    expect(sink.query({})).toHaveLength(1);
    expect(sink.query({})[0]?.outcome).toBe('error');
  });

  it('does not trigger apply execution from planning', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed'));
    const manager = makeManager({ permissionEvaluator: evaluator });
    const evaluateSpy = vi.spyOn(evaluator, 'evaluate');
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.result?.actions).toEqual([]);
    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: PLAN_ACTION, resource: UPGRADE_RESOURCE }),
    );
  });
});

describe('UpgradeManager confirmation representation', () => {
  it('represents planning as not requiring confirmation', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest(), makeTarget());
    expect(response.result?.confirmationRequired).toBe(false);
  });

  it('represents apply as requiring confirmation', () => {
    const manager = makeManager();
    const boundary = manager.applyBoundary(makeRequest());
    expect(boundary.confirmation).toBe('required');
  });

  it('never produces a confirmed status from a voice-like context', () => {
    const evaluator = new DefaultPermissionEvaluator(
      makeRegistry('confirmation-required', APPLY_ACTION),
    );
    const manager = makeManager({ permissionEvaluator: evaluator });
    const boundary = manager.applyBoundary(makeRequest({ authContext: 'voice:session-1' }));
    expect(boundary.confirmation).toBe('required');
    expect(boundary.confirmation).not.toBe('confirmed');
    expect(boundary.permitted).toBe(false);
  });

  it('never auto-confirms apply with an authenticated context', () => {
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed', APPLY_ACTION));
    const manager = makeManager({ permissionEvaluator: evaluator });
    const boundary = manager.applyBoundary(makeRequest({ authContext: 'user-1' }));
    expect(boundary.confirmation).toBe('required');
    expect(boundary.permitted).toBe(true);
  });
});

describe('UpgradeManager audit', () => {
  it('audits a plan success with the locked mapping and a single entry', () => {
    const sink = new InMemoryAuditSink();
    const manager = makeManager({ auditSink: sink });
    manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    const entries = sink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: UPGRADE_MANAGER_CALLER,
      action: PLAN_ACTION,
      resource: UPGRADE_RESOURCE,
      outcome: 'success',
      requestId: 'trace-1',
      metadata: {},
    });
  });

  it('audits a plan denial with outcome denied', () => {
    const sink = new InMemoryAuditSink();
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());
    const manager = makeManager({ permissionEvaluator: evaluator, auditSink: sink });
    manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    const entries = sink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('denied');
    expect(entries[0]?.requestId).toBe('trace-1');
  });

  it('audits a validation failure with outcome error', () => {
    const sink = new InMemoryAuditSink();
    const manager = makeManager({ auditSink: sink });
    manager.plan(makeRequest({ requestId: '  ' }), makeTarget());
    const entries = sink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('error');
  });

  it('audits the apply boundary with the locked apply action', () => {
    const sink = new InMemoryAuditSink();
    const evaluator = new DefaultPermissionEvaluator(makeRegistry('always-allowed', APPLY_ACTION));
    const manager = makeManager({ permissionEvaluator: evaluator, auditSink: sink });
    manager.applyBoundary(makeRequest({ traceId: 'trace-1' }));
    const entries = sink.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe(APPLY_ACTION);
    expect(entries[0]?.outcome).toBe('success');
    expect(entries[0]?.requestId).toBe('trace-1');
  });

  it('keeps audit entries content-free', () => {
    const sink = new InMemoryAuditSink();
    const manager = makeManager({ auditSink: sink });
    manager.plan(makeRequest({ input: { token: 'super-secret-value' } }), makeTarget());
    const entries = sink.query({});
    expect(JSON.stringify(entries)).not.toContain('super-secret-value');
    expect(entries[0]?.metadata).toEqual({});
  });

  it('tolerates a missing audit sink', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.status).toBe('success');
  });
});

describe('UpgradeManager result envelope', () => {
  it('returns the compatible success envelope', () => {
    const manager = makeManager();
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.status).toBe('success');
    expect(response.result).not.toBeNull();
    expect(response.error).toBeNull();
    expect(response.executionTimeMs).toBeTypeOf('number');
    expect(response.version).toBe(API_VERSION);
    expect(response.traceId).toBe('trace-1');
  });

  it('preserves the traceId in a denied result', () => {
    const evaluator = new DefaultPermissionEvaluator(new InMemoryPermissionRegistry());
    const manager = makeManager({ permissionEvaluator: evaluator });
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.status).toBe('error');
    expect(response.error).toEqual({
      code: 'internal-error',
      message: 'upgrade planning permission denied',
      traceId: 'trace-1',
    });
    expect(response.traceId).toBe('trace-1');
  });

  it('preserves the traceId in a validation error', () => {
    const manager = makeManager();
    const response = manager.plan(
      makeRequest({ traceId: 'trace-1', requestId: '  ' }),
      makeTarget(),
    );
    expect(response.status).toBe('error');
    expect(response.error?.message).toBe('invalid upgrade request');
    expect(response.error?.traceId).toBe('trace-1');
  });

  it('returns the generic error code for internal failures', () => {
    const evaluator: PermissionEvaluator = {
      evaluate: vi.fn<PermissionEvaluator['evaluate']>(() => {
        throw new Error('boom');
      }),
    };
    const manager = makeManager({ permissionEvaluator: evaluator });
    const response = manager.plan(makeRequest({ traceId: 'trace-1' }), makeTarget());
    expect(response.error?.code).toBe('internal-error');
    expect(response.error?.message).toBe('unexpected upgrade manager failure');
  });
});
