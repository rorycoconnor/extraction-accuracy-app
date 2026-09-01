'use server';

import { logger } from '@/lib/logger';
import { runFieldIteration } from './agent-alpha-iteration';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import { getExamplePromptForField } from '@/lib/agent-alpha-prompts';
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
  // Train/holdout split for overfitting prevention
  trainDocIds: string[];
  holdoutDocIds: string[];
  holdoutThreshold?: number; // Min accuracy on holdout to converge (default 1.0)
  templateKey: string;
  testModel: string;
  promptGenerationModel?: string; // Model used for generating prompts (default: from config)
  fieldIndex: number; // For logging: "1 of 5"
  totalFields: number;
  maxIterations?: number; // Override default max iterations
  systemPromptOverride?: string; // Custom system prompt to prepend
  // Deterministic mode - downgrade llm-judge to near-exact for stable optimization
  preferDeterministicCompare?: boolean;
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
    trainDocIds,
    holdoutDocIds,
    holdoutThreshold = AGENT_ALPHA_CONFIG.HOLDOUT_THRESHOLD,
    templateKey,
    testModel,
    promptGenerationModel = AGENT_ALPHA_CONFIG.PROMPT_GEN_MODEL,
    fieldIndex,
    totalFields,
    maxIterations: maxIterationsParam = AGENT_ALPHA_CONFIG.MAX_ITERATIONS,
    systemPromptOverride,
    preferDeterministicCompare = AGENT_ALPHA_CONFIG.PREFER_DETERMINISTIC_COMPARE,
  } = params;
  
  // Use train docs for iteration testing, or fall back to all sampled docs if no split
  const effectiveTrainDocs = trainDocIds.length > 0 ? trainDocIds : sampledDocIds;
  const hasHoldout = holdoutDocIds.length > 0;
  
  // Apply deterministic mode: downgrade llm-judge to near-exact-string for stable optimization
  let effectiveCompareConfig = compareConfig;
  if (preferDeterministicCompare && compareConfig?.compareType === 'llm-judge') {
    logger.info(`   ⚡ Deterministic mode: downgrading llm-judge to near-exact-string`);
    effectiveCompareConfig = {
      ...compareConfig,
      compareType: 'near-exact-string',
    };
  }

  // Check if field has ANY ground truth across sampled docs
  // Empty strings, "-", and whitespace-only values are considered "no ground truth"
  const hasAnyGroundTruth = Object.values(groundTruth).some(
    gt => gt && gt.trim() !== '' && gt.trim() !== '-'
  );
  
  // If no ground truth exists, limit to 1 iteration (just generate a good prompt)
  // There's no point iterating multiple times when we can't measure accuracy
  let maxIterations = maxIterationsParam;
  if (!hasAnyGroundTruth) {
    logger.info(`\n📝 Agent-Alpha: [${fieldIndex}/${totalFields}] Processing field "${fieldName}"`);
    logger.info(`   ⚠️ No ground truth available - generating prompt only (1 iteration)`);
    maxIterations = 1;
  } else {
    logger.info(`\n📝 Agent-Alpha: [${fieldIndex}/${totalFields}] Processing field "${fieldName}"`);
    logger.info(`   Initial accuracy: ${(initialAccuracy * 100).toFixed(1)}%`);
  }
  logger.debug(`   Input fieldPrompt: "${fieldPrompt ? String(fieldPrompt).substring(0, 80) : 'none'}..." (${fieldPrompt?.length || 0} chars)`);

  // Determine initial prompt - use provided prompt OR generate a quality fallback
  // IMPORTANT: Never start with a generic "Extract the X" prompt - these always fail
  let currentPrompt: string;
  let userOriginalPrompt: string | null = null; // Track what the user actually had
  
  // Check if provided prompt is too generic/short
  const isGenericPrompt = (prompt: string): boolean => {
    const trimmed = prompt.trim();
    if (trimmed.length < 150) return true;
    if (/^extract the .{1,50}(from this document)?\.?$/i.test(trimmed)) return true;
    return false;
  };
  
  if (fieldPrompt && !isGenericPrompt(fieldPrompt)) {
    // User provided a good prompt - use it
    currentPrompt = fieldPrompt;
    userOriginalPrompt = fieldPrompt; // User had a real prompt
    logger.info(`   Using provided prompt (${currentPrompt.length} chars)`);
  } else {
    // Generate a quality prompt from our examples instead of using generic fallback
    currentPrompt = getExamplePromptForField(fieldName, fieldType, fieldOptions);
    // userOriginalPrompt stays null - user had no prompt or a generic one
    logger.info(`   Using example prompt for "${fieldName}" (${currentPrompt.length} chars) - provided prompt was too generic`);
  }
  
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
        sampledDocIds: effectiveTrainDocs, // Use train docs for iteration
        groundTruth,
        templateKey,
        testModel,
        promptGenerationModel,
        iterationNumber: iteration,
        maxIterations,
        options: fieldOptions,
        compareConfig: effectiveCompareConfig,
        systemPromptOverride,
      });

      finalAccuracy = iterationResult.accuracy;
      logger.info(`   Train accuracy: ${(finalAccuracy * 100).toFixed(1)}%`);

      // Check if converged on training set (100% accuracy reached)
      if (iterationResult.converged) {
        logger.info(`   ✅ Train set converged! Accuracy: ${(finalAccuracy * 100).toFixed(1)}%`);
        
        // If we have holdout docs, validate on them before declaring true convergence
        let holdoutAccuracy = 1.0;
        let holdoutPassed = true;
        
        if (hasHoldout) {
          logger.info(`   🧪 Validating on ${holdoutDocIds.length} holdout doc(s)...`);
          
          // Run holdout validation with the current prompt
          // validationOnly=true skips prompt generation (saves API calls)
          const holdoutResult = await runFieldIteration({
            fieldKey,
            fieldName,
            fieldType,
            currentPrompt,
            previousPrompts: [],
            sampledDocIds: holdoutDocIds,
            groundTruth,
            templateKey,
            testModel,
            promptGenerationModel,
            iterationNumber: iteration,
            maxIterations,
            options: fieldOptions,
            compareConfig: effectiveCompareConfig,
            systemPromptOverride,
            validationOnly: true, // Only compute accuracy, don't generate new prompt
          });
          
          holdoutAccuracy = holdoutResult.accuracy;
          holdoutPassed = holdoutAccuracy >= holdoutThreshold;
          
          if (holdoutPassed) {
            logger.info(`   ✅ Holdout validation PASSED: ${(holdoutAccuracy * 100).toFixed(1)}%`);
          } else {
            logger.warn(`   ⚠️ Holdout validation FAILED: ${(holdoutAccuracy * 100).toFixed(1)}% (threshold: ${(holdoutThreshold * 100).toFixed(1)}%)`);
            logger.warn(`   🔄 Continuing optimization to improve generalization...`);
          }
        }
        
        // Only consider truly converged if holdout validation passed (or no holdout)
        if (holdoutPassed) {
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
        // If holdout failed, continue to next iteration (don't break)
      }

      // Track best accuracy and prompt (BEFORE updating currentPrompt)
      // The currentPrompt is what we just tested and got finalAccuracy with
      if (finalAccuracy > bestAccuracy) {
        bestAccuracy = finalAccuracy;
        bestPrompt = currentPrompt; // Save the prompt that achieved this accuracy
        logger.info(`   📈 New best accuracy: ${(bestAccuracy * 100).toFixed(1)}%`);
      } else if (finalAccuracy === bestAccuracy && currentPrompt.length > bestPrompt.length) {
        // Same accuracy but the prompt we just TESTED is more detailed - prefer it
        // This helps when the simple prompt gets lucky but a detailed prompt is more robust
        // FIX: Use currentPrompt (what we tested), not iterationResult.newPrompt (what we'll test next)
        bestPrompt = currentPrompt;
        logger.info(`   📝 Same accuracy but using more detailed prompt (${bestPrompt.length} chars vs ${currentPrompt.length} chars)`);
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

  // Use the best result from our iterations as the starting point.
  // Note: bestAccuracy is from the TRAIN subset, which is optimistic vs. unseen docs.
  if (bestAccuracy >= 0) {
    finalAccuracy = bestAccuracy;
  }

  // Consistent, held-out final evaluation.
  // The per-iteration accuracy is measured on the TRAIN subset, so it can be optimistic
  // and isn't comparable to the original all-docs accuracy. Here we re-measure the chosen
  // prompt on a fixed eval set (holdout when available) and decide keep-vs-replace via a
  // fair head-to-head against the user's original prompt on those SAME docs.
  let improved: boolean;
  let finalPromptToUse: string;
  let baselineAccuracy = initialAccuracy;
  let finalAccuracyEvalSet: AgentAlphaFieldResult['finalAccuracyEvalSet'] = 'none';

  if (!hasAnyGroundTruth) {
    // Nothing to measure against - we generated a prompt from scratch, so treat as improved.
    improved = true;
    finalPromptToUse = bestPrompt;
    logger.info(`   ✅ Generated prompt for field without ground truth`);
  } else {
    const evalDocIds = hasHoldout ? holdoutDocIds : effectiveTrainDocs;
    finalAccuracyEvalSet = hasHoldout ? 'holdout' : 'train';

    try {
      // Measure the chosen prompt on the eval set (unseen holdout when available).
      const finalEval = await runFieldIteration({
        fieldKey,
        fieldName,
        fieldType,
        currentPrompt: bestPrompt,
        previousPrompts: [],
        sampledDocIds: evalDocIds,
        groundTruth,
        templateKey,
        testModel,
        promptGenerationModel,
        iterationNumber: iterationCount,
        maxIterations,
        options: fieldOptions,
        compareConfig: effectiveCompareConfig,
        systemPromptOverride,
        validationOnly: true,
      });
      finalAccuracy = finalEval.accuracy;

      // Establish a fair baseline on the SAME docs. Only worth re-measuring when the user
      // actually had a real prompt to beat; otherwise initialAccuracy (from a generic/absent
      // prompt) is already the honest baseline and we avoid an extra extraction pass.
      if (userOriginalPrompt) {
        const baselineEval = await runFieldIteration({
          fieldKey,
          fieldName,
          fieldType,
          currentPrompt: userOriginalPrompt,
          previousPrompts: [],
          sampledDocIds: evalDocIds,
          groundTruth,
          templateKey,
          testModel,
          promptGenerationModel,
          iterationNumber: iterationCount,
          maxIterations,
          options: fieldOptions,
          compareConfig: effectiveCompareConfig,
          systemPromptOverride,
          validationOnly: true,
        });
        baselineAccuracy = baselineEval.accuracy;
      }

      improved = finalAccuracy >= baselineAccuracy;
      finalPromptToUse = improved ? bestPrompt : (userOriginalPrompt ?? initialPrompt);

      logger.info(`   🧪 Final eval on ${finalAccuracyEvalSet} set (${evalDocIds.length} doc(s)): ${(finalAccuracy * 100).toFixed(1)}% vs baseline ${(baselineAccuracy * 100).toFixed(1)}%`);
      if (!improved) {
        logger.warn(`   ⚠️ Optimized prompt did NOT beat the baseline on unseen docs - keeping original, will NOT recommend update`);
      }
    } catch (evalError) {
      // If the consistent eval fails, fall back to the previous train-subset decision so a
      // transient extraction error doesn't abort the whole field.
      logger.warn(`   ⚠️ Consistent final evaluation failed, falling back to train-subset decision:`, evalError as Error);
      improved = finalAccuracy >= initialAccuracy;
      finalPromptToUse = improved ? bestPrompt : initialPrompt;
      finalAccuracyEvalSet = 'none';
    }
  }

  const result: AgentAlphaFieldResult = {
    fieldKey,
    fieldName,
    initialAccuracy,
    finalAccuracy,
    iterationCount,
    initialPrompt,
    userOriginalPrompt, // null if user had no prompt or generic prompt
    finalPrompt: finalPromptToUse,
    converged,
    sampledDocIds,
    improved,
    hasGroundTruth: hasAnyGroundTruth, // Track if accuracy metrics are meaningful
    baselineAccuracy,
    finalAccuracyEvalSet,
    // Experiment metadata for auditability
    experimentMetadata: {
      testModel,
      compareConfig,
      trainDocIds: effectiveTrainDocs,
      holdoutDocIds,
    },
  };

  const improvement = ((finalAccuracy - initialAccuracy) * 100).toFixed(1);
  const improvementSign = finalAccuracy >= initialAccuracy ? '+' : '';
  logger.info(`   📊 Summary: ${(initialAccuracy * 100).toFixed(1)}% → ${(finalAccuracy * 100).toFixed(1)}% (${improvementSign}${improvement}%)`);
  logger.debug(`   📋 Result: initialPrompt="${String(initialPrompt).substring(0, 50)}..." finalPrompt="${String(finalPromptToUse).substring(0, 50)}..."`);

  return result;
}

