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
}): Promise<AgentAlphaWorkPlan> {
  const { accuracyData, testModel } = params;
  const runId = uuidv4();

  logger.info(`🤖 Agent-Alpha: Preparing work plan (runId: ${runId})`);

  // Step 1: Validate comparison results exist
  const hasComparison = accuracyData.results?.some((file) => {
    return Object.values(file.comparisonResults ?? {}).some((modelMap) =>
      Object.values(modelMap).some((meta) => meta?.isMatch !== undefined)
    );
  });

  if (!hasComparison) {
    throw new Error('No comparison results found. Please run comparison first.');
  }

  // Step 2: Identify failing fields (< TARGET_ACCURACY on test model)
  const fieldAccuracyEntries = accuracyData.fields.map((field) => {
    const accuracy = accuracyData.averages?.[field.key]?.[testModel]?.accuracy ?? 0;
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
    logger.info(`✅ All fields already at 100% accuracy!`);
    return {
      runId,
      templateKey: accuracyData.templateKey,
      testModel,
      sampledDocIds: [],
      fields: [],
    };
  }

  logger.info(`📊 Found ${failingFields.length} field(s) to optimize`);

  // Step 3: Build failure map and sample documents
  const failingFieldKeys = failingFields.map(({ fieldKey }) => fieldKey);
  const failureMap = buildFieldFailureMap(accuracyData, failingFieldKeys, testModel);

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

  const samplingResult = selectDocsForAgentAlpha(failureMap);
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

