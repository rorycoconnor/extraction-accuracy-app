/**
 * Immutable provenance captured when a comparison run completes.
 *
 * Stored on ComparisonRun so later prompt/compare-config edits cannot rewrite
 * history. Does not change scoring or UI — it only records what the run used.
 */

import type { AccuracyField, FileResult, PromptVersion } from './types';
import type { CompareType, FieldCompareConfig } from './compare-types';
import { COMPARE_TYPE_CONFIG_VERSION } from './compare-types';
import { getActiveModelsForRun } from './main-page-constants';

/** Run Comparison forces llm-judge to this deterministic type while scoring. */
export const RUN_COMPARISON_LLM_JUDGE_FALLBACK: CompareType = 'near-exact-string';

export type FieldPromptSnapshot = {
  versionId: string | null;
  prompt: string;
  source?: PromptVersion['source'];
  generationMethod?: PromptVersion['generationMethod'];
};

export type FieldCompareSnapshot = {
  /** Compare type actually used while scoring this run. */
  compareType: CompareType | 'unconfigured';
  /** Compare type configured for the field before any run-time override. */
  configuredCompareType: CompareType | 'unconfigured';
  overridden: boolean;
};

export type ComparisonRunSnapshot = {
  templateKey: string;
  fileIds: string[];
  modelIds: string[];
  prompts: Record<string, FieldPromptSnapshot>;
  compareConfigs: Record<string, FieldCompareSnapshot>;
  compareConfigSchemaVersion: string;
  trainFileIds?: string[];
  holdoutFileIds?: string[];
  scoringFileIds?: string[];
};

export type BuildComparisonRunSnapshotInput = {
  templateKey: string;
  fields: AccuracyField[];
  fileIds: string[];
  modelIds: string[];
  compareConfigsByField?: Record<string, FieldCompareConfig | null | undefined>;
  trainFileIds?: string[];
  holdoutFileIds?: string[];
  scoringFileIds?: string[];
};

/**
 * Apply the Run Comparison scoring override (llm-judge → near-exact-string).
 * Same behavior as the previous inline override in the comparison runner.
 */
export function applyRunComparisonCompareConfig<T extends { compareType: CompareType }>(
  config: T | null | undefined
): T | null {
  if (!config) {
    return null;
  }
  if (config.compareType === 'llm-judge') {
    return {
      ...config,
      compareType: RUN_COMPARISON_LLM_JUDGE_FALLBACK,
    };
  }
  return config;
}

export function matchPromptHistoryEntry(field: AccuracyField): PromptVersion | undefined {
  const history = field.promptHistory ?? [];
  const activePrompt = field.prompt ?? '';
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].prompt === activePrompt) {
      return history[i];
    }
  }
  return undefined;
}

export function buildPromptVersionsMap(fields: AccuracyField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of fields) {
    map[field.key] = matchPromptHistoryEntry(field)?.id ?? 'active';
  }
  return map;
}

export function snapshotFieldCompareConfig(
  configured: FieldCompareConfig | null | undefined
): FieldCompareSnapshot {
  if (!configured) {
    return {
      compareType: 'unconfigured',
      configuredCompareType: 'unconfigured',
      overridden: false,
    };
  }

  const scored = applyRunComparisonCompareConfig(configured);
  const configuredType = configured.compareType;
  const scoredType = scored?.compareType ?? configuredType;

  return {
    compareType: scoredType,
    configuredCompareType: configuredType,
    overridden: configuredType !== scoredType,
  };
}

export function buildComparisonRunSnapshot(
  input: BuildComparisonRunSnapshotInput
): ComparisonRunSnapshot {
  const prompts: Record<string, FieldPromptSnapshot> = {};
  const compareConfigs: Record<string, FieldCompareSnapshot> = {};
  const compareConfigsByField = input.compareConfigsByField ?? {};

  for (const field of input.fields) {
    const historyEntry = matchPromptHistoryEntry(field);
    prompts[field.key] = {
      versionId: historyEntry?.id ?? null,
      prompt: field.prompt ?? '',
      source: historyEntry?.source,
      generationMethod: historyEntry?.generationMethod,
    };
    compareConfigs[field.key] = snapshotFieldCompareConfig(compareConfigsByField[field.key]);
  }

  return {
    templateKey: input.templateKey,
    fileIds: [...input.fileIds],
    modelIds: [...input.modelIds],
    prompts,
    compareConfigs,
    compareConfigSchemaVersion: COMPARE_TYPE_CONFIG_VERSION,
    trainFileIds: input.trainFileIds ? [...input.trainFileIds] : undefined,
    holdoutFileIds: input.holdoutFileIds ? [...input.holdoutFileIds] : undefined,
    scoringFileIds: input.scoringFileIds ? [...input.scoringFileIds] : undefined,
  };
}

export function buildComparisonRunSnapshotFromAccuracyData(input: {
  templateKey: string;
  fields: AccuracyField[];
  results: FileResult[];
  shownColumns?: Record<string, boolean>;
  modelIds?: string[];
  compareConfigsByField?: Record<string, FieldCompareConfig | null | undefined>;
}): ComparisonRunSnapshot {
  return buildComparisonRunSnapshot({
    templateKey: input.templateKey,
    fields: input.fields,
    fileIds: input.results.map((result) => result.id),
    modelIds: input.modelIds ?? getActiveModelsForRun(input.shownColumns ?? {}),
    compareConfigsByField: input.compareConfigsByField,
  });
}
