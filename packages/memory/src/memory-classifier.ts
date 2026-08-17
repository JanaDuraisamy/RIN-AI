import type {
  MemoryClassificationInput,
  MemoryClassificationResult,
  MemoryClassifier,
} from '@rin/types';

const TEMPORAL_KEYWORDS = ['temporary', 'draft', 'pending', 'wip', 'current'];

const HIGH_IMPORTANCE_KEYWORDS = [
  'preference',
  'preferred',
  'approve',
  'approved',
  'security',
  'milestone',
  'decision',
  'standard',
];

const MEDIUM_IMPORTANCE_KEYWORDS = ['project', 'goal', 'plan', 'requirement', 'objective'];

export class DefaultMemoryClassifier implements MemoryClassifier {
  classify(input: MemoryClassificationInput): MemoryClassificationResult {
    const text = [input.title, input.content, input.source, ...input.tags].join(' ').toLowerCase();
    const memoryType = containsAny(text, TEMPORAL_KEYWORDS) ? 'short-term' : 'long-term';
    const importance = containsAny(text, HIGH_IMPORTANCE_KEYWORDS)
      ? 5
      : containsAny(text, MEDIUM_IMPORTANCE_KEYWORDS)
        ? 3
        : 1;
    return { memoryType, importance };
  }
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
