export type RuntimeLifecycleStage =
  | 'system-initialization'
  | 'core-initialization'
  | 'engine-initialization'
  | 'runtime-ready'
  | 'active-runtime'
  | 'graceful-shutdown';

export type RuntimeState =
  'created' | 'initializing' | 'ready' | 'running' | 'safe-mode' | 'shutdown';

export type HealthState = 'startup' | 'running' | 'shutdown' | 'safe-mode' | 'recovery-mode';
