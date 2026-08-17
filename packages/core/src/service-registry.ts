import type { DependencyValidationResult, ServiceDescriptor, ServiceRegistry } from '@rin/types';
import { ServiceRegistryError } from '@rin/types';

export class InMemoryServiceRegistry implements ServiceRegistry {
  private readonly services = new Map<string, ServiceDescriptor>();

  register(descriptor: ServiceDescriptor): void {
    if (this.services.has(descriptor.name)) {
      throw new ServiceRegistryError(
        'duplicate-service',
        `Service '${descriptor.name}' is already registered`,
      );
    }
    this.services.set(descriptor.name, descriptor);
  }

  resolve<T>(name: string): T {
    const descriptor = this.services.get(name);
    if (descriptor === undefined) {
      throw new ServiceRegistryError('service-not-found', `Service '${name}' is not registered`);
    }
    return descriptor.instance as T;
  }

  remove(name: string): void {
    this.services.delete(name);
  }

  list(): ServiceDescriptor[] {
    return [...this.services.values()];
  }

  validateDependencies(): DependencyValidationResult {
    const missingDependencies: string[] = [];
    for (const descriptor of this.services.values()) {
      for (const dependency of descriptor.dependencies ?? []) {
        if (!this.services.has(dependency)) {
          missingDependencies.push(`${descriptor.name} -> ${dependency}`);
        }
      }
    }
    if (missingDependencies.length === 0) {
      return { status: 'valid' };
    }
    return { status: 'invalid', missingDependencies };
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  clear(): void {
    this.services.clear();
  }
}
