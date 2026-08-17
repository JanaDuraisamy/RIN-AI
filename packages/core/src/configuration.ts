import type { ConfigurationValidationResult, EnvironmentInfo, FeatureFlag } from '@rin/types';

export class ConfigurationService {
  private readonly values = new Map<string, unknown>();
  private readonly flags = new Map<string, boolean>();
  private readonly environment: EnvironmentInfo;

  constructor(environment?: Partial<EnvironmentInfo>) {
    this.environment = {
      name: environment?.name ?? 'development',
      nodeVersion: environment?.nodeVersion ?? process.versions.node,
      platform: environment?.platform ?? process.platform,
      architecture: environment?.architecture ?? process.arch,
    };
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  get(key: string): unknown {
    return this.values.get(key);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  setFlag(flag: FeatureFlag): void {
    this.flags.set(flag.key, flag.enabled);
  }

  enableFlag(key: string): void {
    this.flags.set(key, true);
  }

  disableFlag(key: string): void {
    this.flags.set(key, false);
  }

  isEnabled(key: string): boolean {
    return this.flags.get(key) ?? false;
  }

  getFlags(): FeatureFlag[] {
    return [...this.flags].map(([key, enabled]) => ({ key, enabled }));
  }

  validate(requiredKeys: string[]): ConfigurationValidationResult {
    const errors: string[] = [];
    for (const key of requiredKeys) {
      if (!this.values.has(key)) {
        errors.push(`Missing required configuration key: ${key}`);
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  getEnvironment(): EnvironmentInfo {
    return { ...this.environment };
  }
}
