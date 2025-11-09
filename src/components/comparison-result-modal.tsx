'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { ComparisonMetadata } from '@/lib/types';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ComparisonResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparisonResult: ComparisonMetadata | null;
  predictedValue: string;
  groundTruthValue: string;
  fieldName: string;
  modelName: string;
}

export function ComparisonResultModal({
  isOpen,
  onClose,
  comparisonResult,
  predictedValue,
  groundTruthValue,
  fieldName,
  modelName
}: ComparisonResultModalProps) {
  if (!comparisonResult) return null;

  const getMatchIcon = () => {
    if (comparisonResult.isMatch) {
      return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
    }
    return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
  };

  const getConfidenceBadge = () => {
    const colors = {
      high: 'bg-green-100 text-green-800 dark:bg-green-900/55 dark:text-green-100',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/55 dark:text-yellow-100',
      low: 'bg-red-100 text-red-800 dark:bg-red-900/55 dark:text-red-100'
    };

    return (
      <Badge variant="outline" className={colors[comparisonResult.confidence]}>
        {comparisonResult.confidence} confidence
      </Badge>
    );
  };

  const getMatchTypeBadge = () => {
    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/55 dark:text-blue-100">
        {comparisonResult.matchType}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getMatchIcon()}
            Comparison Result
          </DialogTitle>
          <DialogDescription>
            Detailed comparison for <strong>{fieldName}</strong> using <strong>{modelName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Match Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Match:</span>
            <span className={comparisonResult.isMatch ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
              {comparisonResult.isMatch ? 'Yes' : 'No'}
            </span>
            {getConfidenceBadge()}
            {getMatchTypeBadge()}
          </div>

          {/* Values */}
          <div className="grid grid-cols-1 gap-3 border rounded-lg p-4 bg-muted/30">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Ground Truth</div>
              <div className="text-sm font-mono bg-background p-2 rounded border">
                {groundTruthValue}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Predicted Value</div>
              <div className="text-sm font-mono bg-background p-2 rounded border">
                {predictedValue}
              </div>
            </div>
          </div>

          {/* LLM Reasoning (if available) */}
          {comparisonResult.details && (
            <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/30">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {comparisonResult.matchType === 'llm-judge' ? '🤖 LLM Judge Reasoning' : 'Details'}
                </div>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                {comparisonResult.details}
              </p>
            </div>
          )}

          {/* Error (if any) */}
          {comparisonResult.error && (
            <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50/50 dark:bg-red-950/30">
              <div className="flex items-start gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="text-sm font-medium text-red-900 dark:text-red-100">
                  Error
                </div>
              </div>
              <p className="text-sm text-red-800 dark:text-red-200">
                {comparisonResult.error}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
