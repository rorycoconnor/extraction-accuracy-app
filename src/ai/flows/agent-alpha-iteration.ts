'use server';

import { logger } from '@/lib/logger';
import { extractStructuredMetadataWithBoxAI, boxApiFetch, getBlankPlaceholderFileId } from '@/services/box';
import { calculateFieldMetricsWithDebugAsync } from '@/lib/metrics';
import { buildAgentAlphaPrompt, parseAgentAlphaPromptResponse } from '@/lib/agent-alpha-prompts';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import { processWithConcurrency } from '@/lib/concurrency';
import type { AccuracyField } from '@/lib/types';
import type { FieldCompareConfig } from '@/lib/compare-types';
import type { BoxAIField } from '@/lib/schemas';
import type { AgentAlphaIterationResult } from '@/lib/agent-alpha-types';

const NOT_PRESENT_VALUE = 'Not Present';

/**
 * Infer document type from template key
 */
function inferDocumentType(templateKey: string): string | undefined {
  const lowerKey = templateKey.toLowerCase();
  
  if (lowerKey.includes('nda') || lowerKey.includes('confidential')) {
    return 'NDA (Non-Disclosure Agreement)';
  }
  if (lowerKey.includes('msa') || lowerKey.includes('master')) {
    return 'MSA (Master Service Agreement)';
  }
  if (lowerKey.includes('sow') || lowerKey.includes('statement')) {
    return 'SOW (Statement of Work)';
  }
  if (lowerKey.includes('lease') || lowerKey.includes('rental')) {
    return 'Lease Agreement';
  }
  if (lowerKey.includes('contract')) {
    return 'Contract';
  }
  if (lowerKey.includes('invoice')) {
    return 'Invoice';
  }
  if (lowerKey.includes('amendment')) {
    return 'Amendment';
  }
  
  return undefined;
}

/**
 * Maps AccuracyField type to BoxAIField type
 * BoxAI only supports: 'string' | 'date' | 'enum' | 'multiSelect' | 'number'
 */
function mapToBoxAIFieldType(fieldType: AccuracyField['type']): BoxAIField['type'] {
  switch (fieldType) {
    case 'dropdown_multi':
      return 'multiSelect';
    case 'taxonomy':
      return 'string'; // Taxonomy fields are treated as strings
    default:
      return fieldType as BoxAIField['type'];
  }
}

/**
 * Runs a single iteration of Agent-Alpha for one field
 * 1. Extracts metadata using current prompt
 * 2. Compares to ground truth
 * 3. If not converged, generates improved prompt
 * 4. Returns iteration result
 */
export async function runFieldIteration(params: {
  fieldKey: string;
  fieldName: string;
  fieldType: AccuracyField['type'];
  currentPrompt: string;
  previousPrompts: string[];
  sampledDocIds: string[];
  groundTruth: Record<string, string>; // docId -> groundTruthValue
  templateKey: string; // Used for document type inference, NOT for extraction (we use fields mode)
  testModel: string;
  iterationNumber: number;
  maxIterations: number;
  options?: Array<{ key: string }>;
  compareConfig?: FieldCompareConfig;
  systemPromptOverride?: string; // Custom system prompt to prepend
}): Promise<AgentAlphaIterationResult> {
  const {
    fieldKey,
    fieldName,
    fieldType,
    currentPrompt,
    previousPrompts,
    sampledDocIds,
    groundTruth,
    templateKey,
    testModel,
    iterationNumber,
    maxIterations,
    options,
    compareConfig,
    systemPromptOverride,
  } = params;

  logger.info(`🔄 Agent-Alpha: [${iterationNumber}/${maxIterations}] Testing field "${fieldName}" (${sampledDocIds.length} docs in parallel)`);

  // Step 1: Extract metadata from sampled documents using the test model IN PARALLEL
  // Map AccuracyField type to BoxAIField type once
  const boxAIFieldType = mapToBoxAIFieldType(fieldType);
  
  // Define extraction job type for parallel processing
  type ExtractionJob = {
    docId: string;
    expectedValue: string;
  };

  // Prepare jobs for parallel extraction
  const extractionJobs: ExtractionJob[] = sampledDocIds.map(docId => ({
    docId,
    expectedValue: groundTruth[docId] || '',
  }));

  // Run extractions in parallel with concurrency limit
  const extractionResults = await processWithConcurrency(
    extractionJobs,
    AGENT_ALPHA_CONFIG.EXTRACTION_CONCURRENCY,
    async (job) => {
      try {
        // CRITICAL: Do NOT pass templateKey here!
        // When templateKey is passed, Box uses the prompts from the template, ignoring our custom prompts.
        // For Agent-Alpha to test custom prompts, we MUST use fields mode (not template mode).
        const { extractedData } = await extractStructuredMetadataWithBoxAI({
          fileId: job.docId,
          fields: [
            {
              key: fieldKey,
              type: boxAIFieldType,
              displayName: fieldName,
              prompt: currentPrompt,
              options,
            },
          ],
          model: testModel,
          // templateKey intentionally omitted - we need fields mode to test custom prompts
        });

        const extractedValue = extractedData[fieldKey] || NOT_PRESENT_VALUE;
        logger.debug(`   ✓ Extracted: "${extractedValue}" (expected: "${job.expectedValue}")`);
        
        return {
          docId: job.docId,
          extractedValue,
          expectedValue: job.expectedValue,
          success: true,
        };
      } catch (error) {
        logger.error(`   ✗ Extraction failed for ${job.docId}:`, error as Error);
        return {
          docId: job.docId,
          extractedValue: '',
          expectedValue: job.expectedValue,
          success: false,
        };
      }
    }
  );

  // Collect results maintaining order
  const predictions: string[] = extractionResults.map(r => r.extractedValue);
  const groundTruths: string[] = extractionResults.map(r => r.expectedValue);
  const failureExamples: Array<{ docId: string; predicted: string; expected: string }> = [];
  const successExamples: Array<{ docId: string; value: string }> = [];

  // Step 2: Calculate accuracy using the same comparison config as main comparison
  const metricsResult = await calculateFieldMetricsWithDebugAsync(predictions, groundTruths, compareConfig, sampledDocIds);
  const accuracy = metricsResult.accuracy;
  
  logger.debug(`   Metrics debug: ${JSON.stringify({
    predictions: predictions.map(p => p.substring(0, 50)),
    groundTruths: groundTruths.map(g => g.substring(0, 50)),
    accuracy,
    compareConfig: compareConfig?.compareType || 'default'
  })}`);

  logger.info(`   Accuracy: ${(accuracy * 100).toFixed(1)}%`);

  // Step 3: Check if converged
  const converged = accuracy >= AGENT_ALPHA_CONFIG.TARGET_ACCURACY;

  // Step 4: Build failure and success examples for prompt generation
  // We do this even when converged, because we may want to generate a more robust prompt
  for (const result of extractionResults) {
    if (result.extractedValue === result.expectedValue || 
        (result.extractedValue === NOT_PRESENT_VALUE && !result.expectedValue)) {
      successExamples.push({ docId: result.docId, value: result.extractedValue });
    } else {
      failureExamples.push({ 
        docId: result.docId, 
        predicted: result.extractedValue, 
        expected: result.expectedValue 
      });
    }
  }

  // Determine if we should generate a new prompt
  // We generate a new prompt when:
  // 1. Not converged (need to improve accuracy)
  // 2. Converged but using a simple/default prompt (need robust prompt for production)
  const isSimplePrompt = currentPrompt.length < 100 || 
    currentPrompt.toLowerCase().startsWith('extract the ');
  const shouldGeneratePrompt = !converged || (converged && isSimplePrompt);

  if (converged && !shouldGeneratePrompt) {
    // Converged with a robust prompt - no need to generate a new one
    logger.info(`   ✅ Converged! Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    return {
      newPrompt: currentPrompt,
      accuracy,
      converged: true,
    };
  }

  // Step 5: Generate improved prompt using Box AI Enhanced Extract Agent
  try {
    if (converged) {
      logger.info(`   🔄 Generating robust prompt despite 100% accuracy (simple prompt: ${currentPrompt.length} chars)`);
    } else {
      logger.info(`   🤖 Generating improved prompt...`);
    }

    // Infer document type from template key if available
    const documentType = inferDocumentType(templateKey);
    
    const promptRequest = buildAgentAlphaPrompt({
      fieldName,
      fieldType,
      currentPrompt,
      previousPrompts,
      failureExamples,
      successExamples,
      iterationNumber,
      maxIterations,
      options,
      documentType,
      customInstructions: systemPromptOverride, // Pass custom instructions if provided
      // companyName would be passed if available from settings
    });

    // Use Box AI text_gen with blank file
    const placeholderId = await getBlankPlaceholderFileId();
    const response = await boxApiFetch('/ai/text_gen', {
      method: 'POST',
      body: JSON.stringify({
        prompt: promptRequest,
        items: [{ id: placeholderId, type: 'file' as const }],
        ai_agent: {
          type: 'ai_agent_text_gen',
          basic_gen: {
            model: AGENT_ALPHA_CONFIG.PROMPT_GEN_MODEL,
          },
        },
      }),
    });

    const rawAnswer = response?.answer ?? response;
    
    // DETAILED LOGGING: See exactly what Claude returns
    logger.info(`   📝 Raw Box AI response (first 500 chars): "${String(rawAnswer).substring(0, 500)}"`);
    logger.debug(`   📝 Full raw response: ${JSON.stringify(rawAnswer)}`);
    
    const parsedResponse = parseAgentAlphaPromptResponse(rawAnswer as string, fieldName);

    logger.info(`   ✅ New prompt generated: "${parsedResponse.newPrompt.substring(0, 100)}..."`);
    logger.info(`   📊 Prompt length: ${parsedResponse.newPrompt.length} chars`);
    logger.debug(`   Reasoning: ${parsedResponse.reasoning}`);

    return {
      newPrompt: parsedResponse.newPrompt,
      accuracy,
      converged, // Return the actual converged status
      failureExamples,
    };
  } catch (error) {
    logger.error(`   ✗ Prompt generation failed:`, error as Error);
    
    // If converged but prompt generation failed, return current prompt
    if (converged) {
      logger.warn(`   Using current prompt since we're converged`);
      return {
        newPrompt: currentPrompt,
        accuracy,
        converged: true,
      };
    }
    
    throw error;
  }
}

