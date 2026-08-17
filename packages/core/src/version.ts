import { API_VERSION } from '@rin/types';
import type { CompatibilityInfo, RuntimeVersionInfo } from '@rin/types';

export const RUNTIME_VERSION = '0.1.0';

const MINIMUM_API_VERSION = '0.1.0';

export class VersionService {
  getRuntimeVersion(): RuntimeVersionInfo {
    return {
      runtimeVersion: RUNTIME_VERSION,
      apiVersion: API_VERSION,
    };
  }

  getCompatibility(): CompatibilityInfo {
    return {
      minimumApiVersion: MINIMUM_API_VERSION,
      currentApiVersion: API_VERSION,
      compatible: true,
    };
  }
}
