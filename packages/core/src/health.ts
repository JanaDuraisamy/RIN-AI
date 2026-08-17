import type {
  HealthState,
  RuntimeHealthStatus,
  RuntimeHealthSummary,
  RuntimeState,
  ServiceHealthStatus,
  ServiceHealthStatusValue,
} from '@rin/types';

export class HealthMonitor {
  private stateValue: RuntimeState = 'created';
  private healthStateValue: HealthState = 'startup';
  private startupVerifiedValue = false;
  private lastTransitionAtValue = new Date().toISOString();
  private readonly services = new Map<string, ServiceHealthStatus>();

  setRuntimeState(state: RuntimeState): void {
    this.stateValue = state;
    this.lastTransitionAtValue = new Date().toISOString();
  }

  setHealthState(healthState: HealthState): void {
    this.healthStateValue = healthState;
    this.lastTransitionAtValue = new Date().toISOString();
  }

  setStartupVerified(verified: boolean): void {
    this.startupVerifiedValue = verified;
  }

  registerService(name: string): void {
    if (!this.services.has(name)) {
      this.services.set(name, {
        name,
        status: 'not-started',
        lastCheckedAt: new Date().toISOString(),
      });
    }
  }

  setServiceStatus(
    name: string,
    status: ServiceHealthStatusValue,
    details?: Record<string, unknown>,
  ): void {
    const entry: ServiceHealthStatus = {
      name,
      status,
      lastCheckedAt: new Date().toISOString(),
    };
    if (details !== undefined) {
      entry.details = details;
    }
    this.services.set(name, entry);
  }

  getStatus(): RuntimeHealthStatus {
    return {
      state: this.stateValue,
      healthState: this.healthStateValue,
      services: Object.fromEntries(this.services),
      lastTransitionAt: this.lastTransitionAtValue,
    };
  }

  getSummary(): RuntimeHealthSummary {
    let healthyServices = 0;
    let degradedServices = 0;
    let unhealthyServices = 0;
    for (const entry of this.services.values()) {
      if (entry.status === 'healthy') {
        healthyServices += 1;
      } else if (entry.status === 'degraded') {
        degradedServices += 1;
      } else if (entry.status === 'unhealthy') {
        unhealthyServices += 1;
      }
    }
    return {
      state: this.stateValue,
      healthState: this.healthStateValue,
      totalServices: this.services.size,
      healthyServices,
      degradedServices,
      unhealthyServices,
      startupVerified: this.startupVerifiedValue,
      ready:
        this.startupVerifiedValue && (this.stateValue === 'ready' || this.stateValue === 'running'),
      lastTransitionAt: this.lastTransitionAtValue,
    };
  }
}
