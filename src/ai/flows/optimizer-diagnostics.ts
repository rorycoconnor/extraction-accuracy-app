'use server';

import type { BoxAIField } from '@/lib/schemas';
import { extractStructuredMetadataWithBoxAI } from '@/services/box';
import { logger } from '@/lib/logger';
import type {
  OptimizerDocumentDiagnosticsInput,
  OptimizerDocumentTheory,
} from '@/lib/optimizer-types';

const THEORY_MODEL = 'google__gemini_2_5_pro';
const MAX_THEORY_CHARS = 240;

export async function generateDocumentTheories(
  docs: OptimizerDocumentDiagnosticsInput[]
): Promise<OptimizerDocumentTheory[]> {
  return Promise.all(
    docs.map(async (doc) => {
      try {
        const fields: BoxAIField[] = doc.fieldFailures.map((failure) => ({
          key: failure.fieldKey,
          type: 'string',
          displayName: `${failure.fieldName} failure theory`,
          prompt: buildTheoryPrompt(failure),
        }));

        const response = await extractStructuredMetadataWithBoxAI({
          fileId: doc.fileId,
          fields,
          model: THEORY_MODEL,
        });

        const theories: Record<string, string> = {};
        Object.entries(response ?? {}).forEach(([fieldKey, value]) => {
          if (typeof value === 'string') {
            theories[fieldKey] = truncateTheory(value);
          }
        });

        logger.info('optimizer_diagnostics_success', {
          fileId: doc.fileId,
          fieldCount: Object.keys(theories).length,
        });

        return {
          docId: doc.fileId,
          docName: doc.fileName,
          theories,
        } satisfies OptimizerDocumentTheory;
      } catch (error) {
        logger.error('optimizer_diagnostics_failed', {
          fileId: doc.fileId,
          error,
        });
        return {
          docId: doc.fileId,
          docName: doc.fileName,
          theories: {},
          error: error instanceof Error ? error.message : 'unknown_error',
        } satisfies OptimizerDocumentTheory;
      }
    })
  );
}

function buildTheoryPrompt(failure: OptimizerDocumentDiagnosticsInput['fieldFailures'][number]): string {
  return [
    `Ground truth value: "${failure.groundTruth}"`,
    `Model value: "${failure.extractedValue}"`,
    'Explain in <=200 characters why the model value might be wrong for this field.',
    'Focus on document patterns or context clues, not generic advice.',
  ].join('\n');
}

function truncateTheory(theory: string): string {
  if (!theory) return '';
  if (theory.length <= MAX_THEORY_CHARS) {
    return theory.trim();
  }
  return `${theory.slice(0, MAX_THEORY_CHARS - 1).trim()}…`;
}
