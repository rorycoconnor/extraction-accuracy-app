'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X } from 'lucide-react';
import { cn, formatModelName } from '@/lib/utils';
import { compareValues } from '@/lib/metrics';
import type { TestResultsPanelProps } from '../types';

export const TestResultsPanel: React.FC<TestResultsPanelProps> = ({
  testResults,
  field,
  shownColumns,
  isTesting,
  testProgress,
  onClose,
}) => {
  const models = Object.keys(shownColumns)
    .filter(model => shownColumns[model] && model !== 'Ground Truth' && !model.endsWith('_no_prompt'));

  return (
    <div className="flex flex-col transition-all duration-500 ease-in-out" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      <div className="shrink-0 flex items-center justify-between mb-4 h-8">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold">Test Results</h3>
          {isTesting && testProgress.total > 0 && (
            <span className="text-sm text-muted-foreground">
              ({testProgress.current} / {testProgress.total})
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          disabled={isTesting}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1" style={{ scrollbarGutter: 'stable' }}>
          {testResults && testResults.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border-b border-r px-4 py-3 text-left text-sm font-semibold sticky left-0 bg-muted/50 z-10">
                    File Name
                  </th>
                  <th className="border-b border-r px-4 py-3 text-center text-sm font-semibold">
                    Ground Truth
                  </th>
                  {models.map(modelName => (
                    <th key={modelName} className="border-b border-r px-4 py-3 text-center text-sm font-semibold">
                      {formatModelName(modelName)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testResults.map((fileResult) => {
                  const groundTruth = fileResult.fields[field.key]?.['Ground Truth'] || '';
                  return (
                    <tr key={fileResult.id} className="hover:bg-muted/20">
                      <td className="border-b border-r px-4 py-3 text-sm sticky left-0 bg-background z-10">
                        {fileResult.fileName}
                      </td>
                      <td className="border-b border-r px-4 py-3 text-sm text-center">
                        {groundTruth || '-'}
                      </td>
                      {models.map(modelName => {
                        const value = fileResult.fields[field.key]?.[modelName] || '';
                        const comparison = compareValues(value, groundTruth);
                        const isError = value === 'ERROR';
                        
                        let bgClass = '';
                        if (isError) {
                          bgClass = 'bg-red-100/80 dark:bg-red-900/55';
                        } else if (groundTruth && value) {
                          if (comparison.isMatch) {
                            // Use matchClassification if available, fall back to matchType
                            const classification = (comparison as any).matchClassification as string | undefined;
                            const matchType = comparison.matchType as string;
                            const effectiveClassification = classification || matchType;
                            
                            // Green for exact/normalized matches
                            if (['exact', 'normalized'].includes(effectiveClassification)) {
                              bgClass = 'bg-green-100/80 dark:bg-green-900/55';
                            } else if (effectiveClassification === 'partial') {
                              bgClass = 'bg-blue-100/80 dark:bg-blue-900/55';
                            } else if (effectiveClassification === 'different-format' || matchType === 'date_format') {
                              bgClass = 'bg-yellow-100/80 dark:bg-yellow-900/55';
                            } else if (['exact-string', 'near-exact-string', 'exact-number', 'boolean', 'date-exact', 'llm-judge', 'list-unordered', 'list-ordered'].includes(matchType)) {
                              // Default to green for compare engine types
                              bgClass = 'bg-green-100/80 dark:bg-green-900/55';
                            }
                          } else {
                            // Check for different-format non-matches
                            const classification = (comparison as any).matchClassification;
                            if (classification === 'different-format') {
                              bgClass = 'bg-yellow-100/80 dark:bg-yellow-900/55';
                            } else {
                              bgClass = 'bg-red-100/80 dark:bg-red-900/55';
                            }
                          }
                        }
                        
                        return (
                          <td key={modelName} className={cn("border-b border-r px-4 py-3 text-sm text-center", bgClass)}>
                            {value || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {isTesting ? "Running test..." : "No test results yet"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
