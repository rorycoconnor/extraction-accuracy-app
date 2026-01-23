/**
 * Agent-Alpha Document Sampling Tests
 * 
 * These tests verify the document sampling logic that selects which documents
 * to use for testing prompts. The algorithm should maximize field coverage
 * while minimizing the number of documents tested.
 */

import { describe, test, expect } from 'vitest';
import {
  buildFieldFailureMap,
  selectDocsForAgentAlpha,
  type AgentAlphaSamplingDoc,
  type AgentAlphaSamplingResult,
} from '@/lib/agent-alpha-sampling';
import type { AccuracyData } from '@/lib/types';
import type { FieldFailureMap } from '@/lib/optimizer-types';

describe('Agent-Alpha Document Sampling', () => {
  
  // Helper to create mock accuracy data
  const createMockAccuracyData = (
    results: Array<{
      id: string;
      fileName: string;
      fields: Record<string, Record<string, string>>;
      comparisonResults?: Record<string, Record<string, { isMatch: boolean; details?: string }>>;
    }>
  ): AccuracyData => ({
    templateKey: 'test-template',
    baseModel: 'test-model',
    fields: [],
    results: results.map(r => ({
      id: r.id,
      fileName: r.fileName,
      fileType: 'pdf',
      fields: r.fields,
      comparisonResults: r.comparisonResults,
    })),
    averages: {},
  });

  describe('buildFieldFailureMap', () => {
    test('should build failure map from accuracy data', () => {
      const accuracyData = createMockAccuracyData([
        {
          id: 'doc1',
          fileName: 'doc1.pdf',
          fields: {
            field1: { 'Ground Truth': 'Value1', 'model1': 'Wrong1' },
            field2: { 'Ground Truth': 'Value2', 'model1': 'Value2' },
          },
          comparisonResults: {
            field1: { model1: { isMatch: false, details: 'Mismatch' } },
            field2: { model1: { isMatch: true } },
          },
        },
        {
          id: 'doc2',
          fileName: 'doc2.pdf',
          fields: {
            field1: { 'Ground Truth': 'Value3', 'model1': 'Value3' },
            field2: { 'Ground Truth': 'Value4', 'model1': 'Wrong4' },
          },
          comparisonResults: {
            field1: { model1: { isMatch: true } },
            field2: { model1: { isMatch: false, details: 'Mismatch' } },
          },
        },
      ]);

      const failureMap = buildFieldFailureMap(
        accuracyData,
        ['field1', 'field2'],
        'model1'
      );

      // field1 failed in doc1 only
      expect(failureMap['field1'].length).toBe(1);
      expect(failureMap['field1'][0].docId).toBe('doc1');
      expect(failureMap['field1'][0].groundTruth).toBe('Value1');
      expect(failureMap['field1'][0].extractedValue).toBe('Wrong1');

      // field2 failed in doc2 only
      expect(failureMap['field2'].length).toBe(1);
      expect(failureMap['field2'][0].docId).toBe('doc2');
    });

    test('should return empty arrays for fields with no failures', () => {
      const accuracyData = createMockAccuracyData([
        {
          id: 'doc1',
          fileName: 'doc1.pdf',
          fields: {
            field1: { 'Ground Truth': 'Value1', 'model1': 'Value1' },
          },
          comparisonResults: {
            field1: { model1: { isMatch: true } },
          },
        },
      ]);

      const failureMap = buildFieldFailureMap(
        accuracyData,
        ['field1'],
        'model1'
      );

      expect(failureMap['field1'].length).toBe(0);
    });

    test('should handle missing comparison results gracefully', () => {
      const accuracyData = createMockAccuracyData([
        {
          id: 'doc1',
          fileName: 'doc1.pdf',
          fields: {
            field1: { 'Ground Truth': 'Value1' },
          },
          // No comparisonResults
        },
      ]);

      const failureMap = buildFieldFailureMap(
        accuracyData,
        ['field1'],
        'model1'
      );

      // Should not crash, just return empty
      expect(failureMap['field1'].length).toBe(0);
    });
  });

  describe('selectDocsForAgentAlpha', () => {
    test('should select documents that cover all failing fields', () => {
      const failureMap: FieldFailureMap = {
        field1: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'A', extractedValue: 'B', comparisonReason: '' },
          { docId: 'doc2', docName: 'doc2.pdf', groundTruth: 'C', extractedValue: 'D', comparisonReason: '' },
        ],
        field2: [
          { docId: 'doc2', docName: 'doc2.pdf', groundTruth: 'E', extractedValue: 'F', comparisonReason: '' },
          { docId: 'doc3', docName: 'doc3.pdf', groundTruth: 'G', extractedValue: 'H', comparisonReason: '' },
        ],
        field3: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'I', extractedValue: 'J', comparisonReason: '' },
        ],
      };

      const result = selectDocsForAgentAlpha(failureMap, 10);

      // Should select docs that cover all fields
      expect(result.docs.length).toBeGreaterThan(0);
      expect(result.docs.length).toBeLessThanOrEqual(3);
      
      // All fields should be covered
      expect(Object.keys(result.fieldToDocIds)).toContain('field1');
      expect(Object.keys(result.fieldToDocIds)).toContain('field2');
      expect(Object.keys(result.fieldToDocIds)).toContain('field3');
    });

    test('should use greedy algorithm to minimize documents selected', () => {
      // doc1 covers field1 and field3
      // doc2 covers field1 and field2
      // doc3 covers field2 only
      // Optimal: doc1 + doc2 covers all fields
      const failureMap: FieldFailureMap = {
        field1: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'A', extractedValue: 'B', comparisonReason: '' },
          { docId: 'doc2', docName: 'doc2.pdf', groundTruth: 'C', extractedValue: 'D', comparisonReason: '' },
        ],
        field2: [
          { docId: 'doc2', docName: 'doc2.pdf', groundTruth: 'E', extractedValue: 'F', comparisonReason: '' },
          { docId: 'doc3', docName: 'doc3.pdf', groundTruth: 'G', extractedValue: 'H', comparisonReason: '' },
        ],
        field3: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'I', extractedValue: 'J', comparisonReason: '' },
        ],
      };

      // Use maxDocs=2 to test greedy optimization specifically
      // The algorithm adds more docs after coverage, so we need to limit maxDocs
      const result = selectDocsForAgentAlpha(failureMap, 2);

      // Greedy should select exactly 2 docs that cover all 3 fields
      expect(result.docs.length).toBe(2);
      
      // All fields should be covered by the 2 selected docs
      const coveredFields = new Set<string>();
      result.docs.forEach(doc => doc.fieldKeys.forEach(f => coveredFields.add(f)));
      expect(coveredFields.size).toBe(3);
    });

    test('should respect maxDocs limit', () => {
      const failureMap: FieldFailureMap = {
        field1: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'A', extractedValue: 'B', comparisonReason: '' },
        ],
        field2: [
          { docId: 'doc2', docName: 'doc2.pdf', groundTruth: 'C', extractedValue: 'D', comparisonReason: '' },
        ],
        field3: [
          { docId: 'doc3', docName: 'doc3.pdf', groundTruth: 'E', extractedValue: 'F', comparisonReason: '' },
        ],
        field4: [
          { docId: 'doc4', docName: 'doc4.pdf', groundTruth: 'G', extractedValue: 'H', comparisonReason: '' },
        ],
        field5: [
          { docId: 'doc5', docName: 'doc5.pdf', groundTruth: 'I', extractedValue: 'J', comparisonReason: '' },
        ],
      };

      const result = selectDocsForAgentAlpha(failureMap, 2);

      // Should not exceed maxDocs
      expect(result.docs.length).toBeLessThanOrEqual(2);
    });

    test('should return empty result for empty failure map', () => {
      const failureMap: FieldFailureMap = {};

      const result = selectDocsForAgentAlpha(failureMap, 10);

      expect(result.docs.length).toBe(0);
      expect(Object.keys(result.fieldToDocIds).length).toBe(0);
    });

    test('should handle single document covering all fields', () => {
      const failureMap: FieldFailureMap = {
        field1: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'A', extractedValue: 'B', comparisonReason: '' },
        ],
        field2: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'C', extractedValue: 'D', comparisonReason: '' },
        ],
        field3: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'E', extractedValue: 'F', comparisonReason: '' },
        ],
      };

      const result = selectDocsForAgentAlpha(failureMap, 10);

      // One doc covers everything
      expect(result.docs.length).toBe(1);
      expect(result.docs[0].docId).toBe('doc1');
      expect(result.docs[0].fieldKeys).toContain('field1');
      expect(result.docs[0].fieldKeys).toContain('field2');
      expect(result.docs[0].fieldKeys).toContain('field3');
    });

    test('should build correct fieldToDocIds mapping', () => {
      const failureMap: FieldFailureMap = {
        field1: [
          { docId: 'doc1', docName: 'doc1.pdf', groundTruth: 'A', extractedValue: 'B', comparisonReason: '' },
          { docId: 'doc2', docName: 'doc2.pdf', groundTruth: 'C', extractedValue: 'D', comparisonReason: '' },
        ],
        field2: [
          { docId: 'doc2', docName: 'doc2.pdf', groundTruth: 'E', extractedValue: 'F', comparisonReason: '' },
        ],
      };

      const result = selectDocsForAgentAlpha(failureMap, 10);

      // Each field should have associated doc IDs
      expect(result.fieldToDocIds['field1'].length).toBeGreaterThan(0);
      expect(result.fieldToDocIds['field2'].length).toBeGreaterThan(0);
      
      // Doc IDs should be from selected docs
      const selectedDocIds = result.docs.map(d => d.docId);
      result.fieldToDocIds['field1'].forEach(docId => {
        expect(selectedDocIds).toContain(docId);
      });
    });
  });

  describe('AgentAlphaSamplingDoc structure', () => {
    test('should have correct structure', () => {
      const doc: AgentAlphaSamplingDoc = {
        docId: 'doc123',
        docName: 'contract.pdf',
        fieldKeys: ['field1', 'field2'],
      };

      expect(doc.docId).toBe('doc123');
      expect(doc.docName).toBe('contract.pdf');
      expect(doc.fieldKeys).toEqual(['field1', 'field2']);
    });
  });

  describe('AgentAlphaSamplingResult structure', () => {
    test('should have correct structure', () => {
      const result: AgentAlphaSamplingResult = {
        docs: [
          { docId: 'doc1', docName: 'doc1.pdf', fieldKeys: ['field1'] },
        ],
        fieldToDocIds: {
          field1: ['doc1'],
        },
      };

      expect(result.docs.length).toBe(1);
      expect(result.fieldToDocIds['field1']).toEqual(['doc1']);
    });
  });
});



