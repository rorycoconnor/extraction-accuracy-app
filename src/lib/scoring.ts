/**
 * Shared scoring helpers for field-level eval metrics.
 *
 * Strict matches exclude partial / different-format credit.
 * Extraction errors count as failures. Pending cells are skipped.
 */

export type ConfusionCounts = {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  pairs: number;
};

export type ChannelMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
};

export type ScoreChannel = 'strict' | 'lenient';

export function createConfusionCounts(): ConfusionCounts {
  return {
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    trueNegatives: 0,
    pairs: 0,
  };
}

export function isPendingPrediction(value: string): boolean {
  return !value || value.startsWith('Pending');
}

export function isErrorPrediction(value: string): boolean {
  return value.startsWith('Error');
}

export function isStrictMatch(comparison: {
  isMatch?: boolean;
  matchClassification?: string;
  matchType?: string;
} | null | undefined): boolean {
  if (!comparison?.isMatch) {
    return false;
  }
  const classification = comparison.matchClassification || comparison.matchType;
  return classification !== 'partial';
}

export function recordConfusion(
  counts: ConfusionCounts,
  outcome: 'tp' | 'tn' | 'fp' | 'mismatch'
): void {
  counts.pairs += 1;
  if (outcome === 'tp') {
    counts.truePositives += 1;
  } else if (outcome === 'tn') {
    counts.trueNegatives += 1;
  } else if (outcome === 'fp') {
    counts.falsePositives += 1;
  } else {
    counts.falsePositives += 1;
    counts.falseNegatives += 1;
  }
}

export function outcomeForPair(args: {
  groundTruthNotPresent: boolean;
  predictedNotPresent: boolean;
  isMatch: boolean;
  isError: boolean;
}): 'tp' | 'tn' | 'fp' | 'mismatch' {
  if (args.groundTruthNotPresent) {
    return !args.isError && args.predictedNotPresent ? 'tn' : 'fp';
  }
  return !args.isError && args.isMatch ? 'tp' : 'mismatch';
}

export function metricsFromConfusion(counts: ConfusionCounts): ChannelMetrics {
  if (counts.pairs === 0) {
    return { accuracy: 0, precision: 0, recall: 0, f1Score: 0 };
  }

  const accuracy = (counts.truePositives + counts.trueNegatives) / counts.pairs;

  if (
    counts.truePositives === 0 &&
    counts.falsePositives === 0 &&
    counts.falseNegatives === 0 &&
    counts.trueNegatives > 0
  ) {
    return {
      accuracy: clamp01(accuracy),
      precision: 1,
      recall: 1,
      f1Score: 1,
    };
  }

  const precision =
    counts.truePositives + counts.falsePositives > 0
      ? counts.truePositives / (counts.truePositives + counts.falsePositives)
      : 0;
  const recall =
    counts.truePositives + counts.falseNegatives > 0
      ? counts.truePositives / (counts.truePositives + counts.falseNegatives)
      : 0;
  const f1Score =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    accuracy: clamp01(accuracy),
    precision: clamp01(precision),
    recall: clamp01(recall),
    f1Score: clamp01(f1Score),
  };
}

export function reliabilityFromCounts(errorPairs: number, completedPairs: number): number {
  if (completedPairs <= 0) {
    return 0;
  }
  return clamp01((completedPairs - errorPairs) / completedPairs);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
