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
  // Holdout validation split
  trainDocIds: string[];
  holdoutDocIds: string[];
};

/**
 * Select up to maxDocs documents for testing with train/holdout split
 * 
 * Strategy:
 * 1. First, use greedy algorithm to select documents that cover the most failing fields
 * 2. Then, if we haven't reached maxDocs, add more documents (even successful ones) 
 *    to improve testing coverage and robustness
 * 3. Split selected docs into train and holdout sets based on holdoutRatio
 * 
 * @param failureMap Map of field keys to their failures
 * @param maxDocs Maximum number of documents to select (defaults to config value)
 * @param allDocIds Optional: all available document IDs to sample from (for padding)
 * @param holdoutRatio Ratio of docs to hold out for validation (default from config)
 */
export function selectDocsForAgentAlpha(
  failureMap: FieldFailureMap,
  maxDocs: number = AGENT_ALPHA_CONFIG.MAX_DOCS,
  allDocIds?: string[],
  holdoutRatio: number = AGENT_ALPHA_CONFIG.HOLDOUT_RATIO
): AgentAlphaSamplingResult {
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

  while (selectedDocs.length < maxDocs && remainingDocs.length > 0) {
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
      break; // No more useful documents for field coverage
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

  // IMPORTANT: If we haven't reached maxDocs yet, add more documents from the remaining failures
  // This ensures we test on more documents even if field coverage is already complete
  while (selectedDocs.length < maxDocs && remainingDocs.length > 0) {
    const nextDoc = remainingDocs.shift()!;
    const docName = failureMap[nextDoc.fields[0]]?.find((f) => f.docId === nextDoc.docId)?.docName ?? nextDoc.docId;
    selectedDocs.push({
      docId: nextDoc.docId,
      docName,
      fieldKeys: nextDoc.fields,
    });
  }

  // If we STILL haven't reached maxDocs and we have allDocIds, add documents that passed
  // This is important because testing only on failures doesn't catch regressions
  if (allDocIds && selectedDocs.length < maxDocs) {
    const selectedDocIdSet = new Set(selectedDocs.map(d => d.docId));
    const unselectedDocs = allDocIds.filter(id => !selectedDocIdSet.has(id));
    
    for (const docId of unselectedDocs) {
      if (selectedDocs.length >= maxDocs) break;
      
      // Add document with empty fieldKeys (no failures, but useful for testing)
      selectedDocs.push({
        docId,
        docName: docId, // Name will be updated by caller
        fieldKeys: [], // No failures in this doc
      });
    }
  }

  // Build field-to-docs mapping
  // For fields, include ALL selected docs (not just those with failures)
  // This ensures we test prompts on both failing AND passing documents
  const fieldToDocIds: Record<string, string[]> = {};
  for (const fieldKey of fieldKeys) {
    // Include all selected docs for testing, not just those with failures
    fieldToDocIds[fieldKey] = selectedDocs.map((doc) => doc.docId);
  }

  // Split docs into train and holdout sets
  // Holdout docs are used for validation to prevent overfitting
  const allSelectedDocIds = selectedDocs.map((doc) => doc.docId);
  const { trainDocIds, holdoutDocIds } = splitTrainHoldout(allSelectedDocIds, holdoutRatio);

  return {
    docs: selectedDocs,
    fieldToDocIds,
    trainDocIds,
    holdoutDocIds,
  };
}

/**
 * Split document IDs into train and holdout sets
 * Ensures at least 1 doc in holdout if there are enough docs
 * 
 * @param docIds All document IDs to split
 * @param holdoutRatio Ratio of docs to hold out (0.0 to 1.0)
 * @returns Object with trainDocIds and holdoutDocIds arrays
 */
export function splitTrainHoldout(
  docIds: string[],
  holdoutRatio: number
): { trainDocIds: string[]; holdoutDocIds: string[] } {
  const totalDocs = docIds.length;
  
  // If we have fewer than 3 docs, don't split - use all for training
  // (holdout validation requires meaningful sample sizes)
  if (totalDocs < 3 || holdoutRatio <= 0) {
    return {
      trainDocIds: [...docIds],
      holdoutDocIds: [],
    };
  }
  
  // Calculate holdout count, ensuring at least 1 doc if ratio > 0
  let holdoutCount = Math.round(totalDocs * holdoutRatio);
  
  // Ensure we have at least 1 holdout doc if ratio > 0 and enough docs
  if (holdoutRatio > 0 && holdoutCount === 0 && totalDocs >= 3) {
    holdoutCount = 1;
  }
  
  // Ensure we don't hold out more than half the docs
  holdoutCount = Math.min(holdoutCount, Math.floor(totalDocs / 2));
  
  // Take holdout from the END of the array (greedy selection prioritized important docs first)
  // This way, training gets the most important failure-covering docs
  const trainDocIds = docIds.slice(0, totalDocs - holdoutCount);
  const holdoutDocIds = docIds.slice(totalDocs - holdoutCount);
  
  return {
    trainDocIds,
    holdoutDocIds,
  };
}

