import { describe, expect, it } from 'vitest';

import { ServiceRegistryError } from '@rin/types';

import {
  DEFAULT_RETRY_POLICY,
  DefaultErrorClassifier,
  ErrorCoordinator,
  type ErrorClassifier,
} from './index.js';
import { StateError } from './index.js';

const noopSleep = (): Promise<void> => Promise.resolve();

describe('DefaultErrorClassifier', () => {
  it('classifies generic errors as recoverable', () => {
    const classifier = new DefaultErrorClassifier();

    expect(classifier.classify(new Error('boom'))).toBe('recoverable');
  });

  it('classifies non-Error values as recoverable', () => {
    const classifier = new DefaultErrorClassifier();

    expect(classifier.classify('boom')).toBe('recoverable');
  });

  it('classifies state and registry errors as non-recoverable', () => {
    const classifier = new DefaultErrorClassifier();

    expect(classifier.classify(new StateError('ready', 'bad'))).toBe('non-recoverable');
    expect(classifier.classify(new ServiceRegistryError('service-not-found', 'missing'))).toBe(
      'non-recoverable',
    );
  });
});

describe('ErrorCoordinator', () => {
  it('retries recoverable operations up to the retry policy', async () => {
    let calls = 0;
    const coordinator = new ErrorCoordinator(
      new DefaultErrorClassifier(),
      { maxAttempts: 3, delayMs: 0 },
      noopSleep,
    );

    const outcome = await coordinator.recover(new Error('boom'), () => {
      calls += 1;
      if (calls < 3) {
        throw new Error('transient');
      }
    });

    expect(outcome.success).toBe(true);
    expect(outcome.strategy).toBe('retry');
    expect(outcome.attempts).toBe(3);
    expect(outcome.healthState).toBe('running');
  });

  it('enters safe mode after exhausting retries', async () => {
    const coordinator = new ErrorCoordinator(
      new DefaultErrorClassifier(),
      { maxAttempts: 2, delayMs: 0 },
      noopSleep,
    );

    const outcome = await coordinator.recover(new Error('boom'), () => {
      throw new Error('persistent');
    });

    expect(outcome.success).toBe(false);
    expect(outcome.strategy).toBe('retry');
    expect(outcome.attempts).toBe(2);
    expect(outcome.healthState).toBe('safe-mode');
  });

  it('runs non-recoverable operations once without retrying', async () => {
    let calls = 0;
    const coordinator = new ErrorCoordinator(
      new DefaultErrorClassifier(),
      DEFAULT_RETRY_POLICY,
      noopSleep,
    );

    const outcome = await coordinator.recover(new StateError('running', 'bad'), () => {
      calls += 1;
      throw new Error('still bad');
    });

    expect(outcome.strategy).toBe('recover');
    expect(outcome.success).toBe(false);
    expect(outcome.attempts).toBe(1);
    expect(outcome.healthState).toBe('safe-mode');
    expect(calls).toBe(1);
  });

  it('succeeds on the first attempt without retry', async () => {
    const coordinator = new ErrorCoordinator(
      new DefaultErrorClassifier(),
      { maxAttempts: 3, delayMs: 0 },
      noopSleep,
    );

    const outcome = await coordinator.recover(new Error('initial'), () => undefined);

    expect(outcome.success).toBe(true);
    expect(outcome.strategy).toBe('retry');
    expect(outcome.attempts).toBe(1);
    expect(outcome.healthState).toBe('running');
  });

  it('succeeds with a successful recovery for non-recoverable errors', async () => {
    const coordinator = new ErrorCoordinator(
      new DefaultErrorClassifier(),
      DEFAULT_RETRY_POLICY,
      noopSleep,
    );

    const outcome = await coordinator.recover(new StateError('running', 'bad'), () => undefined);

    expect(outcome.strategy).toBe('recover');
    expect(outcome.success).toBe(true);
    expect(outcome.attempts).toBe(1);
    expect(outcome.healthState).toBe('running');
  });

  it('maps critical errors to safe mode without retries', async () => {
    let calls = 0;
    const criticalClassifier: ErrorClassifier = {
      classify: () => 'critical',
    };
    const coordinator = new ErrorCoordinator(
      criticalClassifier,
      { maxAttempts: 5, delayMs: 0 },
      noopSleep,
    );

    const outcome = await coordinator.recover(new Error('fatal'), () => {
      calls += 1;
      throw new Error('fatal again');
    });

    expect(outcome.strategy).toBe('safe-mode');
    expect(outcome.attempts).toBe(1);
    expect(outcome.healthState).toBe('safe-mode');
    expect(calls).toBe(1);
  });

  it('uses the default retry policy when none is provided', async () => {
    let calls = 0;
    const coordinator = new ErrorCoordinator(new DefaultErrorClassifier());

    const outcome = await coordinator.recover(new Error('boom'), () => {
      calls += 1;
      throw new Error('persistent');
    });

    expect(outcome.strategy).toBe('retry');
    expect(outcome.attempts).toBe(DEFAULT_RETRY_POLICY.maxAttempts);
    expect(calls).toBe(DEFAULT_RETRY_POLICY.maxAttempts);
    expect(outcome.healthState).toBe('safe-mode');
  });
});
