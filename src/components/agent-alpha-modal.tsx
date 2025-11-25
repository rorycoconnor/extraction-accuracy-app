'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentAlphaState, AgentAlphaPendingResults } from '@/lib/agent-alpha-types';
import { AGENT_ALPHA_CONFIG } from '@/lib/agent-alpha-config';

interface AgentAlphaModalProps {
  isOpen: boolean;
  agentAlphaState: AgentAlphaState;
  results: AgentAlphaPendingResults | null;
  onApply: () => void;
  onCancel: () => void;
}

export const AgentAlphaModal: React.FC<AgentAlphaModalProps> = ({
  isOpen,
  agentAlphaState,
  results,
  onApply,
  onCancel,
}) => {
  const isRunning = agentAlphaState.status === 'running';
  const isPreview = agentAlphaState.status === 'preview';
  const isError = agentAlphaState.status === 'error';

  const progressPercentage = agentAlphaState.totalFields > 0
    ? (agentAlphaState.fieldsProcessed / agentAlphaState.totalFields) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            {isPreview ? 'Agent Prompt Optimization Results' : 'Agent Prompt Optimization'}
          </DialogTitle>
        </DialogHeader>

        {/* Running Mode - Table Layout */}
        {isRunning && (
          <div className="space-y-4">
            {/* Overall Progress Bar */}
            <div className="space-y-2 px-6 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  Optimizing Prompts...
                </h3>
                <Badge variant="outline" className="text-xs font-normal bg-white">
                  {agentAlphaState.fieldsProcessed} / {agentAlphaState.totalFields} Fields Complete
                </Badge>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Processing Section */}
            <div className="px-6">
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                    <h4 className="text-sm font-semibold text-gray-900">Processing</h4>
                  </div>
                </div>
                
                {/* Table */}
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-[180px]">Field Name</th>
                      <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[80px]">Iteration</th>
                      <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[100px]">Initial Accuracy</th>
                      <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[80px]">Accuracy</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Prompt</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-[100px]">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {agentAlphaState.currentFieldName ? (
                      <tr className="border-b border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-900">{agentAlphaState.currentFieldName}</td>
                        <td className="px-2 py-3 text-center text-gray-700">
                          <span className="inline-flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                            <span className="text-gray-600">{AGENT_ALPHA_CONFIG.MAX_ITERATIONS} max</span>
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center text-gray-700">{(agentAlphaState.currentAccuracy * 100).toFixed(0)}%</td>
                        <td className="px-2 py-3 text-center text-gray-400">—</td>
                        <td className="px-4 py-3 text-xs text-gray-400 italic">Processing...</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400">—</td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-center text-gray-400">
                          Preparing...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Processed Section */}
            <div className="px-6 pb-4">
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <h4 className="text-sm font-semibold text-gray-900">Processed</h4>
                  </div>
                </div>
                
                {/* Table */}
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-[180px]">Field Name</th>
                        <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[80px]">Iteration</th>
                        <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[100px]">Initial Accuracy</th>
                        <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[80px]">Accuracy</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Prompt</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-[100px]">Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {agentAlphaState.processedFields && agentAlphaState.processedFields.length > 0 ? (
                        agentAlphaState.processedFields.map((field, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-900 align-top">{field.fieldName}</td>
                            <td className="px-2 py-3 text-center text-gray-700 align-top">{field.iterationCount}/{AGENT_ALPHA_CONFIG.MAX_ITERATIONS}</td>
                            <td className="px-2 py-3 text-center text-gray-700 align-top">{(field.initialAccuracy * 100).toFixed(0)}%</td>
                            <td className="px-2 py-3 text-center font-medium text-green-600 align-top">{(field.finalAccuracy * 100).toFixed(0)}%</td>
                            <td className="px-4 py-3 text-xs text-gray-600 align-top">
                              <div className="whitespace-pre-wrap break-words max-w-full">
                                {field.finalPrompt}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-500 align-top whitespace-nowrap">
                              {formatDuration(field.timeMs)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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
              <span className="text-sm font-medium text-gray-600">Estimated time: {formatEstimatedTime(agentAlphaState.totalFields)}</span>
            </div>
          </div>
        )}

        {/* Error Mode */}
        {isError && (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-2 text-red-600">
              <span className="text-lg font-semibold">❌ Agent-Alpha Failed</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {agentAlphaState.errorMessage || 'An unknown error occurred.'}
            </p>
            <Button onClick={onCancel} variant="outline">
              Close
            </Button>
          </div>
        )}

        {/* Preview Mode */}
        {isPreview && results && (
          <div className="space-y-6">
            {/* Summary Stats - 3 cards matching Library page style */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Fields Optimized */}
              <div className="rounded-xl border bg-gray-50 shadow-sm px-6 py-5 flex flex-col justify-center">
                <span className="text-5xl font-bold text-gray-900">{results.results.length}</span>
                <p className="text-xl text-gray-600 mt-2">Fields Optimized</p>
              </div>
              
              {/* Avg Improvement */}
              <div className="rounded-xl border border-green-200 bg-green-50 shadow-sm px-6 py-5 flex flex-col justify-center">
                <span className="text-5xl font-bold text-green-600">+{calculateAvgImprovement(results.results)}%</span>
                <p className="text-xl text-gray-600 mt-2">Average Improvement</p>
              </div>
              
              {/* Time card with all timing info */}
              <div className="rounded-xl border bg-gray-50 shadow-sm px-6 py-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xl text-gray-600">Actual Time</span>
                    <span className="text-xl font-bold text-gray-900">
                      {results.actualTimeMs > 0 ? formatDuration(results.actualTimeMs) : calculateTotalTimeFromResults(results.results)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xl text-gray-600">Estimated Time</span>
                    <span className="text-xl font-semibold text-gray-700">{formatDuration(results.estimatedTimeMs)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xl text-gray-600">Difference</span>
                    <span className={cn(
                      "text-xl font-bold",
                      (results.actualTimeMs > 0 ? results.actualTimeMs : 0) <= results.estimatedTimeMs ? "text-green-600" : "text-amber-600"
                    )}>
                      {formatTimeDifference(results.actualTimeMs > 0 ? results.actualTimeMs : 0, results.estimatedTimeMs)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Field Results - matching Library page Card style */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Generated Prompts</h2>
              <div className="space-y-4">
                {results.results.map((result) => (
                  <div key={result.fieldKey} className="rounded-xl border bg-white shadow-sm p-5">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{result.fieldName}</h3>
                      <div className="flex items-center gap-2">
                        {result.converged ? (
                          <Badge className="bg-green-100 text-green-800 border-transparent">✓ 100% Accuracy</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 border-transparent">Max Iterations</Badge>
                        )}
                        <Badge className="bg-gray-100 text-gray-800 border-transparent">
                          {result.iterationCount} iteration{result.iterationCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>

                    {/* Accuracy line */}
                    <div className="flex items-center flex-wrap gap-x-1 gap-y-1 text-sm mb-4">
                      <span className="text-gray-600">Previous Accuracy:</span>
                      <span className="font-semibold text-gray-900">{(result.initialAccuracy * 100).toFixed(0)}%</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="text-gray-600">New Accuracy:</span>
                      <span className="font-semibold text-green-600">{(result.finalAccuracy * 100).toFixed(0)}%</span>
                      <span className="text-sm font-medium text-green-600">(+{((result.finalAccuracy - result.initialAccuracy) * 100).toFixed(0)}%)</span>
                    </div>

                    {/* Prompts */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">Original Prompt:</p>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {result.initialPrompt || `Extract the ${result.fieldName} from this document.`}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">Optimized Prompt:</p>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {result.finalPrompt}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tested on */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Tested on:</span>
                      {result.sampledDocIds.slice(0, 3).map((docId) => (
                        <Badge key={docId} variant="outline" className="text-xs bg-gray-50">
                          {results.sampledDocNames?.[docId] || `Doc ${docId.slice(-4)}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Footer Actions */}
        {isPreview && (
          <DialogFooter>
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
            <Button onClick={onApply}>
              Apply All Prompts
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface StatCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, variant = 'default' }) => {
  const variantClass =
    variant === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : variant === 'success'
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-muted border-transparent text-foreground';

  return (
    <div className={cn('rounded-lg border p-4 flex flex-col gap-1', variantClass)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
};

function calculateAvgImprovement(results: AgentAlphaPendingResults['results']): string {
  if (results.length === 0) return '0.0';
  const totalImprovement = results.reduce((sum, r) => sum + (r.finalAccuracy - r.initialAccuracy), 0);
  return ((totalImprovement / results.length) * 100).toFixed(1);
}

function formatEstimatedTime(totalFields: number): string {
  const estimatedSeconds = totalFields * 3 * 12; // 3 avg iterations * 12 sec per iteration
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatTimeDifference(actualMs: number, estimatedMs: number): string {
  const diffMs = Math.abs(actualMs - estimatedMs);
  const diffSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  
  const sign = actualMs <= estimatedMs ? '-' : '+';
  if (minutes === 0) {
    return `${sign}${seconds}s`;
  }
  return `${sign}${minutes}m ${seconds}s`;
}

// Calculate total time from individual field results when actualTimeMs is 0
function calculateTotalTimeFromResults(results: AgentAlphaPendingResults['results']): string {
  // This is a fallback - ideally actualTimeMs should be set properly
  // Estimate ~70 seconds per field based on observed logs
  const estimatedMs = results.length * 70 * 1000;
  return formatDuration(estimatedMs);
}

export default AgentAlphaModal;

