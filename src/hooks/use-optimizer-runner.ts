'use client';

import { useCallback, useMemo, useRef } from 'react';
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
import { processWithConcurrency } from '@/lib/concurrency';
import { v4 as uuidv4 } from 'uuid';

const PROMPT_CONCURRENCY_LIMIT = 3;

interface UseOptimizerRunnerOptions {
  runComparison: () => Promise<void>;
}

interface UseOptimizerRunnerReturn {
  runOptimizer: () => Promise<void>;
  cancelOptimizer: () => void;
  optimizerState: OptimizerState;
  optimizerProgressLabel: string | null;
  resetOptimizer: () => void;
}

const PERFECT_ACCURACY = 0.999999;

export const useOptimizerRunner = ({ runComparison }: UseOptimizerRunnerOptions): UseOptimizerRunnerReturn => {
  const { state, dispatch } = useAccuracyDataStore();
  const { toast } = useToast();
  const optimizerState = state.optimizer;
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to check if the run was cancelled
  const checkCancelled = useCallback(() => {
    if (abortControllerRef.current?.signal.aborted) {
      throw new Error('Optimizer cancelled by user');
    }
  }, []);

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

  const cancelOptimizer = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: 'OPTIMIZER_RESET' });
    toast({
      title: 'Optimizer cancelled',
      description: 'The optimization run was stopped.',
    });
    logger.info('optimizer_cancelled_by_user');
  }, [dispatch, toast]);

  const ensureComparisonResults = useCallback(async () => {
    if (!state.data) {
      return false;
    }

    const hasComparison = state.data.results?.some((file) => {
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

    const accuracyData = state.data;
    if (!accuracyData) {
      toast({
        title: 'No accuracy data',
        description: 'Load comparison results before running the optimizer.',
        variant: 'destructive',
      });
      return;
    }

    // Set up cancellation
    abortControllerRef.current = new AbortController();

    let workingFields = accuracyData.fields;
    const runId = uuidv4();
    dispatch({ type: 'OPTIMIZER_START', payload: { runId } });

    try {
      await ensureComparisonResults();
      checkCancelled();

      dispatch({ type: 'OPTIMIZER_UPDATE', payload: { status: 'sampling', stepIndex: 1 } });

      const baseModel = accuracyData.baseModel;
      const fieldAccuracyEntries = accuracyData.fields.map((field) => {
        const accuracyBefore = accuracyData.averages?.[field.key]?.[baseModel]?.accuracy ?? null;
        return { fieldKey: field.key, accuracyBefore };
      });

      const candidateFields = fieldAccuracyEntries.filter(({ accuracyBefore }) => {
        if (accuracyBefore === null) return true;
        return accuracyBefore < PERFECT_ACCURACY;
      });

      const failingFieldKeys = candidateFields.map(({ fieldKey }) => fieldKey);
      const accuracyLookup = new Map(candidateFields.map(({ fieldKey, accuracyBefore }) => [fieldKey, accuracyBefore ?? 0]));

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

      checkCancelled();
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
      checkCancelled();
      dispatch({ type: 'OPTIMIZER_UPDATE', payload: { sampledDocs: theories } });

      dispatch({ type: 'OPTIMIZER_UPDATE', payload: { status: 'prompting', stepIndex: 3 } });

      // Process fields concurrently for better performance
      type FieldProcessingResult = {
        fieldKey: string;
        accuracyBefore: number;
        sampledDocIds: string[];
        newPrompt?: string;
        promptTheory?: string;
        error?: string;
        newHistoryEntry?: {
          id: string;
          prompt: string;
          savedAt: string;
          source: 'optimizer';
          note: string;
        };
      };

      const fieldSummaries = await processWithConcurrency<string, FieldProcessingResult>(
        filteredFailingFields,
        PROMPT_CONCURRENCY_LIMIT,
        async (fieldKey) => {
          checkCancelled(); // Check before processing each field
          
          const field = accuracyData.fields.find((f) => f.key === fieldKey);
          const docIds = samplingResult.fieldToDocIds[fieldKey] ?? [];
          const accuracyBefore = accuracyLookup.get(fieldKey) ?? 0;

          if (!field) {
            return { fieldKey, accuracyBefore, sampledDocIds: docIds, error: 'Field not found' };
          }

          const theoryEntries = docIds
            .map((docId) => {
              const doc = theories.find((entry) => entry.docId === docId);
              const theory = doc?.theories[fieldKey];
              return theory
                ? { docId, docName: doc?.docName ?? docId, theory }
                : null;
            })
            .filter(Boolean) as Array<{ docId: string; docName: string; theory: string }>;

          if (!theoryEntries.length) {
            return { fieldKey, accuracyBefore, sampledDocIds: docIds, error: 'No theories generated for this field' };
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

            return {
              fieldKey,
              accuracyBefore,
              sampledDocIds: docIds,
              newPrompt: promptResponse.newPrompt,
              promptTheory: promptResponse.promptTheory,
              newHistoryEntry,
            };
          } catch (error) {
            logger.error('optimizer_prompt_generation_failed', { fieldKey, error });
            return {
              fieldKey,
              accuracyBefore,
              sampledDocIds: docIds,
              error: error instanceof Error ? error.message : 'Unknown prompt error',
            };
          }
        }
      );

      // Batch update all fields after concurrent processing completes
      const successfulResults = fieldSummaries.filter((r) => r.newPrompt && r.newHistoryEntry);
      if (successfulResults.length > 0) {
        workingFields = workingFields.map((existing) => {
          const result = successfulResults.find((r) => r.fieldKey === existing.key);
          if (!result || !result.newHistoryEntry) return existing;
          return {
            ...existing,
            prompt: result.newPrompt!,
            promptHistory: [result.newHistoryEntry, ...existing.promptHistory],
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

        // Save all updated prompts
        for (const result of successfulResults) {
          const updatedField = workingFields.find((f) => f.key === result.fieldKey);
          if (updatedField) {
            saveFieldPrompt(result.fieldKey, updatedField.prompt, updatedField.promptHistory, accuracyData.templateKey);
          }
        }
      }

      // Convert to OptimizerFieldSummary format (without newHistoryEntry)
      const finalSummaries: OptimizerFieldSummary[] = fieldSummaries.map(({ newHistoryEntry, ...rest }) => rest);

      dispatch({ type: 'OPTIMIZER_COMPLETE', payload: { sampledDocs: theories, fieldSummaries: finalSummaries } });

      const updatedCount = finalSummaries.filter((summary) => summary.newPrompt).length;
      toast({
        title: 'Optimizer finished',
        description: `Updated ${updatedCount} field(s) using ${samplingResult.docs.length} documents.`,
      });
    } catch (error) {
      // Don't show error toast if user cancelled
      if (abortControllerRef.current?.signal.aborted) {
        logger.info('optimizer_run_cancelled');
        return;
      }
      
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
    } finally {
      abortControllerRef.current = null;
    }
  }, [checkCancelled, dispatch, ensureComparisonResults, optimizerState.status, state.data, toast]);

  return {
    runOptimizer,
    cancelOptimizer,
    optimizerState,
    optimizerProgressLabel,
    resetOptimizer,
  };
};
