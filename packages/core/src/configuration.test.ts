import { describe, expect, it } from 'vitest';

import { ConfigurationService } from './index.js';

describe('ConfigurationService', () => {
  it('defaults to development environment from process info', () => {
    const service = new ConfigurationService();
    const environment = service.getEnvironment();

    expect(environment.name).toBe('development');
    expect(environment.nodeVersion).toBe(process.versions.node);
    expect(environment.platform).toBe(process.platform);
    expect(environment.architecture).toBe(process.arch);
  });

  it('accepts partial environment overrides', () => {
    const service = new ConfigurationService({ name: 'production' });
    const environment = service.getEnvironment();

    expect(environment.name).toBe('production');
    expect(environment.nodeVersion).toBe(process.versions.node);
    expect(environment.platform).toBe(process.platform);
  });

  it('stores and retrieves configuration values', () => {
    const service = new ConfigurationService();

    expect(service.has('theme')).toBe(false);

    service.set('theme', 'dark');

    expect(service.has('theme')).toBe(true);
    expect(service.get('theme')).toBe('dark');
    expect(service.get('missing')).toBeUndefined();
  });

  it('manages feature flags', () => {
    const service = new ConfigurationService();

    expect(service.isEnabled('voice')).toBe(false);

    service.enableFlag('voice');
    expect(service.isEnabled('voice')).toBe(true);

    service.disableFlag('voice');
    expect(service.isEnabled('voice')).toBe(false);

    service.setFlag({ key: 'memory', enabled: true });
    expect(service.isEnabled('memory')).toBe(true);

    expect(service.getFlags()).toEqual([
      { key: 'voice', enabled: false },
      { key: 'memory', enabled: true },
    ]);
  });

  it('validates required configuration keys', () => {
    const service = new ConfigurationService();

    service.set('theme', 'dark');

    const result = service.validate(['theme', 'voice']);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Missing required configuration key: voice']);
    expect(result.warnings).toEqual([]);

    expect(service.validate(['theme']).valid).toBe(true);
  });

  it('returns a copy of the environment info', () => {
    const service = new ConfigurationService();
    const first = service.getEnvironment();

    first.name = 'staging';

    expect(service.getEnvironment().name).toBe('development');
  });
});
