import { describe, expect, test } from 'vitest';
import {
  applyRunComparisonCompareConfig,
  buildComparisonRunSnapshot,
  buildPromptVersionsMap,
  matchPromptHistoryEntry,
  snapshotFieldCompareConfig,
} from '@/lib/comparison-run-snapshot';
import type { AccuracyField } from '@/lib/types';
import type { FieldCompareConfig } from '@/lib/compare-types';
import { COMPARE_TYPE_CONFIG_VERSION } from '@/lib/compare-types';

function field(overrides: Partial<AccuracyField> & Pick<AccuracyField, 'key'>): AccuracyField {
  return {
    name: overrides.name ?? overrides.key,
    key: overrides.key,
    type: overrides.type ?? 'string',
    prompt: overrides.prompt ?? '',
    promptHistory: overrides.promptHistory ?? [],
    options: overrides.options,
  };
}

describe('applyRunComparisonCompareConfig', () => {
  test('returns null when no config is set', () => {
    expect(applyRunComparisonCompareConfig(null)).toBeNull();
    expect(applyRunComparisonCompareConfig(undefined)).toBeNull();
  });

  test('leaves non-judge compare types unchanged', () => {
    const config: FieldCompareConfig = {
      fieldKey: 'effective_date',
      fieldName: 'Effective Date',
      compareType: 'date-exact',
    };

    expect(applyRunComparisonCompareConfig(config)).toEqual(config);
  });

  test('downgrades llm-judge to near-exact-string without mutating the original', () => {
    const config: FieldCompareConfig = {
      fieldKey: 'clause',
      fieldName: 'Clause',
      compareType: 'llm-judge',
      parameters: { comparisonPrompt: 'same meaning' },
    };

    const scored = applyRunComparisonCompareConfig(config);

    expect(scored?.compareType).toBe('near-exact-string');
    expect(scored?.parameters).toEqual({ comparisonPrompt: 'same meaning' });
    expect(config.compareType).toBe('llm-judge');
  });
});

describe('matchPromptHistoryEntry', () => {
  test('returns the latest history entry whose prompt matches the active prompt', () => {
    const accuracyField = field({
      key: 'party',
      prompt: 'Search for the other party.',
      promptHistory: [
        { id: 'v1', prompt: 'Search for the other party.', savedAt: '2026-01-01' },
        { id: 'v2', prompt: 'Look in the opening paragraph.', savedAt: '2026-02-01' },
        { id: 'v3', prompt: 'Search for the other party.', savedAt: '2026-03-01' },
      ],
    });

    expect(matchPromptHistoryEntry(accuracyField)?.id).toBe('v3');
  });

  test('returns undefined when the active prompt is not in history', () => {
    const accuracyField = field({
      key: 'party',
      prompt: 'unsaved draft',
      promptHistory: [
        { id: 'v1', prompt: 'older prompt', savedAt: '2026-01-01' },
      ],
    });

    expect(matchPromptHistoryEntry(accuracyField)).toBeUndefined();
  });
});

describe('buildComparisonRunSnapshot', () => {
  const fields: AccuracyField[] = [
    field({
      key: 'effective_date',
      name: 'Effective Date',
      type: 'date',
      prompt: 'Return the effective date as YYYY-MM-DD.',
      promptHistory: [
        {
          id: 'pv-date',
          prompt: 'Return the effective date as YYYY-MM-DD.',
          savedAt: '2026-08-01',
          source: 'agent-alpha',
          generationMethod: 'agent',
        },
      ],
    }),
    field({
      key: 'clause',
      name: 'Clause',
      prompt: 'Extract the governing law.',
    }),
  ];

  test('records prompts, version ids, files, models, and scoring-time compare types', () => {
    const snapshot = buildComparisonRunSnapshot({
      templateKey: 'nda_template',
      fields,
      fileIds: ['file-a', 'file-b'],
      modelIds: ['google__gemini_2_5_flash', 'aws__claude_sonnet_5'],
      compareConfigsByField: {
        effective_date: {
          fieldKey: 'effective_date',
          fieldName: 'Effective Date',
          compareType: 'date-exact',
        },
        clause: {
          fieldKey: 'clause',
          fieldName: 'Clause',
          compareType: 'llm-judge',
        },
      },
    });

    expect(snapshot.templateKey).toBe('nda_template');
    expect(snapshot.fileIds).toEqual(['file-a', 'file-b']);
    expect(snapshot.modelIds).toEqual(['google__gemini_2_5_flash', 'aws__claude_sonnet_5']);
    expect(snapshot.compareConfigSchemaVersion).toBe(COMPARE_TYPE_CONFIG_VERSION);

    expect(snapshot.prompts.effective_date).toEqual({
      versionId: 'pv-date',
      prompt: 'Return the effective date as YYYY-MM-DD.',
      source: 'agent-alpha',
      generationMethod: 'agent',
    });
    expect(snapshot.prompts.clause.versionId).toBeNull();
    expect(snapshot.prompts.clause.prompt).toBe('Extract the governing law.');

    expect(snapshot.compareConfigs.effective_date).toEqual({
      compareType: 'date-exact',
      configuredCompareType: 'date-exact',
      overridden: false,
    });
    expect(snapshot.compareConfigs.clause).toEqual({
      compareType: 'near-exact-string',
      configuredCompareType: 'llm-judge',
      overridden: true,
    });
  });

  test('does not mutate the fileIds or modelIds arrays it is given', () => {
    const fileIds = ['file-a'];
    const modelIds = ['google__gemini_2_5_flash'];

    const snapshot = buildComparisonRunSnapshot({
      templateKey: 'nda_template',
      fields,
      fileIds,
      modelIds,
    });

    snapshot.fileIds.push('file-b');
    snapshot.modelIds.push('other');

    expect(fileIds).toEqual(['file-a']);
    expect(modelIds).toEqual(['google__gemini_2_5_flash']);
  });

  test('marks missing compare config as unconfigured', () => {
    expect(snapshotFieldCompareConfig(null)).toEqual({
      compareType: 'unconfigured',
      configuredCompareType: 'unconfigured',
      overridden: false,
    });
  });

  test('promptVersions map uses history id or active', () => {
    expect(buildPromptVersionsMap(fields)).toEqual({
      effective_date: 'pv-date',
      clause: 'active',
    });
  });
});
