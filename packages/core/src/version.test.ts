import { describe, expect, it } from 'vitest';

import { VersionService } from './index.js';

describe('VersionService', () => {
  it('reports runtime and API versions', () => {
    const service = new VersionService();

    expect(service.getRuntimeVersion()).toEqual({
      runtimeVersion: '0.1.0',
      apiVersion: '0.1.0',
    });
  });

  it('reports API compatibility', () => {
    const service = new VersionService();
    const compatibility = service.getCompatibility();

    expect(compatibility.minimumApiVersion).toBe('0.1.0');
    expect(compatibility.currentApiVersion).toBe('0.1.0');
    expect(compatibility.compatible).toBe(true);
  });
});
