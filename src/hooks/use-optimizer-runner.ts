'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccuracyDataStore } from '@/store/AccuracyDataStore';
import { logger } from '@/lib/logger';
import { saveFieldPrompt } from '@/lib/prompt-storage';
import type { AccuracyData, AccuracyField } from '@/lib/types';
import {
  OPTIMIZER_STEPS,
  type OptimizerFieldSummary,
  type OptimizerState,
} from '@/lib/optimizer-types';
import { buildFieldFailureMap, selectDocsForOptimizer } from '@/lib/optimizer-sampling';
import { generateDocumentTheories } from '@/ai/flows/optimizer-diagnostics';
import { generateOptimizerPrompt } from '@/ai/flows/optimizer-prompts';
import type { OptimizerDocumentDiagnosticsInput } from '@/lib/optimizer-types';
import { v4 as uuidv4 } from 'uuid';

interface UseOptimizerRunnerOptions {
  runComparison: () => Promise<void>;
}

interface UseOptimizerRunnerReturn {
  runOptimizer: () => Promise<void>;
  optimizerState: OptimizerState;
  optimizerProgressLabel: string | null;
  resetOptimizer: () => void;
}

export const useOptimizerRunner = ({ runComparison }: UseOptimizerRunnerOptions): UseOptimizerRunnerReturn => {
  const { state, dispatch } = useAccuracyDataStore();
  const { toast } = useToast();
  const optimizerState = state.optimizer;
  const dataRef = useRef(state.data);

  useEffect(() => {
    dataRef.current = state.data;
  }, [state.data]);

  const optimizerProgressLabel = useMemo(() => {
    if (optimizerState.status === 'idle') {
      return null;
    }

    const stepName = OPTIMIZER_STEPS[optimizerState.stepIndex] ?? OPTIMIZER_STEPS[0];
    return `Optimizing… (${stepName} ${optimizerState.stepIndex + 1}/${OPTIMIZER_STEPS.length})`;
  }, [optimizerState.stepIndex, optimizerState.status]);

  const resetOptimizer = useCallback(() => {
    dispatch({ type: 'OPTIMIZER_RESET' });
  }, [dispatch]);

  const ensureComparisonResults = useCallback(async () => {
    if (!dataRef.current) {
      return false;
    }

    const hasComparison = dataRef.current.results?.some((file) => {
      return Object.values(file.comparisonResults ?? {}).some((modelMap) =>
        Object.values(modelMap).some((meta) => meta?.isMatch !== undefined)
      );
    });

    if (hasComparison) {
      return true;
    }

    await runComparison();
    return true;
  }, [runComparison, state.data]);

  const runOptimizer = useCallback(async () => {
    if (optimizerState.status !== 'idle' && optimizerState.status !== 'error') {
      return;
    }

    const accuracyData = dataRef.current;
    if (!accuracyData) {
      toast({
        title: 'No accuracy data',
        description: 'Load comparison results before running the optimizer.',
        variant: 'destructive',
      });
      return;
    }

    let workingFields = accuracyData.fields;
    const runId = uuidv4();
    dispatch({ type: 'OPTIMIZER_START', payload: { runId } });

    try {
      await ensureComparisonResults();

      dispatch({ type: 'OPTIMIZER_UPDATE', payload: { status: 'sampling', stepIndex: 1 } });

      const baseModel = accuracyData.baseModel;
      const failingFieldKeys = accuracyData.fields
        .map((field) => field.key)
        .filter((fieldKey) => {
          const modelMetrics = accuracyData.averages?.[fieldKey]?.[baseModel];
          return !modelMetrics || modelMetrics.accuracy < 1;
        });

      const failureMap = buildFieldFailureMap(accuracyData, failingFieldKeys, baseModel);
      const filteredFailingFields = failingFieldKeys.filter((fieldKey) => failureMap[fieldKey]?.length);

      if (filteredFailingFields.length === 0) {
        toast({
          title: 'Optimizer skipped',
          description: 'All fields are already 100% accurate.',
        });
        dispatch({ type: 'OPTIMIZER_RESET' });
        return;
      }

      const samplingResult = selectDocsForOptimizer(failureMap);
      if (!samplingResult.docs.length) {
        toast({
          title: 'Optimizer skipped',
          description: 'No failing documents available for sampling.',
        });
        dispatch({ type: 'OPTIMIZER_RESET' });
        return;
      }

      dispatch({ type: 'OPTIMIZER_UPDATE', payload: { status: 'diagnostics', stepIndex: 2 } });

      const diagnosticsInput: OptimizerDocumentDiagnosticsInput[] = samplingResult.docs.map((doc) => ({
        fileId: doc.docId,
        fileName: doc.docName,
        templateKey: accuracyData.templateKey,
        fieldFailures: doc.fieldKeys.map((fieldKey) => {
          const fieldResult = failureMap[fieldKey]?.find((entry) => entry.docId === doc.docId);
          const fieldMeta = accuracyData.fields.find((f) => f.key === fieldKey);
          return {
            fieldKey,
            fieldName: fieldMeta?.name ?? fieldKey,
            groundTruth: fieldResult?.groundTruth ?? '',
            extractedValue: fieldResult?.extractedValue ?? '',
          };
        }),
      }));

      const theories = await generateDocumentTheories(diagnosticsInput);
      dispatch({ type: 'OPTIMIZER_UPDATE', payload: { sampledDocs: theories } });

      dispatch({ type: 'OPTIMIZER_UPDATE', payload: { status: 'prompting', stepIndex: 3 } });

      const fieldSummaries: OptimizerFieldSummary[] = [];

      for (const fieldKey of filteredFailingFields) {
        const field = accuracyData.fields.find((f) => f.key === fieldKey);
        if (!field) continue;
        const docIds = samplingResult.fieldToDocIds[fieldKey] ?? [];
        const theoryEntries = docIds
          .map((docId) => {
            const doc = theories.find((entry) => entry.docId === docId);
            const theory = doc?.theories[fieldKey];
            return theory
              ? {
                  docId,
                  docName: doc?.docName ?? docId,
                  theory,
                }
              : null;
          })
          .filter(Boolean) as Array<{ docId: string; docName: string; theory: string }>;

        if (!theoryEntries.length) {
          fieldSummaries.push({
            fieldKey,
            accuracyBefore: accuracyData.averages?.[fieldKey]?.[baseModel]?.accuracy ?? 0,
            sampledDocIds: docIds,
            error: 'No theories generated for this field',
          });
          continue;
        }

        try {
          const promptResponse = await generateOptimizerPrompt({
            fieldKey,
            fieldName: field.name,
            fieldType: field.type,
            currentPrompt: field.prompt,
            previousPrompts: field.promptHistory.slice(0, 3).map((entry) => ({
              id: entry.id,
              prompt: entry.prompt,
              savedAt: entry.savedAt,
            })),
            theories: theoryEntries,
          });
          const timestamp = new Date().toISOString();
          const newHistoryEntry = {
            id: `optimizer-${timestamp}`,
            prompt: promptResponse.newPrompt,
            savedAt: timestamp,
            source: 'optimizer' as const,
            note: promptResponse.promptTheory,
          };

          workingFields = workingFields.map((existing) => {
            if (existing.key !== field.key) {
              return existing;
            }
            return {
              ...existing,
              prompt: promptResponse.newPrompt,
              promptHistory: [newHistoryEntry, ...existing.promptHistory],
            } satisfies AccuracyField;
          });

          const payload: AccuracyData = {
            templateKey: accuracyData.templateKey,
            baseModel: accuracyData.baseModel,
            fields: workingFields,
            results: accuracyData.results,
            averages: accuracyData.averages,
            fieldSettings: accuracyData.fieldSettings,
          };

          dispatch({ type: 'SET_ACCURACY_DATA', payload });
          const updatedField = workingFields.find((f) => f.key === field.key)!;
          saveFieldPrompt(field.key, updatedField.prompt, updatedField.promptHistory, accuracyData.templateKey);

          fieldSummaries.push({
            fieldKey,
            accuracyBefore: accuracyData.averages?.[fieldKey]?.[baseModel]?.accuracy ?? 0,
            sampledDocIds: docIds,
            newPrompt: promptResponse.newPrompt,
            promptTheory: promptResponse.promptTheory,
          });
        } catch (error) {
          logger.error('optimizer_prompt_generation_failed', { fieldKey, error });
          fieldSummaries.push({
            fieldKey,
            accuracyBefore: accuracyData.averages?.[fieldKey]?.[baseModel]?.accuracy ?? 0,
            sampledDocIds: docIds,
            error: error instanceof Error ? error.message : 'Unknown prompt error',
          });
        }
      }

      dispatch({ type: 'OPTIMIZER_COMPLETE', payload: { sampledDocs: theories, fieldSummaries } });

      const updatedCount = fieldSummaries.filter((summary) => summary.newPrompt).length;
      toast({
        title: 'Optimizer finished',
        description: `Updated ${updatedCount} field(s) using ${samplingResult.docs.length} documents.`,
      });
    } catch (error) {
      logger.error('optimizer_run_failed', error as Error);
      dispatch({
        type: 'OPTIMIZER_FAIL',
        payload: { error: error instanceof Error ? error.message : 'Unknown optimizer failure' },
      });
      toast({
        title: 'Optimizer failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [dispatch, ensureComparisonResults, optimizerState.status, state.data, toast]);

  return {
    runOptimizer,
    optimizerState,
    optimizerProgressLabel,
    resetOptimizer,
  };
};
