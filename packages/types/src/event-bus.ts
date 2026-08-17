import type { EventEnvelope } from './index.js';

export interface PublishEventInput {
  eventType: string;
  source: string;
  payload: unknown;
  eventVersion: string;
  correlationId?: string;
}

export interface PublishEventOptions {
  category?: string;
  priority?: number;
  maxDeliveryAttempts?: number;
}

export interface EventFilter {
  eventType?: string;
  source?: string;
  category?: string;
  priority?: number;
}

export interface SubscriptionOptions {
  priority?: number;
}

export type EventDeliveryStatus = 'delivered' | 'failed';

export interface EventDeliveryRecord {
  envelope: EventEnvelope;
  subscriberId: string;
  deliveredAt: string;
  status: EventDeliveryStatus;
  attempts: number;
  error?: string;
}

export interface EventBusStats {
  published: number;
  delivered: number;
  failed: number;
  deadLetters: number;
  subscribers: number;
}

export interface EventBusMonitor {
  onPublished?(envelope: EventEnvelope): void;
  onDelivered?(record: EventDeliveryRecord): void;
  onFailed?(record: EventDeliveryRecord): void;
}

export interface EventBusAuditor {
  record(event: EventEnvelope): void | Promise<void>;
}

export interface EventIdGenerator {
  nextId(): string;
}

export type EventHandler = (envelope: EventEnvelope) => void | Promise<void>;

export interface EventBus {
  publish(input: PublishEventInput, options?: PublishEventOptions): Promise<EventEnvelope>;
  subscribe(filter: EventFilter, handler: EventHandler, options?: SubscriptionOptions): string;
  unsubscribe(subscriptionId: string): boolean;
  getStats(): EventBusStats;
  getDeadLetters(): EventDeliveryRecord[];
  addMonitor(monitor: EventBusMonitor): void;
  addAuditor(auditor: EventBusAuditor): void;
}
