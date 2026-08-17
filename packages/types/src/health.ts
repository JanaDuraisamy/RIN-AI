import type { HealthState, RuntimeState } from './runtime.js';

export type ServiceHealthStatusValue = 'healthy' | 'degraded' | 'unhealthy' | 'not-started';

export interface ServiceHealthStatus {
  name: string;
  status: ServiceHealthStatusValue;
  lastCheckedAt: string;
  details?: Record<string, unknown>;
}

export interface RuntimeHealthStatus {
  state: RuntimeState;
  healthState: HealthState;
  services: Record<string, ServiceHealthStatus>;
  lastTransitionAt: string;
}

export interface RuntimeHealthSummary {
  state: RuntimeState;
  healthState: HealthState;
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  unhealthyServices: number;
  startupVerified: boolean;
  ready: boolean;
  lastTransitionAt: string;
}
