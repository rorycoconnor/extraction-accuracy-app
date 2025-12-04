'use client';

import { useCallback, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccuracyDataStore } from '@/store/AccuracyDataStore';
import { prepareAgentAlphaWorkPlan } from '@/ai/flows/agent-alpha-prepare';
import { processAgentAlphaFieldsBatch, type ProcessFieldParams } from '@/ai/flows/agent-alpha-process-field';
import { saveFieldPrompt } from '@/lib/prompt-storage';
import { logger } from '@/lib/logger';
import { getCompareConfigForField } from '@/lib/compare-type-storage';
import { getConfiguredTemplates } from '@/lib/mock-data';
import { v4 as uuidv4 } from 'uuid';
import type { AgentAlphaFieldResult } from '@/lib/agent-alpha-types';
import type { AgentAlphaRuntimeConfig } from '@/lib/agent-alpha-config';
import { getDefaultRuntimeConfig, AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';

export const useAgentAlphaRunner = () => {
  const { state, dispatch } = useAccuracyDataStore();
  const { toast } = useToast();

  const agentAlphaState = state.agentAlpha;
  const pendingResults = state.agentAlphaPendingResults;
  const accuracyData = state.data;

  // Open the configuration modal
  const openConfigureModal = useCallback(() => {
    if (agentAlphaState.status !== 'idle' && agentAlphaState.status !== 'error') {
      logger.warn('Agent-Alpha already running or in another state');
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

    // Open configure modal
    dispatch({ type: 'AGENT_ALPHA_CONFIGURE' });
  }, [agentAlphaState.status, accuracyData, dispatch, toast]);

  // Start the agent with the provided configuration
  const runAgentAlphaWithConfig = useCallback(async (config: AgentAlphaRuntimeConfig) => {
    if (!accuracyData) {
      toast({
        title: 'No accuracy data',
        description: 'Load comparison results before running Agent-Alpha.',
        variant: 'destructive',
      });
      return;
    }

    const runId = uuidv4();
    const runStartTime = Date.now();

    try {
      // Step 1: Get configured template to check which fields are active
      const configuredTemplates = getConfiguredTemplates();
      const configuredTemplate = configuredTemplates.find(
        (t) => t.templateKey === accuracyData.templateKey
      );
      
      // Step 2: Prepare work plan with config (will filter out disabled fields)
      logger.info('Agent-Alpha: Preparing work plan...', { config });
      const workPlan = await prepareAgentAlphaWorkPlan({
        accuracyData,
        testModel: config.testModel,
        maxDocs: config.maxDocs,
        configuredTemplate, // Pass template so we can check isActive status
      });

      if (workPlan.fields.length === 0) {
        toast({
          title: 'All Fields Accurate',
          description: 'All fields are already at 100% accuracy. No optimization needed.',
        });
        dispatch({ type: 'AGENT_ALPHA_RESET' });
        return;
      }

      // Start Agent-Alpha with runtime config
      dispatch({
        type: 'AGENT_ALPHA_START',
        payload: {
          runId,
          selectedModel: config.testModel,
          totalFields: workPlan.fields.length,
          runtimeConfig: config,
          actualDocCount: workPlan.sampledDocIds.length,
        },
      });

      logger.info(`Agent-Alpha: Processing ${workPlan.fields.length} fields with TRUE parallel execution (concurrency ${AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY})...`);
      toast({
        title: 'Agent-Alpha Started',
        description: `Processing ${workPlan.fields.length} field(s) in parallel on server. This may take several minutes.`,
      });

      // Step 2: Mark all fields as processing (they'll run in parallel on server)
      const fieldStartTime = Date.now();
      for (const fieldPlan of workPlan.fields) {
        dispatch({
          type: 'AGENT_ALPHA_FIELD_STARTED',
          payload: {
            fieldKey: fieldPlan.fieldKey,
            fieldName: fieldPlan.field.name,
            initialAccuracy: fieldPlan.initialAccuracy,
            startTime: fieldStartTime,
          },
        });
      }

      // Step 3: Prepare batch parameters for all fields
      const batchParams: ProcessFieldParams[] = workPlan.fields.map((fieldPlan, index) => {
        const fieldCompareConfig = getCompareConfigForField(accuracyData.templateKey, fieldPlan.fieldKey) ?? undefined;
        return {
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
          testModel: config.testModel,
          fieldIndex: index + 1,
          totalFields: workPlan.fields.length,
          maxIterations: config.maxIterations,
          systemPromptOverride: config.customInstructions || config.systemPromptOverride,
        };
      });

      // Step 4: Process ALL fields in parallel on the server (single server action)
      // This avoids Next.js server action serialization!
      logger.info(`Agent-Alpha: Sending batch of ${batchParams.length} fields to server for parallel processing...`);
      const results = await processAgentAlphaFieldsBatch(batchParams, AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY);

      // Step 5: Mark all fields as completed with their results
      const fieldEndTime = Date.now();
      const avgTimeMs = (fieldEndTime - fieldStartTime) / results.length;
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const fieldPlan = workPlan.fields[i];
        
        dispatch({
          type: 'AGENT_ALPHA_FIELD_COMPLETED',
          payload: {
            fieldKey: fieldPlan.fieldKey,
            processedFieldInfo: {
              fieldKey: fieldPlan.fieldKey,
              fieldName: fieldPlan.field.name,
              iterationCount: result.iterationCount,
              initialAccuracy: fieldPlan.initialAccuracy,
              finalAccuracy: result.finalAccuracy,
              finalPrompt: result.finalPrompt,
              timeMs: avgTimeMs, // Approximate per-field time
            },
          },
        });
      }

      // Step 3: Calculate timing and prepare results
      const endTime = Date.now();
      const actualTimeMs = endTime - runStartTime;
      
      // Estimate based on config (with parallelization)
      // Fields run in parallel (2 at a time), docs run in parallel (5 at a time)
      const avgIterations = Math.min(config.maxIterations, 3);
      const secondsPerIteration = 6 + (config.maxDocs / AGENT_ALPHA_CONFIG.EXTRACTION_CONCURRENCY) * 3;
      const secondsPerField = avgIterations * secondsPerIteration;
      const fieldBatches = Math.ceil(workPlan.fields.length / AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY);
      const estimatedTimeMs = fieldBatches * secondsPerField * 1000;
      
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
          testModel: config.testModel,
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
  }, [accuracyData, dispatch, toast]);

  const applyResults = useCallback(async () => {
    if (!pendingResults || !accuracyData) {
      logger.warn('No pending results to apply');
      return;
    }

    // Filter to only include results that improved (or at least didn't get worse)
    const improvedResults = pendingResults.results.filter((r) => r.improved !== false);
    const skippedResults = pendingResults.results.filter((r) => r.improved === false);

    logger.info('Agent-Alpha: Applying results', { 
      total: pendingResults.results.length,
      improved: improvedResults.length,
      skipped: skippedResults.length
    });

    if (skippedResults.length > 0) {
      logger.info('Agent-Alpha: Skipping non-improved fields:', skippedResults.map(r => r.fieldName));
    }

    if (improvedResults.length === 0) {
      toast({
        title: 'No Prompts Applied',
        description: 'None of the generated prompts improved accuracy. Original prompts retained.',
        variant: 'default',
      });
      dispatch({ type: 'AGENT_ALPHA_APPLY_RESULTS' });
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      
      // Build updated fields with new prompts and prompt history
      // Only update fields that actually improved
      const updatedFields = accuracyData.fields.map((field) => {
        const result = improvedResults.find((r) => r.fieldKey === field.key);
        if (!result) return field; // Keep original if not improved or not in results

        const newVersion = {
          id: `agent-alpha-${timestamp}-${uuidv4()}`,
          prompt: result.finalPrompt,
          savedAt: timestamp,
          source: 'agent-alpha' as const,
          generationMethod: 'agent' as const,
          note: `Agent-Alpha optimized. Initial: ${(result.initialAccuracy * 100).toFixed(1)}% → Final: ${(result.finalAccuracy * 100).toFixed(1)}% (${result.iterationCount} iterations)`,
        };

        return {
          ...field,
          prompt: result.finalPrompt,
          promptHistory: [newVersion, ...field.promptHistory],
        };
      });

      // Update React state FIRST so UI reflects changes immediately
      dispatch({
        type: 'SET_ACCURACY_DATA',
        payload: { ...accuracyData, fields: updatedFields },
      });

      // Then persist to localStorage - only for improved results
      for (const result of improvedResults) {
        const updatedField = updatedFields.find((f) => f.key === result.fieldKey);
        if (!updatedField) continue;

        // Save using correct parameter order: fieldKey, activePrompt, promptHistory, templateKey
        saveFieldPrompt(
          result.fieldKey,
          updatedField.prompt,
          updatedField.promptHistory,
          accuracyData.templateKey
        );

        logger.info(`Agent-Alpha: Saved prompt for ${result.fieldName}`);
      }

      dispatch({ type: 'AGENT_ALPHA_APPLY_RESULTS' });

      const skippedMsg = skippedResults.length > 0 
        ? ` (${skippedResults.length} skipped - no improvement)` 
        : '';
      toast({
        title: 'Prompts Applied',
        description: `Successfully saved ${improvedResults.length} Agent-Alpha prompt(s)${skippedMsg}.`,
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
    openConfigureModal,
    runAgentAlphaWithConfig,
    applyResults,
    discardResults,
    resetState,
    agentAlphaState,
    pendingResults,
    isConfigure: agentAlphaState.status === 'configure',
    isRunning: agentAlphaState.status === 'running',
    isPreview: agentAlphaState.status === 'preview',
    isModalOpen: agentAlphaState.status === 'configure' || agentAlphaState.status === 'running' || agentAlphaState.status === 'preview',
  };
};
