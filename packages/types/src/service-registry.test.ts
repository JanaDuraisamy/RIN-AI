import { describe, expect, it } from 'vitest';

import { ServiceRegistryError } from './service-registry.js';

describe('ServiceRegistryError', () => {
  it('extends Error with a name and code', () => {
    const error = new ServiceRegistryError('duplicate-service', 'Service already registered');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ServiceRegistryError');
    expect(error.code).toBe('duplicate-service');
    expect(error.message).toBe('Service already registered');
  });
});
