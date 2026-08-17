import { describe, expect, it } from 'vitest';

import { API_VERSION } from './index.js';

describe('API versioning', () => {
  it('uses semantic versioning', () => {
    expect(API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('matches the declared package version', () => {
    expect(API_VERSION).toBe('0.1.0');
  });
});
