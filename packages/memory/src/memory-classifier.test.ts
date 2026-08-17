import { describe, expect, it } from 'vitest';

import { DefaultMemoryClassifier } from './index.js';

describe('DefaultMemoryClassifier', () => {
  const classifier = new DefaultMemoryClassifier();

  it('classifies ordinary knowledge as long-term with base importance', () => {
    const result = classifier.classify({
      title: 'Meeting notes',
      content: 'General updates were discussed',
      source: 'repository',
      tags: ['docs'],
    });

    expect(result).toEqual({ memoryType: 'long-term', importance: 1 });
  });

  it('classifies temporal content as short-term', () => {
    const result = classifier.classify({
      title: 'Draft proposal',
      content: 'Pending review',
      source: 'conversation',
      tags: [],
    });

    expect(result.memoryType).toBe('short-term');
  });

  it('detects temporal markers in content, source, and tags', () => {
    expect(
      classifier.classify({ title: 'Note', content: 'Temporary values', source: 'x', tags: [] })
        .memoryType,
    ).toBe('short-term');
    expect(
      classifier.classify({ title: 'Note', content: 'values', source: 'draft', tags: [] })
        .memoryType,
    ).toBe('short-term');
    expect(
      classifier.classify({ title: 'Note', content: 'values', source: 'x', tags: ['wip'] })
        .memoryType,
    ).toBe('short-term');
  });

  it('assigns high importance for critical markers', () => {
    const result = classifier.classify({
      title: 'Approved preference',
      content: 'Security decision made',
      source: 'settings',
      tags: [],
    });

    expect(result.importance).toBe(5);
  });

  it('assigns medium importance for stable markers', () => {
    const result = classifier.classify({
      title: 'Project goal',
      content: 'Plan for the next quarter',
      source: 'roadmap',
      tags: [],
    });

    expect(result.importance).toBe(3);
  });

  it('prefers high importance over medium when both markers appear', () => {
    const result = classifier.classify({
      title: 'Approved project plan',
      content: 'Standard decisions recorded',
      source: 'repository',
      tags: [],
    });

    expect(result.importance).toBe(5);
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      title: 'Project notes',
      content: 'Current status draft',
      source: 'conversation',
      tags: ['planning'],
    };

    expect(classifier.classify(input)).toEqual(classifier.classify(input));
  });
});
