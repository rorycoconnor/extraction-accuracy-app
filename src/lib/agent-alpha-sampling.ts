/**
 * Document sampling logic for Agent-Alpha
 * Selects documents with the most field failures for efficient testing
 */

import type { AccuracyData } from './types';
import type { FieldFailureMap, FieldFailureDetail } from './optimizer-types';
import { AGENT_ALPHA_CONFIG } from './agent-alpha-config';

/**
 * Build a map of field failures from accuracy data
 */
export function buildFieldFailureMap(
  accuracyData: AccuracyData,
  fieldKeys: string[],
  testModel: string
): FieldFailureMap {
  const failureMap: FieldFailureMap = {};

  for (const fieldKey of fieldKeys) {
    failureMap[fieldKey] = [];

    for (const fileResult of accuracyData.results) {
      const comparisonMeta = fileResult.comparisonResults?.[fieldKey]?.[testModel];
      
      if (!comparisonMeta || comparisonMeta.isMatch) {
        continue; // Skip if no comparison or it matched
      }

      const groundTruth = fileResult.fields[fieldKey]?.['Ground Truth'] ?? '';
      const extractedValue = fileResult.fields[fieldKey]?.[testModel] ?? '';

      failureMap[fieldKey].push({
        docId: fileResult.id,
        docName: fileResult.fileName,
        groundTruth,
        extractedValue,
        comparisonReason: comparisonMeta.details || '',
      });
    }
  }

  return failureMap;
}

export type AgentAlphaSamplingDoc = {
  docId: string;
  docName: string;
  fieldKeys: string[]; // Fields that failed in this document
};

export type AgentAlphaSamplingResult = {
  docs: AgentAlphaSamplingDoc[];
  fieldToDocIds: Record<string, string[]>;
};

/**
 * Select up to MAX_DOCS documents that cover the most failing fields
 * Uses greedy algorithm to maximize field coverage
 */
export function selectDocsForAgentAlpha(failureMap: FieldFailureMap): AgentAlphaSamplingResult {
  const fieldKeys = Object.keys(failureMap);
  const docToFields = new Map<string, Set<string>>();

  // Build reverse map: docId -> set of failing fields
  for (const fieldKey of fieldKeys) {
    const failures = failureMap[fieldKey] || [];
    for (const failure of failures) {
      if (!docToFields.has(failure.docId)) {
        docToFields.set(failure.docId, new Set());
      }
      docToFields.get(failure.docId)!.add(fieldKey);
    }
  }

  // Greedy selection: pick documents that cover the most uncovered fields
  const selectedDocs: AgentAlphaSamplingDoc[] = [];
  const coveredFields = new Set<string>();
  const remainingDocs = Array.from(docToFields.entries()).map(([docId, fields]) => ({
    docId,
    fields: Array.from(fields),
  }));

  while (selectedDocs.length < AGENT_ALPHA_CONFIG.MAX_DOCS && remainingDocs.length > 0) {
    // Find doc that covers the most uncovered fields
    let bestDoc: { docId: string; fields: string[] } | null = null;
    let bestScore = 0;

    for (const doc of remainingDocs) {
      const uncoveredCount = doc.fields.filter((f) => !coveredFields.has(f)).length;
      if (uncoveredCount > bestScore) {
        bestScore = uncoveredCount;
        bestDoc = doc;
      }
    }

    if (!bestDoc || bestScore === 0) {
      break; // No more useful documents
    }

    // Add best doc to selection
    const docName = failureMap[bestDoc.fields[0]]?.find((f) => f.docId === bestDoc!.docId)?.docName ?? bestDoc.docId;
    selectedDocs.push({
      docId: bestDoc.docId,
      docName,
      fieldKeys: bestDoc.fields,
    });

    // Mark fields as covered
    for (const fieldKey of bestDoc.fields) {
      coveredFields.add(fieldKey);
    }

    // Remove from remaining
    const index = remainingDocs.findIndex((d) => d.docId === bestDoc!.docId);
    if (index >= 0) {
      remainingDocs.splice(index, 1);
    }
  }

  // Build field-to-docs mapping
  const fieldToDocIds: Record<string, string[]> = {};
  for (const fieldKey of fieldKeys) {
    fieldToDocIds[fieldKey] = selectedDocs
      .filter((doc) => doc.fieldKeys.includes(fieldKey))
      .map((doc) => doc.docId);
  }

  return {
    docs: selectedDocs,
    fieldToDocIds,
  };
}

