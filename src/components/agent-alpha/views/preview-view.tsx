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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Limited Validation</p>
            <p className="text-sm text-amber-700 mt-1">
              Only {trainCount} document{trainCount !== 1 ? 's' : ''} available. Holdout validation was skipped due to insufficient data.
              Results may not generalize well to other documents.
            </p>
          </div>
        </div>
      )}
      
      {hasInsufficientHoldout && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Limited Holdout Validation</p>
            <p className="text-sm text-amber-700 mt-1">
              Holdout set has only {holdoutCount} document{holdoutCount !== 1 ? 's' : ''} (trained on {trainCount}).
              For more reliable generalization, use at least 10 documents total.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats - 4 cards matching Library page style */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Fields Processed */}
        <div className="rounded-xl border bg-gray-50 shadow-sm px-6 py-5 flex flex-col justify-center">
          <span className="text-5xl font-bold text-gray-900">{results.results.length}</span>
          <p className="text-xl text-gray-600 mt-2">Fields Processed</p>
        </div>
        
        {/* Will Apply */}
        <div className="rounded-xl border border-green-200 bg-green-50 shadow-sm px-6 py-5 flex flex-col justify-center">
          <span className="text-5xl font-bold text-green-600">{improvedCount}</span>
          <p className="text-xl text-gray-600 mt-2">Will Apply</p>
        </div>
        
        {/* Will Skip */}
        {skippedCount > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm px-6 py-5 flex flex-col justify-center">
            <span className="text-5xl font-bold text-red-600">{skippedCount}</span>
            <p className="text-xl text-gray-600 mt-2">Will Skip</p>
          </div>
        )}
        
        {/* Avg Improvement - only for improved results */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 shadow-sm px-6 py-5 flex flex-col justify-center">
          <span className="text-5xl font-bold text-blue-600">+{calculateAvgImprovement(improvedResults)}%</span>
          <p className="text-xl text-gray-600 mt-2">Avg Improvement</p>
        </div>
      </section>

      {/* Supervised Fields (with Ground Truth) */}
      {supervisedResults.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            Optimized with Ground Truth
            <Badge className="bg-green-100 text-green-800 border-transparent text-xs">
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
                didImprove ? "bg-white" : "bg-gray-50 border-gray-300"
              )}>
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={cn(
                      "text-lg font-semibold",
                      didImprove ? "text-gray-900" : "text-gray-500"
                    )}>{result.fieldName}</h3>
                    {!didImprove && (
                      <Badge className="bg-red-100 text-red-800 border-transparent">⚠️ No Improvement - Will Skip</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {didImprove && result.converged ? (
                      <Badge className="bg-green-100 text-green-800 border-transparent">✓ 100% Accuracy</Badge>
                    ) : didImprove ? (
                      <Badge className="bg-yellow-100 text-yellow-800 border-transparent">Max Iterations</Badge>
                    ) : null}
                    <Badge className="bg-gray-100 text-gray-800 border-transparent">
                      {result.iterationCount} iteration{result.iterationCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                {/* Accuracy - separate lines */}
                <div className="space-y-1 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Previous Accuracy:</span>
                    <span className="font-semibold text-gray-900">{(result.initialAccuracy * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">New Accuracy:</span>
                    <span className={cn(
                      "font-semibold",
                      result.finalAccuracy > result.initialAccuracy ? "text-green-600" : 
                      result.finalAccuracy < result.initialAccuracy ? "text-red-600" : 
                      "text-gray-900"
                    )}>
                      {(result.finalAccuracy * 100).toFixed(0)}%
                    </span>
                    <span className={cn(
                      "text-sm font-medium",
                      result.finalAccuracy > result.initialAccuracy ? "text-green-600" : 
                      result.finalAccuracy < result.initialAccuracy ? "text-red-600" : 
                      "text-gray-900"
                    )}>
                      ({result.finalAccuracy > result.initialAccuracy ? '+' : ''}{((result.finalAccuracy - result.initialAccuracy) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>

                {/* Prompts */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Original Prompt:</p>
                    {result.userOriginalPrompt ? (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {result.userOriginalPrompt}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-500 italic">
                          No prompt was defined for this field. The agent created a new prompt from scratch.
                        </p>
                      </div>
                    )}
                  </div>
                  {didImprove ? (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Optimized Prompt:</p>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {result.finalPrompt}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Generated Prompt (not recommended):</p>
                      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 opacity-60">
                        <p className="text-sm text-gray-500 whitespace-pre-wrap">
                          {result.finalPrompt}
                        </p>
                        <p className="text-xs text-red-600 mt-2 italic">
                          This prompt performed worse than the original and will not be applied.
                        </p>
                      </div>
                    </div>
                  )}
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
              );
            })}
          </div>
        </section>
      )}

      {/* Unsupervised Fields (no Ground Truth) */}
      {unsupervisedResults.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
            Prompt Generated (No Ground Truth)
            <Badge className="bg-amber-100 text-amber-800 border-transparent text-xs">
              {unsupervisedResults.length} field{unsupervisedResults.length !== 1 ? 's' : ''}
            </Badge>
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            These fields have no ground truth data, so accuracy cannot be measured. The agent generated prompts based on best practices.
          </p>
          <div className="space-y-4">
            {unsupervisedResults.map((result) => (
              <div key={result.fieldKey} className="rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm p-5">
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{result.fieldName}</h3>
                    <Badge className="bg-amber-100 text-amber-800 border-transparent">
                      No Ground Truth
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-100 text-gray-800 border-transparent">
                      Prompt generated
                    </Badge>
                  </div>
                </div>

                {/* No accuracy metrics for unsupervised */}
                <div className="text-sm text-amber-700 bg-amber-100 rounded-lg p-3 mb-4">
                  <span className="font-medium">ℹ️ No accuracy metrics available.</span> Add ground truth data to measure and optimize this field&apos;s accuracy.
                </div>

                {/* Prompts */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Original Prompt:</p>
                    {result.userOriginalPrompt ? (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {result.userOriginalPrompt}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-500 italic">
                          No prompt was defined for this field. The agent created a new prompt from scratch.
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Generated Prompt:</p>
                    <div className="bg-white border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
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
