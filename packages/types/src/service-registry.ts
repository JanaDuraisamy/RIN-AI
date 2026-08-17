export interface ServiceDescriptor {
  name: string;
  version: string;
  instance: unknown;
  dependencies?: string[];
}

export type DependencyValidationResult =
  { status: 'valid' } | { status: 'invalid'; missingDependencies: string[] };

export interface ServiceRegistry {
  register(descriptor: ServiceDescriptor): void;
  resolve<T>(name: string): T;
  remove(name: string): void;
  list(): ServiceDescriptor[];
  validateDependencies(): DependencyValidationResult;
  has(name: string): boolean;
}

export type ServiceRegistryErrorCode =
  'duplicate-service' | 'service-not-found' | 'missing-dependency';

export class ServiceRegistryError extends Error {
  readonly code: ServiceRegistryErrorCode;

  constructor(code: ServiceRegistryErrorCode, message: string) {
    super(message);
    this.name = 'ServiceRegistryError';
    this.code = code;
  }
}
