import { DatabaseSync } from 'node:sqlite';

import { PersistenceError } from './errors.js';

export interface PersistenceConnectionOptions {
  location?: string;
}

export class PersistenceConnection {
  private db: DatabaseSync | null = null;
  private readonly location: string;

  constructor(options: PersistenceConnectionOptions = {}) {
    this.location = options.location ?? ':memory:';
  }

  get isOpen(): boolean {
    return this.db !== null;
  }

  get database(): DatabaseSync {
    if (this.db === null) {
      throw new PersistenceError('connection-closed', 'persistence connection is not open');
    }
    return this.db;
  }

  open(): void {
    if (this.db !== null) {
      return;
    }
    this.db = new DatabaseSync(this.location);
  }

  close(): void {
    if (this.db === null) {
      return;
    }
    this.db.close();
    this.db = null;
  }
}
