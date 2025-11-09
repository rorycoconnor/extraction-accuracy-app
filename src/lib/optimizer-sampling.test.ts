import { describe, expect, it } from 'vitest';
import { buildFieldFailureMap, selectDocsForOptimizer } from './optimizer-sampling';
import type { AccuracyData } from '@/lib/types';

const mockAccuracyData: AccuracyData = {
  templateKey: 'tmp',
  baseModel: 'Gemini',
  fields: [
    { name: 'Field A', key: 'fieldA', type: 'string', prompt: 'A', promptHistory: [] },
    { name: 'Field B', key: 'fieldB', type: 'string', prompt: 'B', promptHistory: [] },
    { name: 'Field C', key: 'fieldC', type: 'string', prompt: 'C', promptHistory: [] },
  ],
  results: [
    {
      id: 'file-1',
      fileName: 'File One',
      fileType: 'pdf',
      fields: {
        fieldA: { Gemini: 'Wrong', 'Ground Truth': 'Right' },
        fieldB: { Gemini: 'Wrong', 'Ground Truth': 'Right' },
      },
      comparisonResults: {
        fieldA: { Gemini: { isMatch: false, matchType: 'llm', confidence: 'low' } },
        fieldB: { Gemini: { isMatch: false, matchType: 'llm', confidence: 'low' } },
      },
    },
    {
      id: 'file-2',
      fileName: 'File Two',
      fileType: 'pdf',
      fields: {
        fieldB: { Gemini: 'Wrong', 'Ground Truth': 'Right' },
        fieldC: { Gemini: 'Wrong', 'Ground Truth': 'Right' },
      },
      comparisonResults: {
        fieldB: { Gemini: { isMatch: false, matchType: 'llm', confidence: 'low' } },
        fieldC: { Gemini: { isMatch: false, matchType: 'llm', confidence: 'low' } },
      },
    },
    {
      id: 'file-3',
      fileName: 'File Three',
      fileType: 'pdf',
      fields: {
        fieldC: { Gemini: 'Wrong', 'Ground Truth': 'Right' },
      },
      comparisonResults: {
        fieldC: { Gemini: { isMatch: false, matchType: 'llm', confidence: 'low' } },
      },
    },
  ],
  averages: {},
};

describe('optimizer sampling utils', () => {
  it('builds failure map for specified fields', () => {
    const map = buildFieldFailureMap(mockAccuracyData, ['fieldA', 'fieldB'], 'Gemini');
    expect(Object.keys(map)).toEqual(['fieldA', 'fieldB']);
    expect(map['fieldA']).toHaveLength(1);
    expect(map['fieldB']).toHaveLength(2);
    expect(map['fieldB'][0].docId).toBe('file-1');
  });

  it('selects docs prioritizing overlap and limits to six', () => {
    const failureMap = buildFieldFailureMap(mockAccuracyData, ['fieldA', 'fieldB', 'fieldC'], 'Gemini');
    const { docs, fieldToDocIds } = selectDocsForOptimizer(failureMap);

    expect(docs.length).toBeLessThanOrEqual(3);
    expect(fieldToDocIds.fieldA).toEqual(['file-1']);
    expect(fieldToDocIds.fieldB[0]).toBe('file-1');
    expect(fieldToDocIds.fieldC[0]).toBe('file-2');
  });
});
