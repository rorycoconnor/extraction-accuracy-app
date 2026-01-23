'use server';

import { logger } from '@/lib/logger';
import { buildFieldFailureMap, selectDocsForAgentAlpha } from '@/lib/agent-alpha-sampling';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import type { AccuracyData, AccuracyField, BoxTemplate } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export type FieldPlan = {
  fieldKey: string;
  field: AccuracyField;
  initialAccuracy: number;
  groundTruth: Record<string, string>; // docId -> groundTruthValue
};

export type AgentAlphaWorkPlan = {
  runId: string;
  templateKey: string;
  testModel: string;
  sampledDocIds: string[];
  // Train/holdout split for overfitting prevention
  trainDocIds: string[];
  holdoutDocIds: string[];
  fields: FieldPlan[];
};

/**
 * Prepares the work plan for Agent-Alpha
 * - Validates comparison results exist
 * - Identifies failing fields (< 100% accuracy)
 * - Filters out disabled fields (isActive === false in template)
 * - Samples documents with most failures
 * - Builds ground truth map for sampled docs
 */
export async function prepareAgentAlphaWorkPlan(params: {
  accuracyData: AccuracyData;
  testModel: string;
  maxDocs?: number;
  holdoutRatio?: number; // Ratio of docs to hold out for validation
  configuredTemplate?: BoxTemplate; // Template with isActive field status
}): Promise<AgentAlphaWorkPlan> {
  const { 
    accuracyData, 
    testModel, 
    maxDocs = AGENT_ALPHA_CONFIG.MAX_DOCS, 
    holdoutRatio = AGENT_ALPHA_CONFIG.HOLDOUT_RATIO,
    configuredTemplate 
  } = params;
  const runId = uuidv4();

  logger.info(`🤖 Agent-Alpha: Preparing work plan (runId: ${runId})`);
  logger.info(`   Test model: ${testModel}`);

  // Step 1: Find models that have comparison results
  const comparedModels = new Set<string>();
  accuracyData.results?.forEach((file) => {
    if (file.comparisonResults) {
      Object.values(file.comparisonResults).forEach((modelMap) => {
        Object.keys(modelMap).forEach((model) => {
          if (modelMap[model]?.isMatch !== undefined) {
            comparedModels.add(model);
          }
        });
      });
    }
  });

  if (comparedModels.size === 0) {
    throw new Error('No comparison results found. Please run comparison first.');
  }

  logger.info(`   Compared models: ${Array.from(comparedModels).join(', ')}`);

  // Use the testModel if it was compared, otherwise use the first compared model
  const referenceModel = comparedModels.has(testModel) 
    ? testModel 
    : Array.from(comparedModels)[0];
  
  logger.info(`   Reference model for accuracy: ${referenceModel}`);

  // Step 2: Build set of active field keys (fields that are enabled)
  // A field is active if:
  // - isActive !== false in the template (Templates page toggle)
  // - includeInMetrics !== false in fieldSettings (Main table toggle)
  const activeFieldKeys = new Set<string>();
  const skippedByTemplate: string[] = [];
  const skippedByMetrics: string[] = [];
  
  for (const field of accuracyData.fields) {
    // Check if field is disabled in template (isActive === false)
    const templateField = configuredTemplate?.fields.find(f => f.key === field.key);
    if (templateField && templateField.isActive === false) {
      skippedByTemplate.push(field.name);
      continue;
    }
    
    // Check if field is excluded from metrics (includeInMetrics === false)
    if (accuracyData.fieldSettings?.[field.key]?.includeInMetrics === false) {
      skippedByMetrics.push(field.name);
      continue;
    }
    
    activeFieldKeys.add(field.key);
  }
  
  logger.info(`   Active fields: ${activeFieldKeys.size}/${accuracyData.fields.length}`);
  if (skippedByTemplate.length > 0) {
    logger.info(`   Skipped (disabled in template): ${skippedByTemplate.length} - ${skippedByTemplate.join(', ')}`);
  }
  if (skippedByMetrics.length > 0) {
    logger.info(`   Skipped (not included in metrics): ${skippedByMetrics.length} - ${skippedByMetrics.join(', ')}`);
  }

  // Step 3: Identify fields that need optimization
  // A field needs optimization if:
  // - It has < 100% accuracy on the reference model, OR
  // - It has no ground truth data (we still want to create prompts for these)
  // Only consider fields that are active in the template
  const fieldAccuracyEntries = accuracyData.fields
    .filter((field) => activeFieldKeys.has(field.key)) // Skip disabled fields
    .map((field) => {
      const accuracy = accuracyData.averages?.[field.key]?.[referenceModel]?.accuracy ?? 0;
      
      // Check if this field has ANY ground truth data across all documents
      const hasGroundTruth = accuracyData.results.some((fileResult) => {
        const gtValue = fileResult.fields[field.key]?.['Ground Truth'];
        return gtValue && gtValue.trim() !== '';
      });
      
      return {
        fieldKey: field.key,
        field,
        accuracyBefore: accuracy,
        hasGroundTruth,
      };
    });

  // Include fields that either:
  // 1. Have < 100% accuracy (need improvement), OR
  // 2. Have no ground truth at all (need prompt creation anyway)
  const fieldsToOptimize = fieldAccuracyEntries.filter(({ accuracyBefore, hasGroundTruth }) => {
    // If field has 100% accuracy AND has ground truth, skip it (already working)
    if (accuracyBefore >= AGENT_ALPHA_CONFIG.TARGET_ACCURACY && hasGroundTruth) {
      return false;
    }
    // Include if accuracy is below target OR if there's no ground truth
    return true;
  });

  if (fieldsToOptimize.length === 0) {
    logger.info(`✅ All fields already at 100% accuracy on ${referenceModel}!`);
    return {
      runId,
      templateKey: accuracyData.templateKey,
      testModel,
      sampledDocIds: [],
      trainDocIds: [],
      holdoutDocIds: [],
      fields: [],
    };
  }

  // Log what we're optimizing and why
  const noGtFields = fieldsToOptimize.filter(f => !f.hasGroundTruth);
  const failingFields = fieldsToOptimize.filter(f => f.hasGroundTruth && f.accuracyBefore < AGENT_ALPHA_CONFIG.TARGET_ACCURACY);
  
  logger.info(`📊 Found ${fieldsToOptimize.length} field(s) to optimize:`);
  if (failingFields.length > 0) {
    logger.info(`   - ${failingFields.length} field(s) with < 100% accuracy`);
  }
  if (noGtFields.length > 0) {
    logger.info(`   - ${noGtFields.length} field(s) without ground truth`);
  }

  // Step 4: Build failure map using reference model (for fields that have comparison data)
  const fieldKeysToOptimize = fieldsToOptimize.map(({ fieldKey }) => fieldKey);
  const failureMap = buildFieldFailureMap(accuracyData, fieldKeysToOptimize, referenceModel);

  // NOTE: We no longer filter out fields with no failures in the failure map
  // Fields without ground truth won't have failures but still need prompts

  // Get all document IDs so we can pad the sample if needed
  const allDocIds = accuracyData.results.map((r) => r.id);
  
  const samplingResult = selectDocsForAgentAlpha(failureMap, maxDocs, allDocIds, holdoutRatio);
  const sampledDocIds = samplingResult.docs.map((doc) => doc.docId);
  const { trainDocIds, holdoutDocIds } = samplingResult;

  logger.info(`📄 Selected ${sampledDocIds.length} document(s) for testing`);
  if (holdoutDocIds.length > 0) {
    logger.info(`   📊 Train: ${trainDocIds.length} docs, Holdout: ${holdoutDocIds.length} docs`);
  }
  logger.info(`🎯 Processing ${fieldsToOptimize.length} field(s)`);

  // Step 5: Build ground truth map for sampled documents and create field plans
  const fieldPlans: FieldPlan[] = [];
  for (const { fieldKey, field, accuracyBefore } of fieldsToOptimize) {
    const groundTruth: Record<string, string> = {};
    for (const docId of sampledDocIds) {
      const fileResult = accuracyData.results.find((r) => r.id === docId);
      if (fileResult) {
        const gtValue = fileResult.fields[fieldKey]?.['Ground Truth'] ?? '';
        groundTruth[docId] = gtValue;
      }
    }
    fieldPlans.push({
      fieldKey,
      field,
      initialAccuracy: accuracyBefore,
      groundTruth,
    });
  }

  // Log ground truth status for each field - helps identify data quality issues
  logger.info(`📊 Ground truth status for sampled documents:`);
  for (const plan of fieldPlans) {
    const gtValues = Object.values(plan.groundTruth);
    const validGtCount = gtValues.filter(gt => gt && gt.trim() !== '' && gt.trim() !== '-').length;
    const totalDocs = gtValues.length;
    
    let status: string;
    let icon: string;
    if (validGtCount === 0) {
      status = 'NO GT';
      icon = '⚠️';
    } else if (validGtCount < totalDocs) {
      status = `PARTIAL (${validGtCount}/${totalDocs})`;
      icon = '⚡';
    } else {
      status = 'FULL';
      icon = '✅';
    }
    
    logger.info(`   ${icon} ${plan.field.name}: ${status}`);
  }

  const workPlan: AgentAlphaWorkPlan = {
    runId,
    templateKey: accuracyData.templateKey,
    testModel,
    sampledDocIds,
    trainDocIds,
    holdoutDocIds,
    fields: fieldPlans,
  };

  logger.info(`📋 Work plan ready: ${workPlan.fields.length} fields to process`);
  return workPlan;
}

