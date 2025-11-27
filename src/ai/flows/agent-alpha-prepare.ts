'use server';

import { logger } from '@/lib/logger';
import { buildFieldFailureMap, selectDocsForAgentAlpha } from '@/lib/agent-alpha-sampling';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import type { AccuracyData, AccuracyField } from '@/lib/types';
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
  fields: FieldPlan[];
};

/**
 * Prepares the work plan for Agent-Alpha
 * - Validates comparison results exist
 * - Identifies failing fields (< 100% accuracy)
 * - Samples documents with most failures
 * - Builds ground truth map for sampled docs
 */
export async function prepareAgentAlphaWorkPlan(params: {
  accuracyData: AccuracyData;
  testModel: string;
  maxDocs?: number;
}): Promise<AgentAlphaWorkPlan> {
  const { accuracyData, testModel, maxDocs = AGENT_ALPHA_CONFIG.MAX_DOCS } = params;
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

  // Step 2: Identify failing fields (< TARGET_ACCURACY on reference model)
  const fieldAccuracyEntries = accuracyData.fields.map((field) => {
    const accuracy = accuracyData.averages?.[field.key]?.[referenceModel]?.accuracy ?? 0;
    return {
      fieldKey: field.key,
      field,
      accuracyBefore: accuracy,
    };
  });

  const failingFields = fieldAccuracyEntries.filter(({ accuracyBefore }) => {
    return accuracyBefore < AGENT_ALPHA_CONFIG.TARGET_ACCURACY;
  });

  if (failingFields.length === 0) {
    logger.info(`✅ All fields already at 100% accuracy on ${referenceModel}!`);
    return {
      runId,
      templateKey: accuracyData.templateKey,
      testModel,
      sampledDocIds: [],
      fields: [],
    };
  }

  logger.info(`📊 Found ${failingFields.length} field(s) to optimize`);

  // Step 3: Build failure map using reference model (the model we have comparison data for)
  const failingFieldKeys = failingFields.map(({ fieldKey }) => fieldKey);
  const failureMap = buildFieldFailureMap(accuracyData, failingFieldKeys, referenceModel);

  // Filter out fields with no failures in sampled docs
  const fieldsWithFailures = failingFields.filter(({ fieldKey }) => failureMap[fieldKey]?.length > 0);

  if (fieldsWithFailures.length === 0) {
    logger.warn(`⚠️  No fields have failures in the sampled documents`);
    return {
      runId,
      templateKey: accuracyData.templateKey,
      testModel,
      sampledDocIds: [],
      fields: [],
    };
  }

  const samplingResult = selectDocsForAgentAlpha(failureMap, maxDocs);
  const sampledDocIds = samplingResult.docs.map((doc) => doc.docId);

  logger.info(`📄 Selected ${sampledDocIds.length} document(s) for testing`);
  logger.info(`🎯 Processing ${fieldsWithFailures.length} field(s)`);

  // Step 4: Build ground truth map for sampled documents and create field plans
  const fieldPlans: FieldPlan[] = [];
  for (const { fieldKey, field, accuracyBefore } of fieldsWithFailures) {
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

  const workPlan: AgentAlphaWorkPlan = {
    runId,
    templateKey: accuracyData.templateKey,
    testModel,
    sampledDocIds,
    fields: fieldPlans,
  };

  logger.info(`📋 Work plan ready: ${workPlan.fields.length} fields to process`);
  return workPlan;
}

