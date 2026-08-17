import { describe, expect, it } from 'vitest';

import { ServiceRegistryError } from '@rin/types';

import { InMemoryServiceRegistry } from './index.js';

describe('InMemoryServiceRegistry', () => {
  it('registers, resolves, and lists services', () => {
    const registry = new InMemoryServiceRegistry();

    registry.register({ name: 'cache', version: '1.0.0', instance: { hit: 0 } });

    expect(registry.has('cache')).toBe(true);
    expect(registry.resolve<{ hit: number }>('cache').hit).toBe(0);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.name).toBe('cache');
  });

  it('rejects duplicate registrations', () => {
    const registry = new InMemoryServiceRegistry();

    registry.register({ name: 'cache', version: '1.0.0', instance: {} });

    expect(() => registry.register({ name: 'cache', version: '1.0.0', instance: {} })).toThrow(
      ServiceRegistryError,
    );
    expect(() => registry.register({ name: 'cache', version: '1.0.0', instance: {} })).toThrow(
      'already registered',
    );
  });

  it('throws when resolving an unknown service', () => {
    const registry = new InMemoryServiceRegistry();

    expect(() => registry.resolve('missing')).toThrow(ServiceRegistryError);
    expect(() => registry.resolve('missing')).toThrow('not registered');
  });

  it('removes services', () => {
    const registry = new InMemoryServiceRegistry();

    registry.register({ name: 'cache', version: '1.0.0', instance: {} });
    registry.remove('cache');

    expect(registry.has('cache')).toBe(false);
    expect(registry.list()).toHaveLength(0);
  });

  it('validates that all dependencies are registered', () => {
    const registry = new InMemoryServiceRegistry();

    expect(registry.validateDependencies()).toEqual({ status: 'valid' });
  });

  it('reports missing dependencies', () => {
    const registry = new InMemoryServiceRegistry();

    registry.register({
      name: 'reporter',
      version: '1.0.0',
      instance: {},
      dependencies: ['storage', 'cache'],
    });
    registry.register({ name: 'cache', version: '1.0.0', instance: {} });

    const result = registry.validateDependencies();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.missingDependencies).toEqual(['reporter -> storage']);
    }
  });

  it('reports valid when all dependencies are satisfied', () => {
    const registry = new InMemoryServiceRegistry();

    registry.register({
      name: 'reporter',
      version: '1.0.0',
      instance: {},
      dependencies: ['storage'],
    });
    registry.register({ name: 'storage', version: '1.0.0', instance: {} });

    expect(registry.validateDependencies()).toEqual({ status: 'valid' });
  });

  it('clears all services', () => {
    const registry = new InMemoryServiceRegistry();

    registry.register({ name: 'cache', version: '1.0.0', instance: {} });
    registry.clear();

    expect(registry.list()).toHaveLength(0);
  });
});
