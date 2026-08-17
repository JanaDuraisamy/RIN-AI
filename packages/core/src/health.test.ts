import { describe, expect, it } from 'vitest';

import { HealthMonitor } from './index.js';

describe('HealthMonitor', () => {
  it('starts in created/startup with no services', () => {
    const monitor = new HealthMonitor();

    expect(monitor.getStatus().state).toBe('created');
    expect(monitor.getStatus().healthState).toBe('startup');
    expect(monitor.getStatus().services).toEqual({});
    expect(monitor.getSummary().startupVerified).toBe(false);
    expect(monitor.getSummary().ready).toBe(false);
  });

  it('tracks runtime and health state transitions', () => {
    const monitor = new HealthMonitor();

    monitor.setRuntimeState('ready');
    monitor.setHealthState('running');

    expect(monitor.getStatus().state).toBe('ready');
    expect(monitor.getStatus().healthState).toBe('running');
  });

  it('tracks service health statuses and summaries', () => {
    const monitor = new HealthMonitor();

    monitor.setServiceStatus('event-bus', 'healthy');
    monitor.setServiceStatus('configuration', 'degraded');
    monitor.setServiceStatus('version', 'unhealthy');

    const status = monitor.getStatus();
    expect(status.services['event-bus']?.status).toBe('healthy');
    expect(status.services['configuration']?.status).toBe('degraded');
    expect(status.services['version']?.status).toBe('unhealthy');

    const summary = monitor.getSummary();
    expect(summary.totalServices).toBe(3);
    expect(summary.healthyServices).toBe(1);
    expect(summary.degradedServices).toBe(1);
    expect(summary.unhealthyServices).toBe(1);
  });

  it('registers services as not-started', () => {
    const monitor = new HealthMonitor();

    monitor.registerService('cache');

    expect(monitor.getStatus().services['cache']?.status).toBe('not-started');
  });

  it('does not override an existing service health entry on register', () => {
    const monitor = new HealthMonitor();

    monitor.setServiceStatus('cache', 'healthy');
    monitor.registerService('cache');

    expect(monitor.getStatus().services['cache']?.status).toBe('healthy');
  });

  it('reports ready only when startup is verified and runtime is ready or running', () => {
    const monitor = new HealthMonitor();

    monitor.setRuntimeState('running');
    monitor.setStartupVerified(true);
    expect(monitor.getSummary().ready).toBe(true);

    monitor.setRuntimeState('safe-mode');
    expect(monitor.getSummary().ready).toBe(false);

    monitor.setRuntimeState('ready');
    monitor.setStartupVerified(false);
    expect(monitor.getSummary().ready).toBe(false);
  });

  it('includes details on service status', () => {
    const monitor = new HealthMonitor();

    monitor.setServiceStatus('event-bus', 'healthy', { subscribers: 2 });

    expect(monitor.getStatus().services['event-bus']?.details).toEqual({
      subscribers: 2,
    });
  });

  it('updates lastTransitionAt on transitions', () => {
    const monitor = new HealthMonitor();
    const before = monitor.getStatus().lastTransitionAt;

    monitor.setHealthState('running');

    const after = monitor.getStatus().lastTransitionAt;
    expect(after >= before).toBe(true);
  });
});
