'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateAvgImprovement } from '../utils';
import type { PreviewViewProps } from '../types';

export const PreviewView: React.FC<PreviewViewProps> = ({ results }) => {
  const holdoutCount = results.holdoutDocIds?.length ?? 0;
  const trainCount = results.trainDocIds?.length ?? results.sampledDocIds.length;
  const hasInsufficientHoldout = holdoutCount < 3 && holdoutCount > 0;
  const hasNoHoldout = holdoutCount === 0;

  const improvedCount = results.results.filter(r => r.improved !== false).length;
  const skippedCount = results.results.filter(r => r.improved === false).length;
  const improvedResults = results.results.filter(r => r.improved !== false);

  // Group fields by supervised (with ground truth) vs unsupervised (no ground truth)
  const supervisedResults = results.results.filter(r => r.hasGroundTruth !== false);
  const unsupervisedResults = results.results.filter(r => r.hasGroundTruth === false);

  return (
    <div className="space-y-6">
      {/* Insufficient Holdout Warning */}
      {hasNoHoldout && trainCount < 3 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Limited Validation</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Only {trainCount} document{trainCount !== 1 ? 's' : ''} available. Holdout validation was skipped due to insufficient data.
              Results may not generalize well to other documents.
            </p>
          </div>
        </div>
      )}
      
      {hasInsufficientHoldout && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Limited Holdout Validation</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Holdout set has only {holdoutCount} document{holdoutCount !== 1 ? 's' : ''} (trained on {trainCount}).
              For more reliable generalization, use at least 10 documents total.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats - 4 cards matching Library page style */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Fields Processed */}
        <div className="rounded-xl border bg-gray-50 dark:bg-muted shadow-sm px-6 py-5 flex flex-col justify-center">
          <span className="text-5xl font-bold text-gray-900 dark:text-foreground">{results.results.length}</span>
          <p className="text-xl text-gray-600 dark:text-muted-foreground mt-2">Fields Processed</p>
        </div>
        
        {/* Will Apply */}
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 shadow-sm px-6 py-5 flex flex-col justify-center">
          <span className="text-5xl font-bold text-green-600 dark:text-green-400">{improvedCount}</span>
          <p className="text-xl text-gray-600 dark:text-muted-foreground mt-2">Will Apply</p>
        </div>
        
        {/* Will Skip */}
        {skippedCount > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 shadow-sm px-6 py-5 flex flex-col justify-center">
            <span className="text-5xl font-bold text-red-600 dark:text-red-400">{skippedCount}</span>
            <p className="text-xl text-gray-600 dark:text-muted-foreground mt-2">Will Skip</p>
          </div>
        )}
        
        {/* Avg Improvement - only for improved results */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 shadow-sm px-6 py-5 flex flex-col justify-center">
          <span className="text-5xl font-bold text-blue-600 dark:text-blue-400">+{calculateAvgImprovement(improvedResults)}%</span>
          <p className="text-xl text-gray-600 dark:text-muted-foreground mt-2">Avg Improvement</p>
        </div>
      </section>

      {/* Supervised Fields (with Ground Truth) */}
      {supervisedResults.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4 flex items-center gap-2">
            Optimized with Ground Truth
            <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-transparent text-xs">
              {supervisedResults.length} field{supervisedResults.length !== 1 ? 's' : ''}
            </Badge>
          </h2>
          <div className="space-y-4">
            {supervisedResults.map((result) => {
              // Check if prompt improved
              const didImprove = result.improved ?? (result.finalAccuracy >= result.initialAccuracy);
              
              return (
              <div key={result.fieldKey} className={cn(
                "rounded-xl border shadow-sm p-5",
                didImprove ? "bg-white dark:bg-card" : "bg-gray-50 dark:bg-muted border-gray-300 dark:border-border"
              )}>
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={cn(
                      "text-lg font-semibold",
                      didImprove ? "text-gray-900 dark:text-foreground" : "text-gray-500 dark:text-muted-foreground"
                    )}>{result.fieldName}</h3>
                    {!didImprove && (
                      <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-transparent">⚠️ No Improvement - Will Skip</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {didImprove && result.converged ? (
                      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-transparent">✓ 100% Accuracy</Badge>
                    ) : didImprove ? (
                      <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-transparent">Max Iterations</Badge>
                    ) : null}
                    <Badge className="bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground border-transparent">
                      {result.iterationCount} iteration{result.iterationCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                {/* Accuracy - separate lines */}
                <div className="space-y-1 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-muted-foreground">Previous Accuracy:</span>
                    <span className="font-semibold text-gray-900 dark:text-foreground">{(result.initialAccuracy * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-muted-foreground">New Accuracy:</span>
                    <span className={cn(
                      "font-semibold",
                      result.finalAccuracy > result.initialAccuracy ? "text-green-600 dark:text-green-400" : 
                      result.finalAccuracy < result.initialAccuracy ? "text-red-600 dark:text-red-400" : 
                      "text-gray-900 dark:text-foreground"
                    )}>
                      {(result.finalAccuracy * 100).toFixed(0)}%
                    </span>
                    <span className="ml-3 text-gray-900 dark:text-foreground">Percent Change</span>
                    <span className={cn(
                      "text-sm font-medium",
                      result.finalAccuracy > result.initialAccuracy ? "text-green-600 dark:text-green-400" : 
                      result.finalAccuracy < result.initialAccuracy ? "text-red-600 dark:text-red-400" : 
                      "text-gray-900 dark:text-foreground"
                    )}>
                      ({result.finalAccuracy > result.initialAccuracy ? '+' : ''}{((result.finalAccuracy - result.initialAccuracy) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>

                {/* Prompts */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground mb-2">Original Prompt:</p>
                    {result.userOriginalPrompt ? (
                      <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg p-4">
                        <p className="text-sm text-gray-700 dark:text-foreground whitespace-pre-wrap">
                          {result.userOriginalPrompt}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-muted-foreground italic">
                          No prompt was defined for this field. The agent created a new prompt from scratch.
                        </p>
                      </div>
                    )}
                  </div>
                  {didImprove ? (
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground mb-2">Optimized Prompt:</p>
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <p className="text-sm text-gray-700 dark:text-foreground whitespace-pre-wrap">
                          {result.finalPrompt}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground mb-2">Generated Prompt (not recommended):</p>
                      <div className="bg-gray-100 dark:bg-muted border border-gray-300 dark:border-border rounded-lg p-4 opacity-60">
                        <p className="text-sm text-gray-500 dark:text-muted-foreground whitespace-pre-wrap">
                          {result.finalPrompt}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 italic">
                          This prompt performed worse than the original and will not be applied.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tested on */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-border/50">
                  <span className="text-sm text-gray-500 dark:text-muted-foreground">Tested on:</span>
                  {result.sampledDocIds.slice(0, 3).map((docId) => (
                    <Badge key={docId} variant="outline" className="text-xs bg-gray-50 dark:bg-transparent">
                      {results.sampledDocNames?.[docId] || `Doc ${docId.slice(-4)}`}
                    </Badge>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Unsupervised Fields (no Ground Truth) */}
      {unsupervisedResults.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-2 flex items-center gap-2">
            Prompt Generated (No Ground Truth)
            <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-transparent text-xs">
              {unsupervisedResults.length} field{unsupervisedResults.length !== 1 ? 's' : ''}
            </Badge>
          </h2>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mb-4">
            These fields have no ground truth data, so accuracy cannot be measured. The agent generated prompts based on best practices.
          </p>
          <div className="space-y-4">
            {unsupervisedResults.map((result) => (
              <div key={result.fieldKey} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm p-5">
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">{result.fieldName}</h3>
                    <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-transparent">
                      No Ground Truth
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground border-transparent">
                      Prompt generated
                    </Badge>
                  </div>
                </div>

                {/* No accuracy metrics for unsupervised */}
                <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 mb-4">
                  <span className="font-medium">ℹ️ No accuracy metrics available.</span> Add ground truth data to measure and optimize this field&apos;s accuracy.
                </div>

                {/* Prompts */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground mb-2">Original Prompt:</p>
                    {result.userOriginalPrompt ? (
                      <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg p-4">
                        <p className="text-sm text-gray-700 dark:text-foreground whitespace-pre-wrap">
                          {result.userOriginalPrompt}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-muted-foreground italic">
                          No prompt was defined for this field. The agent created a new prompt from scratch.
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground mb-2">Generated Prompt:</p>
                    <div className="bg-white dark:bg-card border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      <p className="text-sm text-gray-700 dark:text-foreground whitespace-pre-wrap">
                        {result.finalPrompt}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
