import type { RuntimeLifecycleStage } from '@rin/types';

const ALLOWED_TRANSITIONS: Record<RuntimeLifecycleStage, RuntimeLifecycleStage[]> = {
  'system-initialization': ['core-initialization', 'graceful-shutdown'],
  'core-initialization': ['engine-initialization', 'graceful-shutdown'],
  'engine-initialization': ['runtime-ready', 'graceful-shutdown'],
  'runtime-ready': ['active-runtime', 'graceful-shutdown'],
  'active-runtime': ['graceful-shutdown'],
  'graceful-shutdown': [],
};

export class LifecycleError extends Error {
  readonly stage: RuntimeLifecycleStage;

  constructor(stage: RuntimeLifecycleStage, message: string) {
    super(message);
    this.name = 'LifecycleError';
    this.stage = stage;
  }
}

export class RuntimeLifecycle {
  private currentStageValue: RuntimeLifecycleStage = 'system-initialization';
  private readonly stageHistory: RuntimeLifecycleStage[] = ['system-initialization'];

  get currentStage(): RuntimeLifecycleStage {
    return this.currentStageValue;
  }

  get stages(): readonly RuntimeLifecycleStage[] {
    return [...this.stageHistory];
  }

  transition(nextStage: RuntimeLifecycleStage): void {
    const allowed = ALLOWED_TRANSITIONS[this.currentStageValue];
    if (!allowed.includes(nextStage)) {
      throw new LifecycleError(
        this.currentStageValue,
        `Cannot transition from ${this.currentStageValue} to ${nextStage}`,
      );
    }
    this.currentStageValue = nextStage;
    this.stageHistory.push(nextStage);
  }

  isAt(stage: RuntimeLifecycleStage): boolean {
    return this.currentStageValue === stage;
  }

  reset(): void {
    this.currentStageValue = 'system-initialization';
    this.stageHistory.length = 0;
    this.stageHistory.push('system-initialization');
  }
}
