import type { HealthState } from '@rin/types';

export type ErrorCategory = 'recoverable' | 'non-recoverable' | 'critical';

export type RecoveryStrategy = 'retry' | 'recover' | 'safe-mode';

export interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
}

export interface RecoveryOutcome {
  strategy: RecoveryStrategy;
  success: boolean;
  attempts: number;
  healthState: HealthState;
}

export interface ErrorClassifier {
  classify(error: unknown): ErrorCategory;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  delayMs: 100,
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class DefaultErrorClassifier implements ErrorClassifier {
  classify(error: unknown): ErrorCategory {
    if (error instanceof Error) {
      if (error.name === 'StateError' || error.name === 'ServiceRegistryError') {
        return 'non-recoverable';
      }
    }
    return 'recoverable';
  }
}

export class ErrorCoordinator {
  private readonly classifier: ErrorClassifier;
  private readonly retryPolicy: RetryPolicy;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    classifier: ErrorClassifier = new DefaultErrorClassifier(),
    retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
    sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {
    this.classifier = classifier;
    this.retryPolicy = retryPolicy;
    this.sleep = sleep;
  }

  async recover(error: unknown, operation: () => void | Promise<void>): Promise<RecoveryOutcome> {
    const category = this.classifier.classify(error);
    const strategy = this.selectStrategy(category);
    const maxAttempts = strategy === 'retry' ? this.retryPolicy.maxAttempts : 1;

    let attempts = 0;
    let lastError: unknown = error;
    while (attempts < maxAttempts && lastError !== undefined) {
      attempts += 1;
      try {
        await operation();
        lastError = undefined;
      } catch (operationError) {
        lastError = operationError;
        if (attempts < maxAttempts) {
          await this.sleep(this.retryPolicy.delayMs);
        }
      }
    }

    const success = lastError === undefined;
    return {
      strategy,
      success,
      attempts,
      healthState: this.resolveHealthState(category, success),
    };
  }

  private selectStrategy(category: ErrorCategory): RecoveryStrategy {
    switch (category) {
      case 'recoverable':
        return 'retry';
      case 'non-recoverable':
        return 'recover';
      case 'critical':
        return 'safe-mode';
    }
  }

  private resolveHealthState(category: ErrorCategory, success: boolean): HealthState {
    if (category === 'critical' || !success) {
      return 'safe-mode';
    }
    return 'running';
  }
}
