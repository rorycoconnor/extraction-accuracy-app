'use server';

import { logger } from '@/lib/logger';
import { runFieldIteration } from './agent-alpha-iteration';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import type { AccuracyField } from '@/lib/types';
import type { FieldCompareConfig } from '@/lib/compare-types';
import type { AgentAlphaFieldResult } from '@/lib/agent-alpha-types';

export type ProcessFieldParams = {
  fieldKey: string;
  fieldName: string;
  fieldType: AccuracyField['type'];
  fieldPrompt: string;
  fieldOptions?: Array<{ key: string }>;
  compareConfig?: FieldCompareConfig; // Comparison config for this field
  initialAccuracy: number;
  groundTruth: Record<string, string>; // docId -> groundTruthValue
  sampledDocIds: string[];
  templateKey: string;
  testModel: string;
  fieldIndex: number; // For logging: "1 of 5"
  totalFields: number;
  maxIterations?: number; // Override default max iterations
  systemPromptOverride?: string; // Custom system prompt to prepend
};

/**
 * Process a single field through Agent-Alpha iterations
 * Returns field result for preview/approval
 */
export async function processAgentAlphaField(params: ProcessFieldParams): Promise<AgentAlphaFieldResult> {
  const {
    fieldKey,
    fieldName,
    fieldType,
    fieldPrompt,
    fieldOptions,
    compareConfig,
    initialAccuracy,
    groundTruth,
    sampledDocIds,
    templateKey,
    testModel,
    fieldIndex,
    totalFields,
    maxIterations = AGENT_ALPHA_CONFIG.MAX_ITERATIONS,
    systemPromptOverride,
  } = params;

  logger.info(`\n📝 Agent-Alpha: [${fieldIndex}/${totalFields}] Processing field "${fieldName}"`);
  logger.info(`   Initial accuracy: ${(initialAccuracy * 100).toFixed(1)}%`);
  logger.debug(`   Input fieldPrompt: "${fieldPrompt ? String(fieldPrompt).substring(0, 80) : 'none'}..." (${fieldPrompt?.length || 0} chars)`);

  let currentPrompt = fieldPrompt || `Extract the ${fieldName} from this document.`;
  const initialPrompt = currentPrompt;
  const previousPrompts: string[] = [];
  let finalAccuracy = initialAccuracy;
  // Initialize bestAccuracy to -1 so the first iteration's result always becomes the baseline
  // This is important because initialAccuracy is calculated on ALL docs, but we test on a SUBSET
  let bestAccuracy = -1; 
  let bestPrompt = currentPrompt; // Track the prompt that achieved best accuracy
  let converged = false;
  let iterationCount = 0;

  // Iterate up to maxIterations times
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    iterationCount = iteration;

    try {
      logger.info(`   Iteration ${iteration}/${maxIterations}...`);

      const iterationResult = await runFieldIteration({
        fieldKey,
        fieldName,
        fieldType,
        currentPrompt,
        previousPrompts,
        sampledDocIds,
        groundTruth,
        templateKey,
        testModel,
        iterationNumber: iteration,
        maxIterations,
        options: fieldOptions,
        compareConfig,
        systemPromptOverride,
      });

      finalAccuracy = iterationResult.accuracy;
      logger.info(`   Accuracy: ${(finalAccuracy * 100).toFixed(1)}%`);

      // Check if converged (100% accuracy reached)
      if (iterationResult.converged) {
        logger.info(`   ✅ Converged! Accuracy: ${(finalAccuracy * 100).toFixed(1)}%`);
        
        // IMPORTANT: Even if we achieved 100% accuracy, if this is iteration 1 and
        // we're using a simple/default prompt, we should still generate an improved
        // prompt for production robustness
        const isSimplePrompt = currentPrompt.length < 100 || 
          currentPrompt.toLowerCase().startsWith('extract the ');
        
        if (iteration === 1 && isSimplePrompt) {
          logger.info(`   🔄 Generating robust prompt despite 100% accuracy (simple prompt detected)`);
          // Use the generated newPrompt instead of the simple one
          // The newPrompt was generated based on the successful extractions
          if (iterationResult.newPrompt && iterationResult.newPrompt.length > currentPrompt.length) {
            bestPrompt = iterationResult.newPrompt;
            logger.info(`   ✅ Using generated robust prompt (${bestPrompt.length} chars)`);
          } else {
            bestPrompt = currentPrompt;
          }
        } else {
          // When converged with a non-simple prompt, keep the current prompt
          bestPrompt = currentPrompt;
        }
        bestAccuracy = finalAccuracy;
        converged = true;
        break;
      }

      // Track best accuracy and prompt (BEFORE updating currentPrompt)
      // The currentPrompt is what we just tested and got finalAccuracy with
      if (finalAccuracy > bestAccuracy) {
        bestAccuracy = finalAccuracy;
        bestPrompt = currentPrompt; // Save the prompt that achieved this accuracy
        logger.info(`   📈 New best accuracy: ${(bestAccuracy * 100).toFixed(1)}%`);
      } else if (finalAccuracy === bestAccuracy && iterationResult.newPrompt.length > bestPrompt.length) {
        // Same accuracy but we have a more detailed prompt - prefer the detailed one
        // This helps when the simple prompt gets lucky but a detailed prompt is more robust
        bestPrompt = iterationResult.newPrompt;
        logger.info(`   📝 Same accuracy but using more detailed prompt (${bestPrompt.length} chars)`);
      }

      // Update for next iteration - the NEW prompt will be tested next
      previousPrompts.push(currentPrompt);
      currentPrompt = iterationResult.newPrompt;
      logger.info(`   📝 New prompt generated for next iteration (${currentPrompt.length} chars)`);

      // If this is the last iteration and still not converged
      if (iteration === maxIterations) {
        logger.info(`   ⚠️  Max iterations reached. Final accuracy: ${(finalAccuracy * 100).toFixed(1)}%`);
        // Use best accuracy/prompt if current iteration didn't improve
        if (bestAccuracy > finalAccuracy) {
          logger.info(`   📊 Using best accuracy from earlier iteration: ${(bestAccuracy * 100).toFixed(1)}%`);
          finalAccuracy = bestAccuracy;
          currentPrompt = bestPrompt;
        }
      }
    } catch (error) {
      logger.error(`   ❌ Error in iteration ${iteration}:`, error as Error);

      // If we have at least one successful iteration, use best result
      if (iteration > 1 && bestAccuracy > initialAccuracy) {
        logger.warn(`   Using best prompt from earlier iteration (${(bestAccuracy * 100).toFixed(1)}%)`);
        currentPrompt = bestPrompt;
        finalAccuracy = bestAccuracy;
        break;
      }

      // Otherwise, rethrow
      throw error;
    }
  }

  // Use the best result from our iterations
  // Note: bestAccuracy is from testing on sampled docs, which may differ from initialAccuracy (all docs)
  if (bestAccuracy >= 0) {
    finalAccuracy = bestAccuracy;
    logger.info(`   📊 Final accuracy on test docs: ${(finalAccuracy * 100).toFixed(1)}%`);
  }

  // Check if the new prompt actually improved accuracy
  // If not, we should NOT recommend updating the prompt
  const improved = finalAccuracy >= initialAccuracy;
  
  // If accuracy got worse, keep the original prompt
  const finalPromptToUse = improved ? bestPrompt : initialPrompt;
  
  if (!improved) {
    logger.warn(`   ⚠️ New prompt performed WORSE than original (${(finalAccuracy * 100).toFixed(1)}% < ${(initialAccuracy * 100).toFixed(1)}%)`);
    logger.warn(`   ⚠️ Keeping original prompt - will NOT recommend update`);
  }

  const result: AgentAlphaFieldResult = {
    fieldKey,
    fieldName,
    initialAccuracy,
    finalAccuracy,
    iterationCount,
    initialPrompt,
    finalPrompt: finalPromptToUse,
    converged,
    sampledDocIds,
    improved,
  };

  const improvement = ((finalAccuracy - initialAccuracy) * 100).toFixed(1);
  const improvementSign = finalAccuracy >= initialAccuracy ? '+' : '';
  logger.info(`   📊 Summary: ${(initialAccuracy * 100).toFixed(1)}% → ${(finalAccuracy * 100).toFixed(1)}% (${improvementSign}${improvement}%)`);
  logger.debug(`   📋 Result: initialPrompt="${String(initialPrompt).substring(0, 50)}..." finalPrompt="${String(finalPromptToUse).substring(0, 50)}..."`);

  return result;
}

/**
 * Process multiple fields in parallel on the server side.
 * This is a single server action that handles parallelization internally,
 * avoiding Next.js server action serialization.
 */
export async function processAgentAlphaFieldsBatch(
  fieldParams: ProcessFieldParams[],
  concurrencyLimit: number = AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY,
  onFieldComplete?: (result: AgentAlphaFieldResult, index: number) => void
): Promise<AgentAlphaFieldResult[]> {
  logger.info(`Agent-Alpha Batch: Processing ${fieldParams.length} fields with concurrency ${concurrencyLimit}`);
  
  const results: AgentAlphaFieldResult[] = new Array(fieldParams.length);
  const executing: Promise<void>[] = [];
  
  for (let i = 0; i < fieldParams.length; i++) {
    const params = fieldParams[i];
    const index = i;
    
    const p = processAgentAlphaField(params).then((result) => {
      results[index] = result;
      logger.info(`Agent-Alpha Batch: Field ${index + 1}/${fieldParams.length} completed (${params.fieldName})`);
      if (onFieldComplete) {
        try {
          onFieldComplete(result, index);
        } catch (e) {
          // Ignore callback errors
        }
      }
      // Remove from executing pool
      const idx = executing.indexOf(e);
      if (idx > -1) executing.splice(idx, 1);
    }).catch((error) => {
      logger.error(`Agent-Alpha Batch: Field ${index + 1} failed (${params.fieldName})`, error as Error);
      // Return a failed result
      results[index] = {
        fieldKey: params.fieldKey,
        fieldName: params.fieldName,
        initialAccuracy: params.initialAccuracy,
        finalAccuracy: params.initialAccuracy,
        iterationCount: 0,
        initialPrompt: params.fieldPrompt || '',
        finalPrompt: params.fieldPrompt || '',
        converged: false,
        sampledDocIds: params.sampledDocIds,
        improved: false,
      };
      const idx = executing.indexOf(e);
      if (idx > -1) executing.splice(idx, 1);
    });
    
    const e = p.then(() => {});
    executing.push(e);
    
    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }
  
  // Wait for all remaining fields
  await Promise.all(executing);
  
  logger.info(`Agent-Alpha Batch: All ${fieldParams.length} fields completed`);
  return results;
}

