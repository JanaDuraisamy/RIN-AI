import { describe, expect, it } from 'vitest';

import { RuntimeStateMachine, StateError } from './index.js';

describe('RuntimeStateMachine', () => {
  it('starts in the created state', () => {
    const machine = new RuntimeStateMachine();

    expect(machine.currentState).toBe('created');
    expect(machine.states).toEqual(['created']);
    expect(machine.isAt('created')).toBe(true);
  });

  it('follows the runtime state progression', () => {
    const machine = new RuntimeStateMachine();

    machine.transition('initializing');
    machine.transition('ready');
    machine.transition('running');
    machine.transition('safe-mode');
    machine.transition('ready');

    expect(machine.currentState).toBe('ready');
    expect(machine.states).toEqual([
      'created',
      'initializing',
      'ready',
      'running',
      'safe-mode',
      'ready',
    ]);
  });

  it('rejects invalid transitions with a StateError', () => {
    const machine = new RuntimeStateMachine();

    expect(() => machine.transition('running')).toThrow(StateError);
    expect(() => machine.transition('running')).toThrow(
      'Cannot transition from created to running',
    );
  });

  it('allows shutdown from any active state', () => {
    const machine = new RuntimeStateMachine();

    machine.transition('initializing');
    machine.transition('shutdown');

    expect(machine.currentState).toBe('shutdown');
  });

  it('is terminal after shutdown', () => {
    const machine = new RuntimeStateMachine();

    machine.transition('shutdown');

    expect(() => machine.transition('ready')).toThrow(StateError);
  });

  it('resets to the created state', () => {
    const machine = new RuntimeStateMachine();

    machine.transition('initializing');
    machine.transition('ready');
    machine.transition('running');
    machine.reset();

    expect(machine.currentState).toBe('created');
    expect(machine.states).toEqual(['created']);
  });
});
