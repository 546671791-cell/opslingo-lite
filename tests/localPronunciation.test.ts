import { describe, expect, it } from 'vitest';
import { scoreLocalPronunciation } from '../src/localPronunciation';

describe('local pronunciation matching', () => {
  it('scores an exact recognized sentence as complete', () => {
    const result = scoreLocalPronunciation(
      'Could I get the check, please?',
      'Could I get the check please'
    );
    expect(result.score).toBe(100);
    expect(result.completeness).toBe(100);
    expect(result.words.every((word) => word.matched)).toBe(true);
  });

  it('marks omitted words for targeted practice', () => {
    const result = scoreLocalPronunciation('Could I get the check please', 'Could I check please');
    expect(result.score).toBeLessThan(100);
    expect(result.words.filter((word) => !word.matched).map((word) => word.word)).toEqual([
      'get',
      'the'
    ]);
  });
});
