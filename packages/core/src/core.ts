import {
  ServiceRegistryError,
  type CompatibilityInfo,
  type EventBus,
  type MemoryEngine,
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

export interface RinCoreOptions {
  eventBus: EventBus;
  configuration?: ConfigurationService;
  memoryEngine?: MemoryEngine;
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

  private initialized = false;

  constructor(options: RinCoreOptions) {
    this.eventBus = options.eventBus;
    this.configuration = options.configuration ?? new ConfigurationService();
    this.memoryEngine = options.memoryEngine ?? null;
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
