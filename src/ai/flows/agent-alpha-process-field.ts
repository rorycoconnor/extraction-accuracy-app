'use server';

import { logger } from '@/lib/logger';
import { runFieldIteration } from './agent-alpha-iteration';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import { getExamplePromptForField } from '@/lib/agent-alpha-prompts';
import { pickBestCandidate, uniquePrompts } from '@/lib/agent-alpha-search';
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
  let bestAccuracy = -1;
  let bestPrompt = currentPrompt;
  let converged = false;
  let iterationCount = 0;

  const evalDocIds = hasHoldout ? holdoutDocIds : effectiveTrainDocs;

  const scorePromptOnDocs = async (prompt: string, iteration: number, docs: string[]) => {
    const scored = await runFieldIteration({
      fieldKey,
      fieldName,
      fieldType,
      currentPrompt: prompt,
      previousPrompts: [],
      sampledDocIds: docs,
      groundTruth,
      templateKey,
      testModel,
      promptGenerationModel,
      iterationNumber: iteration,
      maxIterations,
      options: fieldOptions,
      compareConfig: effectiveCompareConfig,
      systemPromptOverride,
      validationOnly: true,
    });
    return scored.accuracy;
  };

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
        sampledDocIds: effectiveTrainDocs,
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

      const trainAccuracy = iterationResult.accuracy;
      logger.info(`   Train accuracy: ${(trainAccuracy * 100).toFixed(1)}%`);

      const candidates = uniquePrompts(
        [iterationResult.newPrompt, ...(iterationResult.candidates ?? [])],
        currentPrompt
      );

      if (!hasAnyGroundTruth) {
        const longest = [currentPrompt, ...candidates].sort((a, b) => b.length - a.length)[0];
        bestPrompt = longest;
        currentPrompt = longest;
        finalAccuracy = trainAccuracy;
        converged = true;
        logger.info(`   ✅ No ground truth — keeping generated prompt (${bestPrompt.length} chars)`);
        break;
      }

      if (candidates.length === 0) {
        logger.info(`   📉 No new candidates — search plateaued`);
        if (bestAccuracy < 0) {
          bestAccuracy = hasHoldout ? await scorePromptOnDocs(currentPrompt, iteration, evalDocIds) : trainAccuracy;
          bestPrompt = currentPrompt;
        }
        finalAccuracy = bestAccuracy;
        converged = true;
        break;
      }

      const currentEvalAccuracy = hasHoldout
        ? await scorePromptOnDocs(currentPrompt, iteration, evalDocIds)
        : trainAccuracy;

      const scoredCandidates = [];
      for (const candidate of candidates) {
        const accuracy = await scorePromptOnDocs(candidate, iteration, evalDocIds);
        scoredCandidates.push({ prompt: candidate, accuracy });
        logger.info(`   🧪 Candidate holdout/eval ${(accuracy * 100).toFixed(1)}% (${candidate.length} chars)`);
      }

      const { winner, improved: lifted } = pickBestCandidate({
        current: { prompt: currentPrompt, accuracy: currentEvalAccuracy },
        candidates: scoredCandidates,
      });

      if (bestAccuracy < 0 || winner.accuracy > bestAccuracy) {
        bestAccuracy = winner.accuracy;
        bestPrompt = winner.prompt;
        logger.info(`   📈 New best eval accuracy: ${(bestAccuracy * 100).toFixed(1)}%`);
      }

      finalAccuracy = winner.accuracy;

      if (!lifted) {
        logger.info(`   📉 No candidate beat the current prompt on the eval set — stopping`);
        converged = true;
        break;
      }

      previousPrompts.push(currentPrompt);
      currentPrompt = winner.prompt;
      logger.info(`   📝 Selected candidate for next iteration (${currentPrompt.length} chars)`);
    } catch (error) {
      logger.error(`   ❌ Error in iteration ${iteration}:`, error as Error);

      if (iteration > 1 && bestAccuracy > initialAccuracy) {
        logger.warn(`   Using best prompt from earlier iteration (${(bestAccuracy * 100).toFixed(1)}%)`);
        currentPrompt = bestPrompt;
        finalAccuracy = bestAccuracy;
        break;
      }

      throw error;
    }
  }

  if (bestAccuracy >= 0) {
    finalAccuracy = bestAccuracy;
  }

  let improved: boolean;
  let finalPromptToUse: string;
  let baselineAccuracy = initialAccuracy;
  let finalAccuracyEvalSet: AgentAlphaFieldResult['finalAccuracyEvalSet'] = 'none';

  if (!hasAnyGroundTruth) {
    improved = true;
    finalPromptToUse = bestPrompt;
    logger.info(`   ✅ Generated prompt for field without ground truth`);
  } else {
    finalAccuracyEvalSet = hasHoldout ? 'holdout' : 'train';

    try {
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

      improved = finalAccuracy > baselineAccuracy;
      if (
        !improved &&
        !userOriginalPrompt &&
        finalAccuracy >= baselineAccuracy &&
        bestPrompt.trim() !== initialPrompt.trim()
      ) {
        improved = true;
      }
      finalPromptToUse = improved ? bestPrompt : (userOriginalPrompt ?? initialPrompt);

      logger.info(`   🧪 Final eval on ${finalAccuracyEvalSet} set (${evalDocIds.length} doc(s)): ${(finalAccuracy * 100).toFixed(1)}% vs baseline ${(baselineAccuracy * 100).toFixed(1)}%`);
      if (!improved) {
        logger.warn(`   ⚠️ Optimized prompt did NOT beat the baseline on unseen docs - keeping original, will NOT recommend update`);
      }
    } catch (evalError) {
      logger.warn(`   ⚠️ Consistent final evaluation failed, falling back to train-subset decision:`, evalError as Error);
      improved = finalAccuracy > initialAccuracy;
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

