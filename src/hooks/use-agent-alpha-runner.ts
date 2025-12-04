'use client';

import { useCallback, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAccuracyDataStore } from '@/store/AccuracyDataStore';
import { prepareAgentAlphaWorkPlan } from '@/ai/flows/agent-alpha-prepare';
import { processAgentAlphaField } from '@/ai/flows/agent-alpha-process-field';
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

      logger.info(`Agent-Alpha: Processing ${workPlan.fields.length} fields with max concurrency ${AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY}...`);
      toast({
        title: 'Agent-Alpha Started',
        description: `Processing ${workPlan.fields.length} field(s) in parallel. This may take several minutes.`,
      });

      // Step 2: Process all fields in parallel with immediate dispatch on completion
      const results: AgentAlphaFieldResult[] = [];

      // Mark all fields as started immediately
      const globalStartTime = Date.now();
      for (const fieldPlan of workPlan.fields) {
        dispatch({
          type: 'AGENT_ALPHA_FIELD_STARTED',
          payload: {
            fieldKey: fieldPlan.fieldKey,
            fieldName: fieldPlan.field.name,
            initialAccuracy: fieldPlan.initialAccuracy,
            startTime: globalStartTime,
          },
        });
      }

      // Process a single field and dispatch completion immediately when done
      const processFieldWithDispatch = async (fieldPlan: typeof workPlan.fields[0], fieldIndex: number): Promise<AgentAlphaFieldResult | null> => {
        const fieldStartTime = Date.now();

        logger.info(`Agent-Alpha: [${fieldIndex}/${workPlan.fields.length}] Starting ${fieldPlan.field.name}...`);

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
            testModel: config.testModel,
            fieldIndex,
            totalFields: workPlan.fields.length,
            maxIterations: config.maxIterations,
            systemPromptOverride: config.customInstructions || config.systemPromptOverride,
          });

          const fieldEndTime = Date.now();
          const fieldTimeMs = fieldEndTime - fieldStartTime;
          
          // Dispatch completion IMMEDIATELY when this field finishes
          logger.info(`Agent-Alpha: [${fieldIndex}/${workPlan.fields.length}] Completed ${fieldPlan.field.name} - dispatching update`);
          dispatch({
            type: 'AGENT_ALPHA_FIELD_COMPLETED',
            payload: {
              fieldKey: fieldPlan.fieldKey,
              processedFieldInfo: {
                fieldKey: fieldPlan.fieldKey,
                fieldName: fieldPlan.field.name,
                iterationCount: fieldResult.iterationCount,
                initialAccuracy: fieldPlan.initialAccuracy,
                finalAccuracy: fieldResult.finalAccuracy,
                finalPrompt: fieldResult.finalPrompt,
                timeMs: fieldTimeMs,
              },
            },
          });

          return fieldResult;
        } catch (error) {
          logger.error(`Agent-Alpha: Failed to process field ${fieldPlan.field.name}`, error as Error);
          
          // Dispatch failure completion
          dispatch({
            type: 'AGENT_ALPHA_FIELD_COMPLETED',
            payload: {
              fieldKey: fieldPlan.fieldKey,
              processedFieldInfo: {
                fieldKey: fieldPlan.fieldKey,
                fieldName: fieldPlan.field.name,
                iterationCount: 0,
                initialAccuracy: fieldPlan.initialAccuracy,
                finalAccuracy: fieldPlan.initialAccuracy,
                finalPrompt: fieldPlan.field.prompt || '',
                timeMs: Date.now() - fieldStartTime,
              },
            },
          });
          
          return null;
        }
      };

      // Start all field processing in parallel (browser will naturally limit concurrent requests)
      // Each field dispatches its own completion as soon as it finishes
      const fieldPromises = workPlan.fields.map((fieldPlan, index) => 
        processFieldWithDispatch(fieldPlan, index + 1).then(result => {
          if (result) results.push(result);
        })
      );

      // Wait for all fields to complete
      await Promise.all(fieldPromises);
      
      logger.info(`Agent-Alpha: All ${workPlan.fields.length} fields processed.`);

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

    logger.info('Agent-Alpha: Applying results', { count: pendingResults.results.length });

    try {
      const timestamp = new Date().toISOString();
      
      // Build updated fields with new prompts and prompt history
      const updatedFields = accuracyData.fields.map((field) => {
        const result = pendingResults.results.find((r) => r.fieldKey === field.key);
        if (!result) return field;

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

      // Then persist to localStorage
      for (const result of pendingResults.results) {
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
