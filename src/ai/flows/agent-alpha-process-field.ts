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
  logger.debug(`   Input fieldPrompt: "${fieldPrompt?.substring(0, 80)}..." (${fieldPrompt?.length || 0} chars)`);

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

  const result: AgentAlphaFieldResult = {
    fieldKey,
    fieldName,
    initialAccuracy,
    finalAccuracy,
    iterationCount,
    initialPrompt,
    finalPrompt: bestPrompt, // Use best prompt, not currentPrompt
    converged,
    sampledDocIds,
  };

  const improvement = ((finalAccuracy - initialAccuracy) * 100).toFixed(1);
  logger.info(`   📊 Summary: ${(initialAccuracy * 100).toFixed(1)}% → ${(finalAccuracy * 100).toFixed(1)}% (+${improvement}%)`);
  logger.debug(`   📋 Result: initialPrompt="${initialPrompt.substring(0, 50)}..." finalPrompt="${bestPrompt.substring(0, 50)}..."`);

  return result;
}

