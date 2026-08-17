import { describe, expect, it } from 'vitest';

import { LifecycleError, RuntimeLifecycle } from './index.js';

describe('RuntimeLifecycle', () => {
  it('starts at system-initialization', () => {
    const lifecycle = new RuntimeLifecycle();

    expect(lifecycle.currentStage).toBe('system-initialization');
    expect(lifecycle.stages).toEqual(['system-initialization']);
    expect(lifecycle.isAt('system-initialization')).toBe(true);
  });

  it('follows the boot sequence', () => {
    const lifecycle = new RuntimeLifecycle();

    lifecycle.transition('core-initialization');
    lifecycle.transition('engine-initialization');
    lifecycle.transition('runtime-ready');
    lifecycle.transition('active-runtime');

    expect(lifecycle.currentStage).toBe('active-runtime');
    expect(lifecycle.stages).toEqual([
      'system-initialization',
      'core-initialization',
      'engine-initialization',
      'runtime-ready',
      'active-runtime',
    ]);
  });

  it('rejects invalid transitions with a LifecycleError', () => {
    const lifecycle = new RuntimeLifecycle();

    expect(() => lifecycle.transition('active-runtime')).toThrow(LifecycleError);
    expect(() => lifecycle.transition('active-runtime')).toThrow(
      'Cannot transition from system-initialization to active-runtime',
    );
  });

  it('allows graceful shutdown from any stage', () => {
    const lifecycle = new RuntimeLifecycle();

    lifecycle.transition('core-initialization');
    lifecycle.transition('graceful-shutdown');

    expect(lifecycle.currentStage).toBe('graceful-shutdown');
  });

  it('resets to the initial stage', () => {
    const lifecycle = new RuntimeLifecycle();

    lifecycle.transition('core-initialization');
    lifecycle.transition('engine-initialization');
    lifecycle.transition('runtime-ready');
    lifecycle.transition('active-runtime');
    lifecycle.reset();

    expect(lifecycle.currentStage).toBe('system-initialization');
    expect(lifecycle.stages).toEqual(['system-initialization']);
  });
});
