import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  ServiceRegistryError,
  type AIRouter,
  type AuditOutcome,
  type AuditSink,
  type CompatibilityInfo,
  type CoreApiResponse,
  type EventBus,
  type MemoryEngine,
  type PermissionDecision,
  type PermissionEvaluator,
  type PermissionRegistry,
  type PermissionRequest,
  type RuntimeHealthStatus,
  type RuntimeHealthSummary,
  type RuntimeVersionInfo,
  type ServiceDescriptor,
} from '@rin/types';

import { ConfigurationService } from './configuration.js';
import { ErrorCoordinator, type ErrorClassifier, type RetryPolicy } from './error-recovery.js';
import { HealthMonitor } from './health.js';
import { RuntimeLifecycle } from './lifecycle.js';
import { RequestRouter } from './request-router.js';
import { InMemoryServiceRegistry } from './service-registry.js';
import { RuntimeStateMachine, StateError } from './runtime-state.js';
import { RUNTIME_VERSION, VersionService } from './version.js';

const RESTART_ACTION = 'core:restart';
const RESTART_RESOURCE = 'runtime';
const GENERIC_ERROR_CODE = 'internal-error';

export interface RestartRequest {
  requestId: string;
  timestamp: string;
  callingComponent: string;
  authContext?: string;
  traceId?: string;
}

export type RestartResult = CoreApiResponse<null>;

function isValidRestartRequest(request: RestartRequest): boolean {
  return (
    request.requestId.trim() !== '' &&
    request.timestamp.trim() !== '' &&
    request.callingComponent.trim() !== ''
  );
}

export interface RinCoreOptions {
  eventBus: EventBus;
  configuration?: ConfigurationService;
  memoryEngine?: MemoryEngine;
  permissionEvaluator?: PermissionEvaluator;
  permissionRegistry?: PermissionRegistry;
  auditSink?: AuditSink;
  aiRouter?: AIRouter;
  classifier?: ErrorClassifier;
  retryPolicy?: RetryPolicy;
}

export class RinCore {
  readonly registry: InMemoryServiceRegistry;
  readonly lifecycle: RuntimeLifecycle;
  readonly stateMachine: RuntimeStateMachine;
  readonly health: HealthMonitor;
  readonly configuration: ConfigurationService;
  readonly version: VersionService;
  readonly errorCoordinator: ErrorCoordinator;
  readonly requestRouter: RequestRouter;
  readonly eventBus: EventBus;
  readonly memoryEngine: MemoryEngine | null;
  readonly permissionEvaluator: PermissionEvaluator | null;
  readonly permissionRegistry: PermissionRegistry | null;
  readonly auditSink: AuditSink | null;
  readonly aiRouter: AIRouter | null;

  private initialized = false;

  constructor(options: RinCoreOptions) {
    this.eventBus = options.eventBus;
    this.configuration = options.configuration ?? new ConfigurationService();
    this.memoryEngine = options.memoryEngine ?? null;
    this.permissionEvaluator = options.permissionEvaluator ?? null;
    this.permissionRegistry = options.permissionRegistry ?? null;
    this.auditSink = options.auditSink ?? null;
    this.aiRouter = options.aiRouter ?? null;
    this.registry = new InMemoryServiceRegistry();
    this.lifecycle = new RuntimeLifecycle();
    this.stateMachine = new RuntimeStateMachine();
    this.health = new HealthMonitor();
    this.version = new VersionService();
    this.errorCoordinator = new ErrorCoordinator(options.classifier, options.retryPolicy);
    this.requestRouter = new RequestRouter();
  }

  initialize(): void {
    if (this.initialized) {
      throw new StateError(this.stateMachine.currentState, 'Runtime is already initialized');
    }
    this.stateMachine.transition('initializing');
    this.lifecycle.transition('core-initialization');
    try {
      this.registerCoreServices();
      this.validateCoreServices();
      this.lifecycle.transition('engine-initialization');
      this.lifecycle.transition('runtime-ready');
      this.stateMachine.transition('ready');
      this.health.setRuntimeState('ready');
      this.health.setHealthState('running');
      this.health.setStartupVerified(true);
      this.initialized = true;
    } catch (error) {
      this.enterSafeMode();
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  startServices(): void {
    this.assertInitialized();
    this.stateMachine.transition('running');
    this.lifecycle.transition('active-runtime');
    this.health.setRuntimeState('running');
  }

  stopServices(): void {
    this.assertInitialized();
    this.stateMachine.transition('ready');
    this.health.setRuntimeState('ready');
  }

  shutdown(): void {
    if (this.stateMachine.currentState === 'shutdown') {
      return;
    }
    this.stateMachine.transition('shutdown');
    this.lifecycle.transition('graceful-shutdown');
    this.health.setRuntimeState('shutdown');
    this.health.setHealthState('shutdown');
    this.initialized = false;
  }

  restart(): void {
    this.shutdown();
    this.stateMachine.reset();
    this.lifecycle.reset();
    this.registry.clear();
    this.health.setStartupVerified(false);
    this.initialize();
    this.startServices();
  }

  restartSeam(request: RestartRequest): RestartResult {
    const traceId = request.traceId === undefined ? randomUUID() : request.traceId;
    const startedAt = Date.now();
    const fail = (message: string, code: string, outcome: AuditOutcome): RestartResult => {
      this.auditRestart(traceId, request.callingComponent, outcome);
      return {
        status: 'error',
        result: null,
        error: { code, message, traceId },
        executionTimeMs: Date.now() - startedAt,
        version: API_VERSION,
      };
    };

    if (!isValidRestartRequest(request)) {
      return fail('invalid restart request', GENERIC_ERROR_CODE, 'error');
    }
    if (this.permissionEvaluator === null) {
      return fail('permission evaluation unavailable', 'permission-unavailable', 'error');
    }

    let decision: PermissionDecision;
    try {
      decision = this.permissionEvaluator.evaluate(
        this.buildRestartPermissionRequest(request, traceId),
      );
    } catch {
      return fail('permission evaluation failed', 'permission-unavailable', 'error');
    }

    if (!decision.permitted) {
      if (decision.status === 'confirmation-required') {
        return fail('confirmation required for runtime restart', 'requires-confirmation', 'denied');
      }
      if (decision.status === 'restricted') {
        return fail(
          'runtime restart requires elevated authorization',
          'requires-elevated-authorization',
          'denied',
        );
      }
      return fail('runtime restart permission denied', 'denied', 'denied');
    }

    try {
      this.restart();
    } catch {
      return fail('runtime restart failed', GENERIC_ERROR_CODE, 'error');
    }

    this.auditRestart(traceId, request.callingComponent, 'success');
    return {
      status: 'success',
      result: null,
      error: null,
      executionTimeMs: Date.now() - startedAt,
      version: API_VERSION,
    };
  }

  private buildRestartPermissionRequest(
    request: RestartRequest,
    traceId: string,
  ): PermissionRequest {
    const permission: PermissionRequest = {
      action: RESTART_ACTION,
      resource: RESTART_RESOURCE,
      caller: request.callingComponent,
      requestId: traceId,
      timestamp: request.timestamp,
    };
    if (request.authContext !== undefined) {
      permission.authContext = request.authContext;
    }
    return permission;
  }

  private auditRestart(traceId: string, actor: string, outcome: AuditOutcome): void {
    if (this.auditSink === null) {
      return;
    }
    this.auditSink.append({
      id: randomUUID(),
      actor,
      action: RESTART_ACTION,
      resource: RESTART_RESOURCE,
      timestamp: new Date().toISOString(),
      outcome,
      metadata: {},
      requestId: traceId,
    });
  }

  getRuntimeVersion(): RuntimeVersionInfo {
    return this.version.getRuntimeVersion();
  }

  getCompatibility(): CompatibilityInfo {
    return this.version.getCompatibility();
  }

  getHealthStatus(): RuntimeHealthStatus {
    return this.health.getStatus();
  }

  getHealthSummary(): RuntimeHealthSummary {
    return this.health.getSummary();
  }

  getService<T>(name: string): T {
    return this.registry.resolve<T>(name);
  }

  listServices(): ServiceDescriptor[] {
    return this.registry.list();
  }

  private registerCoreServices(): void {
    this.registry.register({
      name: 'event-bus',
      version: RUNTIME_VERSION,
      instance: this.eventBus,
    });
    this.registry.register({
      name: 'configuration',
      version: RUNTIME_VERSION,
      instance: this.configuration,
    });
    this.registry.register({
      name: 'version',
      version: RUNTIME_VERSION,
      instance: this.version,
    });
    if (this.memoryEngine !== null) {
      this.registry.register({
        name: 'memory',
        version: RUNTIME_VERSION,
        instance: this.memoryEngine,
      });
      this.health.setServiceStatus('memory', 'healthy');
    }
    if (this.permissionEvaluator !== null) {
      this.registry.register({
        name: 'permission',
        version: RUNTIME_VERSION,
        instance: this.permissionEvaluator,
      });
      this.health.setServiceStatus('permission', 'healthy');
    }
    if (this.auditSink !== null) {
      this.registry.register({
        name: 'audit',
        version: RUNTIME_VERSION,
        instance: this.auditSink,
      });
      this.health.setServiceStatus('audit', 'healthy');
    }
    if (this.aiRouter !== null) {
      this.registry.register({
        name: 'ai-router',
        version: RUNTIME_VERSION,
        instance: this.aiRouter,
      });
      this.health.setServiceStatus('ai-router', 'healthy');
    }
    this.health.setServiceStatus('event-bus', 'healthy');
    this.health.setServiceStatus('configuration', 'healthy');
    this.health.setServiceStatus('version', 'healthy');
  }

  private validateCoreServices(): void {
    const result = this.registry.validateDependencies();
    if (result.status === 'invalid') {
      throw new ServiceRegistryError(
        'missing-dependency',
        `Missing dependencies: ${result.missingDependencies.join(', ')}`,
      );
    }
  }

  private enterSafeMode(): void {
    const state = this.stateMachine.currentState;
    if (state !== 'shutdown' && state !== 'safe-mode') {
      this.stateMachine.transition('safe-mode');
    }
    this.health.setRuntimeState('safe-mode');
    this.health.setHealthState('safe-mode');
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new StateError(
        this.stateMachine.currentState,
        'Runtime must be initialized before starting or stopping services',
      );
    }
  }
}
