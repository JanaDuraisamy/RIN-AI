import { describe, expect, it } from 'vitest';

import { InMemoryEventBus } from '@rin/event-bus';
import { DefaultAIRouter } from '@rin/ai-router';
import { InMemoryAuditSink } from '@rin/security';
import { DefaultPermissionEvaluator, InMemoryPermissionRegistry } from '@rin/security';
import { ServiceRegistryError, type AIRouter } from '@rin/types';

import { RinCore } from './index.js';

function makeRouter(): AIRouter {
  const registry = new InMemoryPermissionRegistry();
  registry.register({
    id: 'router-coordinate',
    caller: 'ai-router',
    action: 'router:coordinate-execution',
    resource: 'router',
    category: 'always-allowed',
  });
  return new DefaultAIRouter({
    permissionEvaluator: new DefaultPermissionEvaluator(registry),
    classifier: { classify: () => ({ intent: 'opaque' }) },
    auditSink: new InMemoryAuditSink(),
  });
}

describe('RinCore AI Router integration', () => {
  it('registers the AI Router service and resolves it through the registry', () => {
    const aiRouter = makeRouter();
    const core = new RinCore({ eventBus: new InMemoryEventBus(), aiRouter });
    core.initialize();

    const resolved = core.getService<AIRouter>('ai-router');
    expect(resolved).toBe(aiRouter);
    expect(core.listServices().some((service) => service.name === 'ai-router')).toBe(true);
  });

  it('marks the AI Router service as healthy in the health summary', () => {
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      aiRouter: makeRouter(),
    });
    core.initialize();

    const summary = core.getHealthSummary();
    expect(summary.totalServices).toBe(4);
    expect(summary.healthyServices).toBe(4);
  });

  it('does not register an AI Router service when none is provided', () => {
    const core = new RinCore({ eventBus: new InMemoryEventBus() });
    core.initialize();

    expect(core.listServices().some((service) => service.name === 'ai-router')).toBe(false);
    expect(() => core.getService('ai-router')).toThrow(ServiceRegistryError);
  });

  it('routes requests through the resolved AI Router service', async () => {
    const core = new RinCore({
      eventBus: new InMemoryEventBus(),
      aiRouter: makeRouter(),
    });
    core.initialize();

    const router = core.getService<AIRouter>('ai-router');
    const response = await router.route({
      requestId: 'req-1',
      timestamp: '2026-08-18T00:00:00.000Z',
      callingComponent: 'voice',
      input: { text: 'hello' },
    });

    expect(response.status).toBe('success');
    expect(response.error).toBeNull();
  });
});
