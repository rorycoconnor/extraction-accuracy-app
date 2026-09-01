import { splitTrainHoldout } from './agent-alpha-sampling';

/** Fraction of selected comparison files held out for scoring. */
export const COMPARISON_HOLDOUT_RATIO = 0.2;

export type ComparisonEvalSplit = {
  trainFileIds: string[];
  holdoutFileIds: string[];
  /** File IDs used for field averages and ranking (holdout when a split exists). */
  scoringFileIds: string[];
};

/**
 * Split selected comparison files into a tuning set and a holdout scoring set.
 * Fewer than 3 files: no split — every file is scored.
 */
export function splitComparisonEval(
  fileIds: string[],
  holdoutRatio: number = COMPARISON_HOLDOUT_RATIO
): ComparisonEvalSplit {
  const { trainDocIds, holdoutDocIds } = splitTrainHoldout(fileIds, holdoutRatio);
  return {
    trainFileIds: trainDocIds,
    holdoutFileIds: holdoutDocIds,
    scoringFileIds: holdoutDocIds.length > 0 ? holdoutDocIds : [...fileIds],
  };
}
