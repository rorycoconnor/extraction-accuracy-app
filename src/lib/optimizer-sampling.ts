import type { AccuracyData, FileResult } from '@/lib/types';
import type {
  FieldFailureDetail,
  FieldFailureMap,
  OptimizerSamplingDoc,
  OptimizerSamplingResult,
} from '@/lib/optimizer-types';

const GROUND_TRUTH_KEY = 'Ground Truth';

export function buildFieldFailureMap(
  accuracyData: AccuracyData,
  failingFieldKeys: string[],
  modelName: string
): FieldFailureMap {
  const failures: FieldFailureMap = {};
  if (!accuracyData.results?.length) {
    return failures;
  }

  const relevantFields = new Set(failingFieldKeys);

  accuracyData.results.forEach((fileResult) => {
    if (!fileResult.fields) {
      return;
    }

    relevantFields.forEach((fieldKey) => {
      const fieldOutputs = fileResult.fields[fieldKey];
      if (!fieldOutputs) return;

      const comparisonMeta = fileResult.comparisonResults?.[fieldKey]?.[modelName];
      const extractedValue = fieldOutputs[modelName];
      const groundTruth = fieldOutputs[GROUND_TRUTH_KEY];

      const isFailure = comparisonMeta?.isMatch === false
        || (typeof extractedValue === 'string'
          && typeof groundTruth === 'string'
          && extractedValue.trim() !== groundTruth.trim());

      if (!isFailure) {
        return;
      }

      const detail: FieldFailureDetail = {
        docId: fileResult.id,
        docName: fileResult.fileName,
        groundTruth: groundTruth ?? '',
        extractedValue: extractedValue ?? '',
        comparisonReason: comparisonMeta?.details,
      };

      if (!failures[fieldKey]) {
        failures[fieldKey] = [];
      }

      failures[fieldKey].push(detail);
    });
  });

  return failures;
}

export function selectDocsForOptimizer(failureMap: FieldFailureMap): OptimizerSamplingResult {
  const docs: OptimizerSamplingDoc[] = [];
  const fieldToDocIds: Record<string, string[]> = {};
  const docCoverage = new Map<string, { docName: string; fields: Set<string> }>();

  Object.entries(failureMap).forEach(([fieldKey, failureDetails]) => {
    fieldToDocIds[fieldKey] = [];
    failureDetails.forEach((detail) => {
      if (!docCoverage.has(detail.docId)) {
        docCoverage.set(detail.docId, {
          docName: detail.docName,
          fields: new Set(),
        });
      }
      docCoverage.get(detail.docId)!.fields.add(fieldKey);
    });
  });

  const remainingFields = new Set(Object.keys(failureMap));
  const MAX_DOCS = 6;
  const MAX_DOCS_PER_FIELD = 3;

  while (docs.length < MAX_DOCS && docCoverage.size > 0) {
    let bestDocId: string | null = null;
    let bestScore = 0;

    for (const [docId, meta] of docCoverage.entries()) {
      if (docs.some((doc) => doc.docId === docId)) {
        continue;
      }

      const availableFields = Array.from(meta.fields).filter(
        (fieldKey) => (fieldToDocIds[fieldKey]?.length ?? 0) < MAX_DOCS_PER_FIELD
      );
      const score = availableFields.length;

      if (score > bestScore) {
        bestScore = score;
        bestDocId = docId;
      } else if (score === bestScore && score > 0 && bestDocId) {
        // Tie-breaker: prefer lexicographically smaller name for determinism
        const currentName = docCoverage.get(docId)?.docName ?? '';
        const bestName = docCoverage.get(bestDocId)?.docName ?? '';
        if (currentName.localeCompare(bestName) < 0) {
          bestDocId = docId;
        }
      }
    }

    if (!bestDocId || bestScore === 0) {
      break;
    }

    const bestMeta = docCoverage.get(bestDocId);
    if (!bestMeta) {
      break;
    }

    const appliedFields = Array.from(bestMeta.fields).filter(
      (fieldKey) => (fieldToDocIds[fieldKey]?.length ?? 0) < MAX_DOCS_PER_FIELD
    );

    docs.push({
      docId: bestDocId,
      docName: bestMeta.docName,
      fieldKeys: appliedFields,
    });

    appliedFields.forEach((fieldKey) => {
      if (fieldToDocIds[fieldKey].length < MAX_DOCS_PER_FIELD) {
        fieldToDocIds[fieldKey].push(bestDocId);
        if (fieldToDocIds[fieldKey].length > 0) {
          remainingFields.delete(fieldKey);
        }
      }
    });

    if (remainingFields.size === 0) {
      break;
    }
  }

  return { docs, fieldToDocIds };
}
