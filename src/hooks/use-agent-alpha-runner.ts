'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccuracyDataStore } from '@/store/AccuracyDataStore';
import { prepareAgentAlphaWorkPlan } from '@/ai/flows/agent-alpha-prepare';
import { processAgentAlphaField } from '@/ai/flows/agent-alpha-process-field';
import { saveFieldPrompt } from '@/lib/prompt-storage';
import { logger } from '@/lib/logger';
import { getCompareConfigForField } from '@/lib/compare-type-storage';
import { v4 as uuidv4 } from 'uuid';
import type { AgentAlphaFieldResult } from '@/lib/agent-alpha-types';

export const useAgentAlphaRunner = () => {
  const { state, dispatch } = useAccuracyDataStore();
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const agentAlphaState = state.agentAlpha;
  const pendingResults = state.agentAlphaPendingResults;
  const accuracyData = state.data;

  const runAgentAlpha = useCallback(async () => {
    if (agentAlphaState.status !== 'idle' && agentAlphaState.status !== 'error') {
      logger.warn('Agent-Alpha already running');
      return;
    }

    if (!accuracyData) {
      toast({
        title: 'No accuracy data',
        description: 'Load comparison results before running Agent-Alpha.',
        variant: 'destructive',
      });
      return;
    }

    const hasComparison = accuracyData.results?.some((file) => {
      return Object.values(file.comparisonResults ?? {}).some((modelMap) =>
        Object.values(modelMap).some((meta) => meta?.isMatch !== undefined)
      );
    });

    if (!hasComparison) {
      toast({
        title: 'Run Comparison First',
        description: 'Please run a comparison before using Agent-Alpha. It needs comparison results to identify failing fields.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedModel) {
      toast({
        title: 'Select Model',
        description: 'Please select a model to use for testing extractions.',
        variant: 'destructive',
      });
      return;
    }

    const runId = uuidv4();
    const runStartTime = Date.now(); // Capture start time locally

    try {
      // Step 1: Prepare work plan
      logger.info('Agent-Alpha: Preparing work plan...');
      const workPlan = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: selectedModel,
      });

      if (workPlan.fields.length === 0) {
        toast({
          title: 'All Fields Accurate',
          description: 'All fields are already at 100% accuracy. No optimization needed.',
        });
        return;
      }

      // Start Agent-Alpha
      dispatch({
        type: 'AGENT_ALPHA_START',
        payload: {
          runId,
          selectedModel,
          totalFields: workPlan.fields.length,
        },
      });

      logger.info(`Agent-Alpha: Processing ${workPlan.fields.length} fields...`);
      toast({
        title: 'Agent-Alpha Started',
        description: `Processing ${workPlan.fields.length} field(s). This may take several minutes.`,
      });

      // Step 2: Process each field sequentially
      const results: AgentAlphaFieldResult[] = [];

      for (let i = 0; i < workPlan.fields.length; i++) {
        const fieldPlan = workPlan.fields[i];
        const fieldIndex = i + 1;
        const fieldStartTime = Date.now(); // Track start time for this field

        logger.info(`Agent-Alpha: [${fieldIndex}/${workPlan.fields.length}] Processing ${fieldPlan.field.name}...`);

        // Update progress
        dispatch({
          type: 'AGENT_ALPHA_UPDATE_PROGRESS',
          payload: {
            currentField: fieldPlan.fieldKey,
            currentFieldName: fieldPlan.field.name,
            fieldsProcessed: i,
            currentIteration: 0,
            currentAccuracy: fieldPlan.initialAccuracy,
          },
        });

        try {
          // Get compare config for this field from compare type storage
          const fieldCompareConfig = getCompareConfigForField(accuracyData.templateKey, fieldPlan.fieldKey) ?? undefined;
          
          const fieldResult = await processAgentAlphaField({
            fieldKey: fieldPlan.fieldKey,
            fieldName: fieldPlan.field.name,
            fieldType: fieldPlan.field.type,
            fieldPrompt: fieldPlan.field.prompt,
            fieldOptions: fieldPlan.field.options,
            compareConfig: fieldCompareConfig,
            initialAccuracy: fieldPlan.initialAccuracy,
            groundTruth: fieldPlan.groundTruth,
            sampledDocIds: workPlan.sampledDocIds,
            templateKey: workPlan.templateKey,
            testModel: selectedModel,
            fieldIndex,
            totalFields: workPlan.fields.length,
          });

          results.push(fieldResult);

          // Update progress after field completes - add to processed fields list
          const fieldEndTime = Date.now();
          const fieldTimeMs = fieldEndTime - fieldStartTime; // Time for just this field
        
          dispatch({
            type: 'AGENT_ALPHA_UPDATE_PROGRESS',
            payload: {
              currentField: null,
              currentFieldName: null,
              fieldsProcessed: fieldIndex,
              currentIteration: 0,
              currentAccuracy: fieldResult.finalAccuracy,
              processedFieldInfo: {
                fieldName: fieldPlan.field.name,
                iterationCount: fieldResult.iterationCount,
                initialAccuracy: fieldPlan.initialAccuracy,
                finalAccuracy: fieldResult.finalAccuracy,
                finalPrompt: fieldResult.finalPrompt,
                timeMs: fieldTimeMs,
              },
            },
          });
        } catch (error) {
          logger.error(`Agent-Alpha: Failed to process field ${fieldPlan.field.name}`, error as Error);
          // Continue with other fields even if one fails
        }
      }

      // Step 3: Calculate timing and prepare results
      const endTime = Date.now();
      const actualTimeMs = endTime - runStartTime; // Use locally captured start time
      
      // Estimate: ~12 seconds per iteration per field
      const estimatedTimeMs = workPlan.fields.length * 3 * 12 * 1000; // 3 avg iterations * 12 sec
      
      // Build document name mapping
      const sampledDocNames: Record<string, string> = {};
      for (const docId of workPlan.sampledDocIds) {
        const fileResult = accuracyData.results.find((r) => r.id === docId);
        if (fileResult) {
          sampledDocNames[docId] = fileResult.fileName;
        }
      }

      // Step 4: Show preview modal with results
      dispatch({
        type: 'AGENT_ALPHA_COMPLETE',
        payload: {
          runId,
          results,
          timestamp: new Date().toISOString(),
          testModel: selectedModel,
          sampledDocIds: workPlan.sampledDocIds,
          sampledDocNames,
          startTime: runStartTime,
          endTime,
          estimatedTimeMs,
          actualTimeMs,
        },
      });

      toast({
        title: 'Agent-Alpha Complete',
        description: `Generated ${results.length} improved prompt(s). Review and approve in the preview modal.`,
        variant: 'default',
      });

      logger.info('Agent-Alpha: Run completed successfully');
    } catch (error) {
      logger.error('❌ Agent-Alpha failed:', error as Error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      dispatch({ type: 'AGENT_ALPHA_ERROR', payload: { error: errorMessage } });
      toast({
        title: 'Agent-Alpha Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [agentAlphaState.status, accuracyData, selectedModel, dispatch, toast]);

  const applyResults = useCallback(async () => {
    if (!pendingResults || !accuracyData) {
      logger.warn('No pending results to apply');
      return;
    }

    logger.info('Agent-Alpha: Applying results', { count: pendingResults.results.length });

    try {
      // Save each field's prompt to prompt studio
      for (const result of pendingResults.results) {
        const field = accuracyData.fields.find((f) => f.key === result.fieldKey);
        if (!field) continue;

        const timestamp = new Date().toISOString();
        const newVersion = {
          id: `agent-alpha-${timestamp}-${uuidv4()}`,
          prompt: result.finalPrompt,
          savedAt: timestamp,
          source: 'agent-alpha' as const,
          generationMethod: 'agent' as const,
          note: `Agent-Alpha optimized. Initial: ${(result.initialAccuracy * 100).toFixed(1)}% → Final: ${(result.finalAccuracy * 100).toFixed(1)}% (${result.iterationCount} iterations)`,
        };

        // Create updated prompt history with new version at the front
        const updatedPromptHistory = [newVersion, ...field.promptHistory];

        // Save using correct parameter order: fieldKey, activePrompt, promptHistory, templateKey
        saveFieldPrompt(
          result.fieldKey,
          result.finalPrompt,
          updatedPromptHistory,
          accuracyData.templateKey
        );

        logger.info(`Agent-Alpha: Saved prompt for ${result.fieldName}`);
      }

      dispatch({ type: 'AGENT_ALPHA_APPLY_RESULTS' });

      toast({
        title: 'Prompts Applied',
        description: `Successfully saved ${pendingResults.results.length} Agent-Alpha prompt(s).`,
        variant: 'default',
      });

      logger.info('Agent-Alpha: All prompts applied successfully');
    } catch (error) {
      logger.error('Agent-Alpha: Failed to apply results', error as Error);
      toast({
        title: 'Save Failed',
        description: 'Failed to apply prompts. Check console for details.',
        variant: 'destructive',
      });
    }
  }, [pendingResults, accuracyData, dispatch, toast]);

  const discardResults = useCallback(() => {
    logger.info('Agent-Alpha: Discarding results');
    dispatch({ type: 'AGENT_ALPHA_DISCARD_RESULTS' });
    toast({
      title: 'Prompts Discarded',
      description: 'Agent-Alpha changes have been discarded.',
    });
  }, [dispatch, toast]);

  const resetState = useCallback(() => {
    dispatch({ type: 'AGENT_ALPHA_RESET' });
  }, [dispatch]);

  return {
    runAgentAlpha,
    applyResults,
    discardResults,
    resetState,
    selectedModel,
    setSelectedModel,
    agentAlphaState,
    pendingResults,
    isRunning: agentAlphaState.status !== 'idle' && agentAlphaState.status !== 'error' && agentAlphaState.status !== 'preview',
    isPreview: agentAlphaState.status === 'preview',
  };
};

