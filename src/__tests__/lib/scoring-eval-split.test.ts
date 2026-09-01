import { describe, expect, test } from 'vitest';
import { splitComparisonEval } from '@/lib/eval-split';
import {
  isErrorPrediction,
  isPendingPrediction,
  isStrictMatch,
  metricsFromConfusion,
  outcomeForPair,
  recordConfusion,
  reliabilityFromCounts,
  createConfusionCounts,
} from '@/lib/scoring';

describe('splitComparisonEval', () => {
  test('does not split when fewer than 3 files', () => {
    const split = splitComparisonEval(['a', 'b']);
    expect(split.holdoutFileIds).toEqual([]);
    expect(split.scoringFileIds).toEqual(['a', 'b']);
    expect(split.trainFileIds).toEqual(['a', 'b']);
  });

  test('holds out the last 20% when there are enough files', () => {
    const ids = ['1', '2', '3', '4', '5'];
    const split = splitComparisonEval(ids);
    expect(split.holdoutFileIds).toEqual(['5']);
    expect(split.trainFileIds).toEqual(['1', '2', '3', '4']);
    expect(split.scoringFileIds).toEqual(['5']);
  });
});

describe('scoring helpers', () => {
  test('classifies pending and error predictions', () => {
    expect(isPendingPrediction('')).toBe(true);
    expect(isPendingPrediction('Pending...')).toBe(true);
    expect(isErrorPrediction('Error: timeout')).toBe(true);
    expect(isErrorPrediction('Acme')).toBe(false);
  });

  test('partial matches are not strict; equivalent dates are', () => {
    expect(isStrictMatch({ isMatch: true, matchClassification: 'partial' })).toBe(false);
    expect(isStrictMatch({ isMatch: true, matchClassification: 'normalized' })).toBe(true);
    expect(isStrictMatch({ isMatch: true, matchClassification: 'exact' })).toBe(true);
    expect(isStrictMatch({ isMatch: true, matchClassification: 'different-format' })).toBe(true);
    expect(isStrictMatch({ isMatch: false, matchClassification: 'none' })).toBe(false);
  });

  test('errors against present ground truth are mismatches', () => {
    expect(
      outcomeForPair({
        groundTruthNotPresent: false,
        predictedNotPresent: false,
        isMatch: false,
        isError: true,
      })
    ).toBe('mismatch');
  });

  test('reliability ignores pending and treats errors as incomplete success', () => {
    expect(reliabilityFromCounts(1, 4)).toBe(0.75);
    expect(reliabilityFromCounts(0, 0)).toBe(0);
  });

  test('metricsFromConfusion uses pair count as the accuracy denominator', () => {
    const counts = createConfusionCounts();
    recordConfusion(counts, 'tp');
    recordConfusion(counts, 'mismatch');
    const metrics = metricsFromConfusion(counts);
    expect(counts.pairs).toBe(2);
    expect(metrics.accuracy).toBe(0.5);
  });
});
