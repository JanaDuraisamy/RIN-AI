import { describe, expect, it } from 'vitest';

import type { CoreApiRequest } from '@rin/types';

import { RequestRouter } from './index.js';

function buildRequest(callingComponent: string): CoreApiRequest {
  return {
    requestId: 'req-1',
    timestamp: new Date().toISOString(),
    callingComponent,
    apiVersion: '0.1.0',
  };
}

describe('RequestRouter', () => {
  it('registers and dispatches handlers', async () => {
    const router = new RequestRouter();

    router.register('test.method', (request) => ({
      requestId: request.requestId,
      hits: 1,
    }));

    const response = await router.dispatch(buildRequest('test.method'));

    expect(response.status).toBe('success');
    expect(response.result).toEqual({ requestId: 'req-1', hits: 1 });
    expect(response.error).toBeNull();
    expect(response.version).toBe('0.1.0');
    expect(response.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns METHOD_NOT_FOUND for unregistered components', async () => {
    const router = new RequestRouter();

    const response = await router.dispatch(buildRequest('unknown.method'));

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('METHOD_NOT_FOUND');
    expect(response.error?.message).toBe("No handler registered for 'unknown.method'");
    expect(response.error?.traceId).toBeTruthy();
    expect(response.result).toBeNull();
  });

  it('returns METHOD_ERROR when a handler throws', async () => {
    const router = new RequestRouter();

    router.register('flaky.method', () => {
      throw new Error('handler failed');
    });

    const response = await router.dispatch(buildRequest('flaky.method'));

    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('METHOD_ERROR');
    expect(response.error?.message).toBe('handler failed');
    expect(response.error?.traceId).toBeTruthy();
  });

  it('awaits async handlers', async () => {
    const router = new RequestRouter();

    router.register('async.method', async () => {
      await Promise.resolve();
      return { done: true };
    });

    const response = await router.dispatch(buildRequest('async.method'));

    expect(response.status).toBe('success');
    expect(response.result).toEqual({ done: true });
  });

  it('passes payloads to handlers', async () => {
    const router = new RequestRouter();

    router.register('echo.method', (_request, payload) => payload);

    const response = await router.dispatch(buildRequest('echo.method'), {
      value: 42,
    });

    expect(response.result).toEqual({ value: 42 });
  });

  it('supports unregister, has, and listComponents', () => {
    const router = new RequestRouter();

    router.register('a.method', () => undefined);
    router.register('b.method', () => undefined);

    expect(router.has('a.method')).toBe(true);
    expect(router.listComponents()).toEqual(['a.method', 'b.method']);

    expect(router.unregister('a.method')).toBe(true);
    expect(router.has('a.method')).toBe(false);
    expect(router.unregister('a.method')).toBe(false);
  });

  it('replaces an existing handler on re-registration', async () => {
    const router = new RequestRouter();

    router.register('test.method', () => 'first');
    router.register('test.method', () => 'second');

    const response = await router.dispatch(buildRequest('test.method'));

    expect(response.result).toBe('second');
  });
});
