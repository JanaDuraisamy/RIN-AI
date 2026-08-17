import type {
  EventBus,
  EventBusAuditor,
  EventBusMonitor,
  EventBusStats,
  EventDeliveryRecord,
  EventDeliveryStatus,
  EventEnvelope,
  EventFilter,
  EventHandler,
  EventIdGenerator,
  PublishEventInput,
  PublishEventOptions,
  SubscriptionOptions,
} from '@rin/types';

interface SubscriberEntry {
  id: string;
  filter: EventFilter;
  handler: EventHandler;
  priority: number;
}

function createDefaultIdGenerator(): EventIdGenerator {
  let counter = 0;
  return {
    nextId(): string {
      counter += 1;
      const suffix = Math.random().toString(36).slice(2, 10);
      return `${Date.now().toString(36)}-${counter.toString(36)}-${suffix}`;
    },
  };
}

export class InMemoryEventBus implements EventBus {
  private readonly idGenerator: EventIdGenerator;
  private readonly subscribers: SubscriberEntry[] = [];
  private readonly monitors: EventBusMonitor[] = [];
  private readonly auditors: EventBusAuditor[] = [];
  private readonly deadLetterRecords: EventDeliveryRecord[] = [];
  private publishedCount = 0;
  private deliveredCount = 0;
  private failedCount = 0;

  constructor(idGenerator?: EventIdGenerator) {
    this.idGenerator = idGenerator ?? createDefaultIdGenerator();
  }

  async publish(input: PublishEventInput, options?: PublishEventOptions): Promise<EventEnvelope> {
    this.validatePublishInput(input);
    const category = options?.category;
    const priority = this.assertNonNegativeInteger(options?.priority, 'priority');
    const maxDeliveryAttempts = this.assertPositiveInteger(
      options?.maxDeliveryAttempts,
      'maxDeliveryAttempts',
    );

    const envelope: EventEnvelope = {
      eventId: this.idGenerator.nextId(),
      eventType: input.eventType,
      source: input.source,
      timestamp: new Date().toISOString(),
      correlationId: input.correlationId ?? this.idGenerator.nextId(),
      eventVersion: input.eventVersion,
      payload: input.payload,
    };

    this.publishedCount += 1;
    for (const auditor of this.auditors) {
      void auditor.record(envelope);
    }
    for (const monitor of this.monitors) {
      monitor.onPublished?.(envelope);
    }

    const matches = this.subscribers.filter((entry) =>
      this.matches(entry.filter, envelope, category, priority),
    );
    matches.sort((a, b) => b.priority - a.priority);

    for (const subscriber of matches) {
      await this.deliver(subscriber, envelope, maxDeliveryAttempts);
    }

    return envelope;
  }

  subscribe(filter: EventFilter, handler: EventHandler, options?: SubscriptionOptions): string {
    this.validateFilter(filter);
    const entry: SubscriberEntry = {
      id: this.idGenerator.nextId(),
      filter,
      handler,
      priority: this.assertNonNegativeInteger(options?.priority, 'subscription priority'),
    };
    this.subscribers.push(entry);
    return entry.id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const index = this.subscribers.findIndex((entry) => entry.id === subscriptionId);
    if (index === -1) {
      return false;
    }
    this.subscribers.splice(index, 1);
    return true;
  }

  getStats(): EventBusStats {
    return {
      published: this.publishedCount,
      delivered: this.deliveredCount,
      failed: this.failedCount,
      deadLetters: this.deadLetterRecords.length,
      subscribers: this.subscribers.length,
    };
  }

  getDeadLetters(): EventDeliveryRecord[] {
    return [...this.deadLetterRecords];
  }

  addMonitor(monitor: EventBusMonitor): void {
    this.monitors.push(monitor);
  }

  addAuditor(auditor: EventBusAuditor): void {
    this.auditors.push(auditor);
  }

  private async deliver(
    subscriber: SubscriberEntry,
    envelope: EventEnvelope,
    maxDeliveryAttempts: number,
  ): Promise<void> {
    let attempts = 0;
    let errorMessage: string | undefined;
    for (let attempt = 1; attempt <= maxDeliveryAttempts; attempt += 1) {
      attempts = attempt;
      try {
        await subscriber.handler(envelope);
        errorMessage = undefined;
        break;
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
    }

    const status: EventDeliveryStatus = errorMessage === undefined ? 'delivered' : 'failed';
    const record = this.createDeliveryRecord(
      envelope,
      subscriber.id,
      status,
      attempts,
      errorMessage,
    );

    if (status === 'delivered') {
      this.deliveredCount += 1;
      for (const monitor of this.monitors) {
        monitor.onDelivered?.(record);
      }
    } else {
      this.failedCount += 1;
      this.deadLetterRecords.push(record);
      for (const monitor of this.monitors) {
        monitor.onFailed?.(record);
      }
    }
  }

  private createDeliveryRecord(
    envelope: EventEnvelope,
    subscriberId: string,
    status: EventDeliveryStatus,
    attempts: number,
    errorMessage: string | undefined,
  ): EventDeliveryRecord {
    const record: EventDeliveryRecord = {
      envelope,
      subscriberId,
      deliveredAt: new Date().toISOString(),
      status,
      attempts,
    };
    if (errorMessage !== undefined) {
      record.error = errorMessage;
    }
    return record;
  }

  private matches(
    filter: EventFilter,
    envelope: EventEnvelope,
    category: string | undefined,
    priority: number,
  ): boolean {
    if (filter.eventType !== undefined && filter.eventType !== envelope.eventType) {
      return false;
    }
    if (filter.source !== undefined && filter.source !== envelope.source) {
      return false;
    }
    if (filter.category !== undefined && filter.category !== category) {
      return false;
    }
    if (filter.priority !== undefined && filter.priority !== priority) {
      return false;
    }
    return true;
  }

  private validatePublishInput(input: PublishEventInput): void {
    if (!input.eventType.trim()) {
      throw new Error('eventType must be a non-empty string');
    }
    if (!input.source.trim()) {
      throw new Error('source must be a non-empty string');
    }
    if (!input.eventVersion.trim()) {
      throw new Error('eventVersion must be a non-empty string');
    }
  }

  private validateFilter(filter: EventFilter): void {
    if (filter.eventType !== undefined && !filter.eventType.trim()) {
      throw new Error('eventType must be a non-empty string');
    }
    if (filter.source !== undefined && !filter.source.trim()) {
      throw new Error('source must be a non-empty string');
    }
    if (filter.category !== undefined && !filter.category.trim()) {
      throw new Error('category must be a non-empty string');
    }
    this.assertNonNegativeInteger(filter.priority, 'priority');
  }

  private assertNonNegativeInteger(value: number | undefined, label: string): number {
    if (value === undefined) {
      return 0;
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative integer`);
    }
    return value;
  }

  private assertPositiveInteger(value: number | undefined, label: string): number {
    if (value === undefined) {
      return 1;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${label} must be a positive integer`);
    }
    return value;
  }
}
