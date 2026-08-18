import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { PersistenceConnection, type PersistenceErrorCode } from './index.js';
import { PersistenceError } from './index.js';

function expectPersistenceError(operation: () => unknown, code: PersistenceErrorCode): void {
  let caught: unknown;
  try {
    operation();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PersistenceError);
  expect((caught as PersistenceError).code).toBe(code);
}

describe('PersistenceConnection', () => {
  it('opens and closes an in-memory connection', () => {
    const connection = new PersistenceConnection();

    expect(connection.isOpen).toBe(false);
    connection.open();
    expect(connection.isOpen).toBe(true);
    connection.close();
    expect(connection.isOpen).toBe(false);
  });

  it('is idempotent when opened or closed repeatedly', () => {
    const connection = new PersistenceConnection();
    connection.open();
    connection.open();
    connection.close();
    connection.close();
    expect(connection.isOpen).toBe(false);
  });

  it('uses an in-memory database by default', () => {
    const connection = new PersistenceConnection();
    connection.open();
    connection.database.exec('CREATE TABLE probe (id TEXT PRIMARY KEY)');
    connection.database.prepare('INSERT INTO probe (id) VALUES (?)').run('a');
    expect(
      connection.database.prepare('SELECT COUNT(*) AS count FROM probe').get()?.['count'],
    ).toBe(1);
    connection.close();
  });

  it('throws connection-closed when accessing the database while closed', () => {
    const connection = new PersistenceConnection();
    expectPersistenceError(() => {
      void connection.database;
    }, 'connection-closed');
  });

  it('persists data across reopen with a file location', () => {
    const location = join(tmpdir(), `rin-persistence-${randomUUID()}.sqlite`);
    try {
      const first = new PersistenceConnection({ location });
      first.open();
      first.database.exec('CREATE TABLE probe (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
      first.database.prepare('INSERT INTO probe (id, value) VALUES (?, ?)').run('a', 'persisted');
      first.close();

      const second = new PersistenceConnection({ location });
      second.open();
      const row = second.database.prepare('SELECT value FROM probe WHERE id = ?').get('a');
      expect(row?.['value']).toBe('persisted');
      second.close();
    } finally {
      try {
        unlinkSync(location);
      } catch {
        // file already removed
      }
    }
  });
});
