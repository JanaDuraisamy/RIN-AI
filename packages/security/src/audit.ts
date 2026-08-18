import type { AuditEntry, AuditOutcome, AuditQuery, AuditSink } from '@rin/types';

export class InMemoryAuditSink implements AuditSink {
  private readonly entries: AuditEntry[] = [];

  append(entry: AuditEntry): void {
    if (!isValidEntry(entry)) {
      throw new Error('invalid audit entry');
    }
    this.entries.push({ ...entry, metadata: { ...entry.metadata } });
  }

  query(filter: AuditQuery): AuditEntry[] {
    return this.entries
      .filter(
        (entry) =>
          (filter.action === undefined || entry.action === filter.action) &&
          (filter.resource === undefined || entry.resource === filter.resource) &&
          (filter.actor === undefined || entry.actor === filter.actor) &&
          (filter.outcome === undefined || entry.outcome === filter.outcome) &&
          (filter.requestId === undefined || entry.requestId === filter.requestId) &&
          (filter.correlationId === undefined || entry.correlationId === filter.correlationId),
      )
      .map((entry) => ({ ...entry, metadata: { ...entry.metadata } }));
  }
}

function isValidEntry(entry: AuditEntry): boolean {
  return (
    entry.id.trim() !== '' &&
    entry.actor.trim() !== '' &&
    entry.action.trim() !== '' &&
    entry.resource.trim() !== '' &&
    entry.timestamp.trim() !== '' &&
    isAuditOutcome(entry.outcome)
  );
}

function isAuditOutcome(value: string): value is AuditOutcome {
  return value === 'success' || value === 'denied' || value === 'error';
}
