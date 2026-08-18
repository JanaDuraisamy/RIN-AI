export type AuditOutcome = 'success' | 'denied' | 'error';

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  outcome: AuditOutcome;
  metadata: Record<string, unknown>;
  requestId?: string;
  correlationId?: string;
}

export interface AuditQuery {
  action?: string;
  resource?: string;
  actor?: string;
  outcome?: AuditOutcome;
  requestId?: string;
  correlationId?: string;
}

export interface AuditSink {
  append(entry: AuditEntry): void;
  query(filter: AuditQuery): AuditEntry[];
}
