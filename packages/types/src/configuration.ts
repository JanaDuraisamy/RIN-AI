export type EnvironmentName = 'development' | 'staging' | 'production';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  defaultValue?: boolean;
}

export interface EnvironmentInfo {
  name: EnvironmentName;
  nodeVersion: string;
  platform: string;
  architecture: string;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
