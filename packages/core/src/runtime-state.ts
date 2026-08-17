import type { RuntimeState } from '@rin/types';

const ALLOWED_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  created: ['initializing', 'shutdown'],
  initializing: ['ready', 'safe-mode', 'shutdown'],
  ready: ['running', 'safe-mode', 'shutdown'],
  running: ['ready', 'safe-mode', 'shutdown'],
  'safe-mode': ['ready', 'shutdown'],
  shutdown: [],
};

export class StateError extends Error {
  readonly state: RuntimeState;

  constructor(state: RuntimeState, message: string) {
    super(message);
    this.name = 'StateError';
    this.state = state;
  }
}

export class RuntimeStateMachine {
  private currentStateValue: RuntimeState = 'created';
  private readonly stateHistory: RuntimeState[] = ['created'];

  get currentState(): RuntimeState {
    return this.currentStateValue;
  }

  get states(): readonly RuntimeState[] {
    return [...this.stateHistory];
  }

  transition(nextState: RuntimeState): void {
    const allowed = ALLOWED_TRANSITIONS[this.currentStateValue];
    if (!allowed.includes(nextState)) {
      throw new StateError(
        this.currentStateValue,
        `Cannot transition from ${this.currentStateValue} to ${nextState}`,
      );
    }
    this.currentStateValue = nextState;
    this.stateHistory.push(nextState);
  }

  isAt(state: RuntimeState): boolean {
    return this.currentStateValue === state;
  }

  reset(): void {
    this.currentStateValue = 'created';
    this.stateHistory.length = 0;
    this.stateHistory.push('created');
  }
}
