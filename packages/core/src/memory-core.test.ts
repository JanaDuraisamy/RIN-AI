import { describe, expect, it } from 'vitest';

import { InMemoryEventBus } from '@rin/event-bus';
import { MemoryEngine } from '@rin/memory';
import { ServiceRegistryError } from '@rin/types';

import { RinCore } from './index.js';

describe('RinCore memory integration', () => {
  it('registers the memory service and resolves it through the registry', () => {
    const memoryEngine = new MemoryEngine();
    const core = new RinCore({ eventBus: new InMemoryEventBus(), memoryEngine });
    core.initialize();

    const resolved = core.getService<MemoryEngine>('memory');
    expect(resolved).toBe(memoryEngine);
    expect(core.listServices().some((service) => service.name === 'memory')).toBe(true);
  });

  it('marks the memory service as healthy in the health summary', () => {
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      memoryEngine: new MemoryEngine(),
    });
    core.initialize();

    const summary = core.getHealthSummary();
    expect(summary.totalServices).toBe(4);
    expect(summary.healthyServices).toBe(4);
  });

  it('does not register a memory service when no engine is provided', () => {
    const core = new RinCore({ eventBus: new InMemoryEventBus() });
    core.initialize();

    expect(core.listServices().some((service) => service.name === 'memory')).toBe(false);
    expect(() => core.getService('memory')).toThrow(ServiceRegistryError);
  });

  it('supports memory operations through the resolved service', async () => {
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      memoryEngine: new MemoryEngine(),
    });
    core.initialize();

    const memory = core.getService<MemoryEngine>('memory');
    const created = await memory.createMemory({
      title: 'Integration note',
      content: 'Created through the resolved memory service',
      source: 'core-test',
    });

    expect(created.status).toBe('success');
    expect(created.result?.title).toBe('Integration note');
    expect(created.result?.archivedAt).toBeNull();

    const retrieved = await memory.getMemory(created.result?.id ?? 'missing');
    expect(retrieved.status).toBe('success');
    expect(retrieved.result?.id).toBe(created.result?.id);
  });

  it('keeps memory service registration stable across restart', () => {
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      memoryEngine: new MemoryEngine(),
    });
    core.initialize();
    core.startServices();

    core.restart();

    const resolved = core.getService<MemoryEngine>('memory');
    expect(resolved).toBeInstanceOf(MemoryEngine);
    expect(core.getHealthSummary().ready).toBe(true);
  });
});
