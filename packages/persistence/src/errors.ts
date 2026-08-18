export type PersistenceErrorCode =
  | 'invalid-entity'
  | 'invalid-migration'
  | 'duplicate'
  | 'not-found'
  | 'denied'
  | 'connection-closed'
  | 'migration-failed'
  | 'corrupt-data';

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
  }
}
