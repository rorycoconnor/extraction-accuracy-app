import { describe, test, expect } from 'vitest';
import {
  AVAILABLE_MODELS,
  DEFAULT_SELECTED_MODELS,
  UI_LABELS,
  getActiveModelsForRun,
  isKnownModel,
  sanitizeShownColumns,
  sortModelIds,
} from '@/lib/main-page-constants';

const RETIRED_MODEL = 'openai__gpt_o3';
const LIVE_MODEL = 'google__gemini_3_5_flash';

describe('model list invariants', () => {
  test('every default-selected model still exists in MODEL_CONFIGS', () => {
    // A stale entry here opens the comparison grid with nothing selected.
    for (const modelId of DEFAULT_SELECTED_MODELS) {
      expect(isKnownModel(modelId)).toBe(true);
    }
  });

  test('the fixture used for retired-model tests is genuinely retired', () => {
    expect(isKnownModel(RETIRED_MODEL)).toBe(false);
    expect(isKnownModel(LIVE_MODEL)).toBe(true);
  });

  test('sortModelIds does not mutate the array it is given', () => {
    const input = [...AVAILABLE_MODELS].reverse();
    const snapshot = [...input];

    sortModelIds(input);

    expect(input).toEqual(snapshot);
  });

  test('sortModelIds keeps each model adjacent to its no-prompt variant', () => {
    const sorted = sortModelIds(AVAILABLE_MODELS);
    const flashIndex = sorted.indexOf('google__gemini_3_5_flash');
    const flashNoPromptIndex = sorted.indexOf('google__gemini_3_5_flash_no_prompt');

    expect(flashIndex).toBeGreaterThanOrEqual(0);
    expect(flashNoPromptIndex).toBe(flashIndex + 1);
  });
});

describe('sanitizeShownColumns', () => {
  test('defaults to Ground Truth plus the default model selection', () => {
    const result = sanitizeShownColumns();

    expect(result[UI_LABELS.GROUND_TRUTH]).toBe(true);
    for (const modelId of DEFAULT_SELECTED_MODELS) {
      expect(result[modelId]).toBe(true);
    }
  });

  test('drops models retired since the state was saved', () => {
    const result = sanitizeShownColumns({
      [UI_LABELS.GROUND_TRUTH]: true,
      [RETIRED_MODEL]: true,
      [LIVE_MODEL]: true,
    });

    expect(result).not.toHaveProperty(RETIRED_MODEL);
    expect(result[LIVE_MODEL]).toBe(true);
  });

  test('preserves an explicit user de-selection', () => {
    const result = sanitizeShownColumns({ [LIVE_MODEL]: false });

    expect(result[LIVE_MODEL]).toBe(false);
  });

  test('gives models absent from saved state their default', () => {
    const result = sanitizeShownColumns({ [UI_LABELS.GROUND_TRUTH]: true });

    expect(result[LIVE_MODEL]).toBe(true);
    expect(result['aws__claude_opus_5']).toBe(false);
  });

  test('only ever emits Ground Truth plus known models', () => {
    const result = sanitizeShownColumns({ garbage_key: true, [RETIRED_MODEL]: true });

    for (const key of Object.keys(result)) {
      expect(key === UI_LABELS.GROUND_TRUTH || isKnownModel(key)).toBe(true);
    }
  });

  // Persisted JSON is untrusted; these previously reached the grid unchecked.
  test.each([null, undefined, 'a string', 42, [], {}])(
    'returns a usable map for malformed input %s',
    input => {
      const result = sanitizeShownColumns(input as never);

      expect(result[UI_LABELS.GROUND_TRUTH]).toBe(true);
      expect(Object.keys(result).length).toBe(AVAILABLE_MODELS.length + 1);
    }
  );
});

describe('getActiveModelsForRun', () => {
  test('excludes Ground Truth', () => {
    const result = getActiveModelsForRun({
      [UI_LABELS.GROUND_TRUTH]: true,
      [LIVE_MODEL]: true,
    });

    expect(result).toEqual([LIVE_MODEL]);
  });

  test('excludes hidden models', () => {
    const result = getActiveModelsForRun({
      [LIVE_MODEL]: true,
      'aws__claude_opus_5': false,
    });

    expect(result).toEqual([LIVE_MODEL]);
  });

  test('excludes retired models so no extraction is dispatched for them', () => {
    const result = getActiveModelsForRun({
      [RETIRED_MODEL]: true,
      [LIVE_MODEL]: true,
    });

    expect(result).not.toContain(RETIRED_MODEL);
    expect(result).toEqual([LIVE_MODEL]);
  });

  test('returns models in canonical order regardless of key order', () => {
    const result = getActiveModelsForRun({
      'google__gemini_3_5_flash_no_prompt': true,
      'google__gemini_3_5_flash': true,
    });

    expect(result).toEqual([
      'google__gemini_3_5_flash',
      'google__gemini_3_5_flash_no_prompt',
    ]);
  });

  test('returns an empty list when nothing is selected', () => {
    expect(getActiveModelsForRun({ [UI_LABELS.GROUND_TRUTH]: true })).toEqual([]);
  });
});
