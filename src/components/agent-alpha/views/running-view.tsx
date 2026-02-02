'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatModelName } from '@/lib/utils';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';
import { ElapsedTime } from '../components/elapsed-time';
import { formatDuration, formatEstimatedTime } from '../utils';
import type { RunningViewProps } from '../types';

export const RunningView: React.FC<RunningViewProps> = ({ agentAlphaState }) => {
  const progressPercentage = agentAlphaState.totalFields > 0
    ? (agentAlphaState.fieldsProcessed / agentAlphaState.totalFields) * 100
    : 0;

  const processingCount = agentAlphaState.processingFields?.length || 0;
  const processedCount = agentAlphaState.processedFields?.length || 0;
  const pendingCount = Math.max(0, agentAlphaState.totalFields - processingCount - processedCount);

  return (
    <div className="space-y-4">
      {/* Overall Progress Bar */}
      <div className="space-y-2 px-6 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Optimizing Prompts...
          </h3>
          <Badge variant="outline" className="text-xs font-normal bg-white dark:bg-transparent">
            {agentAlphaState.fieldsProcessed} / {agentAlphaState.totalFields} Fields Complete
          </Badge>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Runtime Config Summary */}
      {agentAlphaState.runtimeConfig && (
        <div className="px-6">
          <div className="flex gap-4 text-xs text-gray-500 dark:text-muted-foreground">
            <span>Model: <strong className="text-gray-700 dark:text-foreground">{formatModelName(agentAlphaState.runtimeConfig.testModel)}</strong></span>
            <span>Docs: <strong className="text-gray-700 dark:text-foreground">{agentAlphaState.actualDocCount ?? agentAlphaState.runtimeConfig.maxDocs}</strong></span>
            <span>Max Attempts: <strong className="text-gray-700 dark:text-foreground">{agentAlphaState.runtimeConfig.maxIterations}</strong></span>
          </div>
        </div>
      )}

      {/* Processing Section */}
      <div className="px-6">
        <div className="border border-gray-200 dark:border-border rounded-xl overflow-hidden bg-white dark:bg-card shadow-sm">
          <div className="bg-gray-50 dark:bg-muted px-4 py-2.5 border-b border-gray-200 dark:border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground">Processing</h4>
              </div>
              <div className="flex items-center gap-2">
                {processingCount > 0 && (
                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    {processingCount} active
                  </Badge>
                )}
                {pendingCount > 0 && (
                  <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-muted text-gray-600 dark:text-muted-foreground border-gray-200 dark:border-border">
                    {pendingCount} queued
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Table */}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-muted sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[180px]">Field Name</th>
                <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[80px]">Iteration</th>
                <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[100px]">Initial Accuracy</th>
                <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[80px]">Accuracy</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[100px]">Elapsed</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-card">
              {agentAlphaState.processingFields && agentAlphaState.processingFields.length > 0 ? (
                agentAlphaState.processingFields.map((field) => (
                  <tr key={field.fieldKey} className="border-b border-gray-100 dark:border-border/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-foreground">
                      <span className="flex items-start gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0 mt-0.5" />
                        <span className="break-words">{field.fieldName}</span>
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center text-gray-600 dark:text-muted-foreground align-top">
                      <span>{agentAlphaState.runtimeConfig?.maxIterations || AGENT_ALPHA_CONFIG.MAX_ITERATIONS} max</span>
                    </td>
                    <td className="px-2 py-3 text-center text-gray-700 dark:text-foreground align-top">{(field.initialAccuracy * 100).toFixed(0)}%</td>
                    <td className="px-2 py-3 text-center text-gray-400 dark:text-muted-foreground align-top">—</td>
                    <td className="px-4 py-3 text-xs text-blue-600 dark:text-blue-400 font-medium align-top">Optimizing...</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-muted-foreground align-top">
                      <ElapsedTime startTime={field.startTime} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-center text-gray-400 dark:text-muted-foreground">
                    {agentAlphaState.fieldsProcessed === agentAlphaState.totalFields 
                      ? 'All fields completed' 
                      : pendingCount > 0 
                        ? `${pendingCount} field${pendingCount > 1 ? 's' : ''} waiting to start...`
                        : 'Processing...'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Processed Section */}
      <div className="px-6 pb-4">
        <div className="border border-gray-200 dark:border-border rounded-xl overflow-hidden bg-white dark:bg-card shadow-sm">
          <div className="bg-gray-50 dark:bg-muted px-4 py-2.5 border-b border-gray-200 dark:border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground">Processed</h4>
            </div>
          </div>
          
          {/* Table */}
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-muted sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[180px]">Field Name</th>
                  <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[80px]">Iteration</th>
                  <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[100px]">Initial Accuracy</th>
                  <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[80px]">Accuracy</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground">Prompt</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-muted-foreground w-[100px]">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-card">
                {agentAlphaState.processedFields && agentAlphaState.processedFields.length > 0 ? (
                  agentAlphaState.processedFields.map((field, idx) => {
                    // Determine accuracy color: green if improved, black if same, red if worse
                    const accuracyDiff = field.finalAccuracy - field.initialAccuracy;
                    const accuracyColor = accuracyDiff > 0.001 
                      ? 'text-green-600 dark:text-green-400' 
                      : accuracyDiff < -0.001 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-900 dark:text-foreground';
                    
                    return (
                    <tr key={idx} className="border-b border-gray-100 dark:border-border/50 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-foreground align-top">{field.fieldName}</td>
                      <td className="px-2 py-3 text-center text-gray-700 dark:text-muted-foreground align-top">{field.iterationCount}/{agentAlphaState.runtimeConfig?.maxIterations || AGENT_ALPHA_CONFIG.MAX_ITERATIONS}</td>
                      <td className="px-2 py-3 text-center text-gray-700 dark:text-foreground align-top">{(field.initialAccuracy * 100).toFixed(0)}%</td>
                      <td className={cn("px-2 py-3 text-center font-medium align-top", accuracyColor)}>
                        {(field.finalAccuracy * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-muted-foreground align-top">
                        <div className="whitespace-pre-wrap break-words max-w-full">
                          {field.finalPrompt}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-muted-foreground align-top whitespace-nowrap">
                        {formatDuration(field.timeMs)}
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-muted-foreground">
                      No fields completed yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Time Estimate Footer */}
      <div className="flex items-center justify-start px-6 pb-4 pt-3">
        <span className="text-sm font-medium text-gray-600 dark:text-muted-foreground">
          Estimated time per field: {formatEstimatedTime(
            agentAlphaState.totalFields, 
            agentAlphaState.runtimeConfig?.maxIterations,
            agentAlphaState.runtimeConfig?.maxDocs,
            agentAlphaState.runtimeConfig?.fieldConcurrency
          )}
        </span>
      </div>
    </div>
  );
};
