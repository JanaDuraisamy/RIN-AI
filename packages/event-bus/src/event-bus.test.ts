import { describe, expect, it } from 'vitest';

import type { EventDeliveryRecord, EventIdGenerator } from '@rin/types';

import { InMemoryEventBus } from './index.js';

function publishInput(eventType: string, source = 'test-source') {
  return {
    eventType,
    source,
    payload: { value: 1 },
    eventVersion: '1.0.0',
  };
}

describe('InMemoryEventBus', () => {
  it('builds a valid envelope for published events', async () => {
    const bus = new InMemoryEventBus();

    const envelope = await bus.publish({
      ...publishInput('a.b'),
      correlationId: 'corr-1',
    });

    expect(envelope.eventId).toBeTruthy();
    expect(new Date(envelope.timestamp).toISOString()).toBe(envelope.timestamp);
    expect(envelope.eventType).toBe('a.b');
    expect(envelope.source).toBe('test-source');
    expect(envelope.eventVersion).toBe('1.0.0');
    expect(envelope.correlationId).toBe('corr-1');
    expect(envelope.payload).toEqual({ value: 1 });
  });

  it('generates a correlationId when omitted', async () => {
    const bus = new InMemoryEventBus();

    const first = await bus.publish(publishInput('a.b'));
    const second = await bus.publish(publishInput('a.b'));

    expect(first.correlationId).toBeTruthy();
    expect(second.correlationId).toBeTruthy();
    expect(first.correlationId).not.toBe(second.correlationId);
  });

  it('generates distinct event ids by default', async () => {
    const bus = new InMemoryEventBus();

    const first = await bus.publish(publishInput('a.b'));
    const second = await bus.publish(publishInput('a.b'));

    expect(first.eventId).not.toBe(second.eventId);
  });

  it('uses the injected id generator', async () => {
    let calls = 0;
    const generator: EventIdGenerator = {
      nextId: () => `generated-${(calls += 1)}`,
    };
    const bus = new InMemoryEventBus(generator);

    const envelope = await bus.publish(publishInput('a.b'));

    expect(envelope.eventId).toBe('generated-1');
    expect(envelope.correlationId).toBe('generated-2');
  });

  it('delivers to subscribers with a matching event type', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe({ eventType: 'target.event' }, (envelope) => {
      received.push(envelope.eventType);
    });

    await bus.publish(publishInput('other.event'));
    await bus.publish(publishInput('target.event'));

    expect(received).toEqual(['target.event']);
  });

  it('routes by source', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe({ source: 'core' }, () => {
      received.push('matched');
    });

    await bus.publish(publishInput('a.b', 'other'));
    await bus.publish(publishInput('a.b', 'core'));

    expect(received).toEqual(['matched']);
  });

  it('routes by category', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe({ category: 'lifecycle' }, () => {
      received.push('matched');
    });

    await bus.publish(publishInput('a.b'), { category: 'other' });
    await bus.publish(publishInput('a.b'), { category: 'lifecycle' });

    expect(received).toEqual(['matched']);
  });

  it('routes by publish priority', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe({ priority: 5 }, () => {
      received.push('matched');
    });

    await bus.publish(publishInput('a.b'), { priority: 4 });
    await bus.publish(publishInput('a.b'), { priority: 5 });

    expect(received).toEqual(['matched']);
  });

  it('delivers to every matching subscriber', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];

    bus.subscribe({ eventType: 'a.b' }, () => {
      received.push('one');
    });
    bus.subscribe({ eventType: 'a.b' }, () => {
      received.push('two');
    });

    await bus.publish(publishInput('a.b'));

    expect(received).toEqual(['one', 'two']);
  });

  it('delivers to higher-priority subscribers first', async () => {
    const bus = new InMemoryEventBus();
    const order: string[] = [];

    bus.subscribe(
      { eventType: 'a.b' },
      () => {
        order.push('low');
      },
      { priority: 1 },
    );
    bus.subscribe(
      { eventType: 'a.b' },
      () => {
        order.push('high');
      },
      { priority: 10 },
    );

    await bus.publish(publishInput('a.b'));

    expect(order).toEqual(['high', 'low']);
  });

  it('awaits async handlers before resolving publish', async () => {
    const bus = new InMemoryEventBus();
    let completed = false;

    bus.subscribe({}, async () => {
      await Promise.resolve();
      completed = true;
    });

    await bus.publish(publishInput('a.b'));

    expect(completed).toBe(true);
  });

  it('stops delivering after unsubscribe', async () => {
    const bus = new InMemoryEventBus();
    const received: unknown[] = [];

    const subscriptionId = bus.subscribe({}, (envelope) => {
      received.push(envelope);
    });

    expect(bus.unsubscribe(subscriptionId)).toBe(true);
    expect(bus.unsubscribe(subscriptionId)).toBe(false);

    await bus.publish(publishInput('a.b'));

    expect(received).toHaveLength(0);
    expect(bus.getStats().subscribers).toBe(0);
  });

  it('retries up to maxDeliveryAttempts and delivers on success', async () => {
    const bus = new InMemoryEventBus();
    let calls = 0;

    bus.subscribe({}, () => {
      calls += 1;
      if (calls < 3) {
        throw new Error('transient');
      }
    });

    await bus.publish(publishInput('a.b'), { maxDeliveryAttempts: 3 });

    expect(calls).toBe(3);
    expect(bus.getStats().delivered).toBe(1);
  });

  it('moves failed deliveries to dead letters after exhausting attempts', async () => {
    const bus = new InMemoryEventBus();
    let calls = 0;

    bus.subscribe({}, () => {
      calls += 1;
      throw new Error('always');
    });

    await bus.publish(publishInput('a.b'), { maxDeliveryAttempts: 3 });

    expect(calls).toBe(3);
    expect(bus.getStats().failed).toBe(1);
    expect(bus.getStats().deadLetters).toBe(1);

    const deadLetter = bus.getDeadLetters()[0];
    expect(deadLetter?.attempts).toBe(3);
    expect(deadLetter?.status).toBe('failed');
    expect(deadLetter?.error).toBe('always');
  });

  it('invokes monitor hooks on published, delivered, and failed events', async () => {
    const bus = new InMemoryEventBus();
    const published: string[] = [];
    const delivered: EventDeliveryRecord[] = [];
    const failed: EventDeliveryRecord[] = [];

    bus.addMonitor({
      onPublished: (envelope) => {
        published.push(envelope.eventType);
      },
      onDelivered: (record) => {
        delivered.push(record);
      },
      onFailed: (record) => {
        failed.push(record);
      },
    });
    bus.subscribe({ eventType: 'good.event' }, () => undefined);
    bus.subscribe({ eventType: 'bad.event' }, () => {
      throw new Error('boom');
    });

    await bus.publish(publishInput('good.event'));
    await bus.publish(publishInput('bad.event'));

    expect(published).toEqual(['good.event', 'bad.event']);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.subscriberId).toBeTruthy();
    expect(failed).toHaveLength(1);
    expect(failed[0]?.error).toBe('boom');
  });

  it('records every published event through auditors', async () => {
    const bus = new InMemoryEventBus();
    const audited: string[] = [];

    bus.addAuditor({
      record: (event) => {
        audited.push(event.eventId);
      },
    });

    const envelope = await bus.publish(publishInput('a.b'));

    expect(audited).toEqual([envelope.eventId]);
  });

  it('tracks publish and delivery statistics', async () => {
    const bus = new InMemoryEventBus();

    bus.subscribe({}, () => undefined);
    await bus.publish(publishInput('a.b'));
    await bus.publish(publishInput('a.b'));

    const stats = bus.getStats();
    expect(stats.published).toBe(2);
    expect(stats.delivered).toBe(2);
    expect(stats.failed).toBe(0);
    expect(stats.deadLetters).toBe(0);
    expect(stats.subscribers).toBe(1);
  });

  it('rejects invalid publish input', async () => {
    const bus = new InMemoryEventBus();

    await expect(
      bus.publish({ eventType: '', source: 's', payload: null, eventVersion: '1' }),
    ).rejects.toThrow('eventType must be a non-empty string');

    await expect(
      bus.publish({ eventType: 'a', source: '', payload: null, eventVersion: '1' }),
    ).rejects.toThrow('source must be a non-empty string');

    await expect(
      bus.publish({ eventType: 'a', source: 's', payload: null, eventVersion: ' ' }),
    ).rejects.toThrow('eventVersion must be a non-empty string');

    await expect(
      bus.publish(
        { eventType: 'a', source: 's', payload: null, eventVersion: '1' },
        { priority: -1 },
      ),
    ).rejects.toThrow('priority must be a non-negative integer');

    await expect(
      bus.publish(
        { eventType: 'a', source: 's', payload: null, eventVersion: '1' },
        { maxDeliveryAttempts: 0 },
      ),
    ).rejects.toThrow('maxDeliveryAttempts must be a positive integer');
  });

  it('rejects invalid subscription filters and options', () => {
    const bus = new InMemoryEventBus();

    expect(() => bus.subscribe({ eventType: ' ' }, () => undefined)).toThrow(
      'eventType must be a non-empty string',
    );
    expect(() => bus.subscribe({ source: ' ' }, () => undefined)).toThrow(
      'source must be a non-empty string',
    );
    expect(() => bus.subscribe({ category: ' ' }, () => undefined)).toThrow(
      'category must be a non-empty string',
    );
    expect(() => bus.subscribe({}, () => undefined, { priority: -5 })).toThrow(
      'subscription priority must be a non-negative integer',
    );
  });

  it('returns copies of dead letters', async () => {
    const bus = new InMemoryEventBus();

    bus.subscribe({}, () => {
      throw new Error('boom');
    });
    await bus.publish(publishInput('a.b'));

    const letters = bus.getDeadLetters();
    letters.length = 0;

    expect(bus.getDeadLetters()).toHaveLength(1);
  });
});
