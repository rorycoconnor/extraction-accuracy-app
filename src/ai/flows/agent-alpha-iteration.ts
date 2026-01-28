'use server';

/**
 * @fileOverview Agent-Alpha Iteration Engine
 * 
 * This module implements the core iteration loop for Agent-Alpha, an agentic
 * prompt optimization system. Each iteration:
 * 
 * 1. **Extracts** metadata from sampled documents using the current prompt
 * 2. **Compares** extractions to ground truth to calculate accuracy
 * 3. **Analyzes** failures to understand why extractions went wrong
 * 4. **Generates** an improved prompt using Box AI (Claude)
 * 
 * ## Architecture
 * 
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Agent-Alpha Iteration                     │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Input: Current prompt, sampled docs, ground truth          │
 * │                                                              │
 * │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
 * │  │   Extract    │ → │   Compare    │ → │   Analyze    │    │
 * │  │  (parallel)  │   │   to GT      │   │   Failures   │    │
 * │  └──────────────┘   └──────────────┘   └──────────────┘    │
 * │                                              ↓              │
 * │                                    ┌──────────────┐         │
 * │                                    │   Generate   │         │
 * │                                    │  New Prompt  │         │
 * │                                    └──────────────┘         │
 * │                                              ↓              │
 * │  Output: New prompt, accuracy, converged flag               │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 * 
 * ## Convergence
 * 
 * The iteration converges when accuracy reaches TARGET_ACCURACY (default 100%).
 * Even when converged, if the prompt is "simple" (< 100 chars), a more robust
 * prompt is generated for production reliability.
 * 
 * ## Validation Mode
 * 
 * When `validationOnly: true`, the iteration only calculates accuracy without
 * generating new prompts. This is used for holdout validation to prevent
 * overfitting to training documents.
 * 
 * @module agent-alpha-iteration
 * @see {@link runFieldIteration} - Main iteration function
 * @see {@link AGENT_ALPHA_CONFIG} - Configuration constants
 */

import { logger } from '@/lib/logger';
import { extractStructuredMetadataWithBoxAI, boxApiFetch, getBlankPlaceholderFileId } from '@/services/box';
import { calculateFieldMetricsWithDebugAsync } from '@/lib/metrics';
import { 
  buildAgentAlphaPrompt, 
  parseAgentAlphaPromptResponse,
  validatePrompt,
  buildPromptRepairRequest,
  getExamplePromptForField,
} from '@/lib/agent-alpha-prompts';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import { processWithConcurrency } from '@/lib/concurrency';
import { analyzeFailedExtractions, buildDocumentContextForPrompt } from '@/lib/document-analysis';
import type { AccuracyField } from '@/lib/types';
import type { FieldCompareConfig } from '@/lib/compare-types';
import type { BoxAIField } from '@/lib/schemas';
import type { AgentAlphaIterationResult } from '@/lib/agent-alpha-types';

/** Sentinel value returned when a field value is not found in the document */
const NOT_PRESENT_VALUE = 'Not Present';

/**
 * Infers the document type from a template key using keyword matching.
 * 
 * Similar to the version in generate-initial-prompt.ts but works on template keys
 * (which may use underscores or camelCase). This helps Agent-Alpha understand
 * what type of documents it's optimizing prompts for.
 * 
 * @param templateKey - The template key to analyze (e.g., "nda_template", "leaseAgreement")
 * @returns The inferred document type or undefined
 * 
 * @internal
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
 * Maps internal AccuracyField types to Box AI's supported field types.
 * 
 * Box AI's structured extraction only supports a limited set of types:
 * - `string`: Free-form text
 * - `date`: Date values (returned in various formats)
 * - `enum`: Single selection from predefined options
 * - `multiSelect`: Multiple selections from predefined options
 * - `number`: Numeric values
 * 
 * This function handles the mapping from our internal types (which include
 * additional types like `dropdown_multi` and `taxonomy`) to Box AI types.
 * 
 * @param fieldType - The internal AccuracyField type
 * @returns The corresponding BoxAIField type
 * 
 * @example
 * mapToBoxAIFieldType('dropdown_multi') // => 'multiSelect'
 * mapToBoxAIFieldType('taxonomy')       // => 'string'
 * mapToBoxAIFieldType('date')           // => 'date'
 * 
 * @internal
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
 * Runs a single iteration of Agent-Alpha's optimization loop for one field.
 * 
 * This is the core function that drives prompt optimization. Each iteration:
 * 
 * 1. **Parallel Extraction**: Extracts the field from all sampled documents simultaneously
 *    using the current prompt. Uses Box AI structured extraction with field mode
 *    (not template mode) to test custom prompts.
 * 
 * 2. **Accuracy Calculation**: Compares extracted values to ground truth using the
 *    configured comparison method (exact match, semantic, LLM-judge, etc.).
 *    Only documents with valid ground truth are included in accuracy calculation.
 * 
 * 3. **Convergence Check**: If accuracy >= TARGET_ACCURACY (default 100%), the
 *    iteration is considered converged. However, if the prompt is "simple"
 *    (< 100 chars or generic), a more robust prompt is still generated.
 * 
 * 4. **Failure Analysis** (optional): When ENABLE_DOCUMENT_ANALYSIS is true and
 *    on early iterations, analyzes failed extractions to understand WHY they failed
 *    by examining actual document content.
 * 
 * 5. **Prompt Generation**: Uses Box AI (Claude) to generate an improved prompt
 *    based on:
 *    - Current prompt and previous attempts
 *    - Failure examples (what went wrong)
 *    - Success examples (what worked)
 *    - Document type context
 *    - Custom instructions (if provided)
 * 
 * 6. **Prompt Validation**: Validates generated prompts against quality checklist
 *    (location, synonyms, format, disambiguation, not-found handling).
 *    Invalid prompts trigger repair attempts or fallback to examples.
 * 
 * ## Important: Fields Mode vs Template Mode
 * 
 * This function intentionally uses **fields mode** (not template mode) for extraction.
 * When templateKey is passed to Box AI, it uses the prompts FROM the template,
 * ignoring our custom prompts. To test our optimized prompts, we must use fields mode.
 * 
 * ## Validation-Only Mode
 * 
 * When `validationOnly: true`, the function only extracts and calculates accuracy
 * without generating new prompts. This is used for holdout validation to:
 * - Prevent overfitting to training documents
 * - Save API calls during validation
 * - Get unbiased accuracy measurements
 * 
 * @param params - Iteration parameters
 * @param params.fieldKey - Unique key for the field (e.g., "effective_date")
 * @param params.fieldName - Human-readable field name (e.g., "Effective Date")
 * @param params.fieldType - Field type for Box AI mapping
 * @param params.currentPrompt - The prompt to test in this iteration
 * @param params.previousPrompts - Previous prompts tried (to avoid repetition)
 * @param params.sampledDocIds - Box file IDs of documents to test against
 * @param params.groundTruth - Map of docId → expected value
 * @param params.templateKey - Template name (for document type inference only)
 * @param params.testModel - Box AI model to use for extraction
 * @param params.iterationNumber - Current iteration (1-based)
 * @param params.maxIterations - Maximum iterations allowed
 * @param params.options - Enum options for enum/multiSelect fields
 * @param params.compareConfig - Comparison configuration for accuracy calculation
 * @param params.systemPromptOverride - Custom system prompt for generation
 * @param params.validationOnly - If true, skip prompt generation
 * 
 * @returns Iteration result with new prompt, accuracy, and convergence status
 * 
 * @example
 * ```typescript
 * const result = await runFieldIteration({
 *   fieldKey: 'effective_date',
 *   fieldName: 'Effective Date',
 *   fieldType: 'date',
 *   currentPrompt: 'Extract the effective date',
 *   previousPrompts: [],
 *   sampledDocIds: ['doc1', 'doc2', 'doc3'],
 *   groundTruth: {
 *     'doc1': '2024-01-15',
 *     'doc2': '2024-02-01',
 *     'doc3': '2024-03-10'
 *   },
 *   templateKey: 'lease_agreement',
 *   testModel: 'azure__openai__gpt_4_1_mini',
 *   iterationNumber: 1,
 *   maxIterations: 5,
 * });
 * 
 * console.log(result.accuracy);   // 0.67 (2/3 correct)
 * console.log(result.converged);  // false
 * console.log(result.newPrompt);  // Improved prompt from Claude
 * ```
 * 
 * @see {@link AgentAlphaIterationResult} - Return type definition
 * @see {@link AGENT_ALPHA_CONFIG} - Configuration constants
 * @see {@link buildAgentAlphaPrompt} - Prompt generation helper
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
  validationOnly?: boolean; // If true, skip prompt generation (for holdout validation)
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
    validationOnly = false,
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
  const failureExamples: Array<{ docId: string; predicted: string; expected: string }> = [];
  const successExamples: Array<{ docId: string; value: string }> = [];

  // Filter to only include docs WITH ground truth for accuracy calculation
  // Empty strings, "-", and whitespace-only values are considered "no ground truth"
  const resultsWithGroundTruth = extractionResults.filter(r => {
    const gt = r.expectedValue;
    return gt && gt.trim() !== '' && gt.trim() !== '-';
  });
  
  const totalDocs = extractionResults.length;
  const docsWithGT = resultsWithGroundTruth.length;
  
  // Step 2: Calculate accuracy using only docs that have ground truth
  let accuracy = 0;
  let converged = false;
  
  if (docsWithGT === 0) {
    // No ground truth available - can't calculate accuracy
    logger.info(`   ⚠️ No ground truth in sampled docs - accuracy N/A`);
    // Consider it "converged" since there's nothing to improve against
    converged = true;
  } else {
    const predictions: string[] = resultsWithGroundTruth.map(r => r.extractedValue);
    const groundTruths: string[] = resultsWithGroundTruth.map(r => r.expectedValue);
    const docIdsWithGT = resultsWithGroundTruth.map(r => r.docId);
    
    const metricsResult = await calculateFieldMetricsWithDebugAsync(predictions, groundTruths, compareConfig, docIdsWithGT);
    accuracy = metricsResult.accuracy;
    
    logger.debug(`   Metrics debug: ${JSON.stringify({
      predictions: predictions.map(p => String(p).substring(0, 50)),
      groundTruths: groundTruths.map(g => String(g).substring(0, 50)),
      accuracy,
      compareConfig: compareConfig?.compareType || 'default',
      docsWithGT,
      totalDocs
    })}`);

    if (docsWithGT < totalDocs) {
      logger.info(`   Accuracy: ${(accuracy * 100).toFixed(1)}% (measured on ${docsWithGT}/${totalDocs} docs with ground truth)`);
    } else {
      logger.info(`   Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    }
    
    // Step 3: Check if converged
    converged = accuracy >= AGENT_ALPHA_CONFIG.TARGET_ACCURACY;
  }

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
  // 3. NOT in validationOnly mode (holdout validation doesn't need new prompts)
  const isSimplePrompt = currentPrompt.length < 100 || 
    currentPrompt.toLowerCase().startsWith('extract the ');
  const shouldGeneratePrompt = !validationOnly && (!converged || (converged && isSimplePrompt));

  // In validationOnly mode (holdout validation), just return accuracy - no prompt generation
  if (validationOnly) {
    logger.info(`   📊 Validation-only mode: accuracy ${(accuracy * 100).toFixed(1)}% (skipping prompt generation)`);
    return {
      newPrompt: currentPrompt,
      accuracy,
      converged,
    };
  }

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
    
    // NEW: Analyze failed documents to understand WHY extractions failed
    // This gives us actual document context to help write better prompts
    let documentContext = '';
    const shouldAnalyze = AGENT_ALPHA_CONFIG.ENABLE_DOCUMENT_ANALYSIS && 
      failureExamples.length > 0 && 
      iterationNumber <= AGENT_ALPHA_CONFIG.DOCUMENT_ANALYSIS_MAX_ITERATION;
      
    if (shouldAnalyze) {
      // Only do deep analysis on early iterations (expensive operation)
      logger.info(`   📄 Analyzing ${failureExamples.length} failed documents for context...`);
      
      try {
        // Prepare failures for analysis - docName will be fetched from Box API
        const failuresForAnalysis = failureExamples.slice(0, 2).map(f => ({
          docId: f.docId,
          // docName not provided - will be fetched from Box
          fieldKey,
          fieldName,
          groundTruth: f.expected,
          extractedValue: f.predicted,
        }));
        
        const analyses = await analyzeFailedExtractions(failuresForAnalysis, 2);
        documentContext = await buildDocumentContextForPrompt(analyses);
        
        if (documentContext) {
          logger.info(`   ✅ Document analysis complete - found ${analyses.length} insights`);
        }
      } catch (analysisError) {
        logger.warn(`   ⚠️ Document analysis failed (continuing without):`, analysisError as Error);
        // Continue without document context - it's optional enhancement
      }
    }
    
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
      templateKey, // Pass template name for additional document type context
      customInstructions: systemPromptOverride, // Pass custom instructions if provided
      documentContext, // NEW: Pass analyzed document context
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
    
    let parsedResponse = parseAgentAlphaPromptResponse(rawAnswer as string, fieldName);
    
    // Validate the generated prompt against quality checklist
    if (AGENT_ALPHA_CONFIG.PROMPT_VALIDATION_ENABLED) {
      const validation = validatePrompt(parsedResponse.newPrompt);
      
      if (!validation.isValid) {
        logger.warn(`   ⚠️ Prompt validation failed: ${validation.errors.join('; ')}`);
        
        // Attempt repair if within limit
        const maxRepairAttempts = AGENT_ALPHA_CONFIG.PROMPT_REPAIR_MAX_ATTEMPTS;
        let repaired = false;
        
        for (let attempt = 1; attempt <= maxRepairAttempts && !repaired; attempt++) {
          logger.info(`   🔧 Attempting prompt repair (${attempt}/${maxRepairAttempts})...`);
          
          try {
            // Build repair request with specific errors to fix
            const repairRequest = buildPromptRepairRequest(
              parsedResponse.newPrompt,
              validation,
              fieldName,
              fieldType
            );
            
            // Call Box AI to repair the prompt
            const repairResponse = await boxApiFetch('/ai/text_gen', {
              method: 'POST',
              body: JSON.stringify({
                prompt: repairRequest,
                items: [{ id: placeholderId, type: 'file' as const }],
                ai_agent: {
                  type: 'ai_agent_text_gen',
                  basic_gen: {
                    model: AGENT_ALPHA_CONFIG.PROMPT_GEN_MODEL,
                  },
                },
              }),
            });
            
            const repairAnswer = repairResponse?.answer ?? repairResponse;
            const repairedParsed = parseAgentAlphaPromptResponse(repairAnswer as string, fieldName);
            
            // Validate the repaired prompt
            const repairValidation = validatePrompt(repairedParsed.newPrompt);
            
            if (repairValidation.isValid) {
              logger.info(`   ✅ Prompt repair successful!`);
              parsedResponse = repairedParsed;
              repaired = true;
            } else {
              logger.warn(`   ⚠️ Repaired prompt still invalid: ${repairValidation.errors.join('; ')}`);
            }
          } catch (repairError) {
            logger.warn(`   ⚠️ Repair attempt ${attempt} failed:`, repairError as Error);
          }
        }
        
        // If repair failed, fall back to example prompt
        if (!repaired) {
          logger.warn(`   ⚠️ Repair failed after ${maxRepairAttempts} attempt(s), using fallback prompt`);
          const fallbackPrompt = getExamplePromptForField(fieldName, fieldType, options);
          parsedResponse = {
            newPrompt: fallbackPrompt,
            reasoning: `Fallback: Generated prompt failed validation (${validation.errors.join('; ')})`,
          };
        }
      } else {
        logger.info(`   ✅ Prompt validation passed`);
      }
    }

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

