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
import { CheckCircle2, XCircle, AlertCircle, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface ComparisonResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparisonResult: ComparisonMetadata | null;
  predictedValue: string;
  groundTruthValue: string;
  fieldName: string;
  modelName: string;
}

// Helper to get extraction confidence level and styling
function getExtractionConfidenceInfo(score: number | undefined) {
  if (score === undefined) {
    return {
      level: 'unknown' as const,
      label: 'Unknown',
      description: 'Confidence score not available',
      percentage: null,
      colors: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600',
      icon: AlertCircle,
      alertLevel: 'none' as const
    };
  }
  
  const percentage = Math.round(score * 100);
  
  if (score >= 0.8) {
    return {
      level: 'high' as const,
      label: 'High Confidence',
      description: 'The AI model is confident about this extraction',
      percentage,
      colors: 'bg-green-100 text-green-800 dark:bg-green-900/55 dark:text-green-100 border-green-300 dark:border-green-700',
      icon: ShieldCheck,
      alertLevel: 'none' as const
    };
  } else if (score >= 0.5) {
    return {
      level: 'medium' as const,
      label: 'Medium Confidence',
      description: 'The AI model has some uncertainty about this extraction',
      percentage,
      colors: 'bg-amber-100 text-amber-800 dark:bg-amber-900/55 dark:text-amber-100 border-amber-300 dark:border-amber-700',
      icon: AlertTriangle,
      alertLevel: 'warning' as const
    };
  } else {
    return {
      level: 'low' as const,
      label: 'Low Confidence',
      description: 'The AI model is uncertain about this extraction - review recommended',
      percentage,
      colors: 'bg-red-100 text-red-800 dark:bg-red-900/55 dark:text-red-100 border-red-300 dark:border-red-700',
      icon: ShieldAlert,
      alertLevel: 'critical' as const
    };
  }
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

  const getMatchTypeBadge = () => {
    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/55 dark:text-blue-100">
        {comparisonResult.matchType}
      </Badge>
    );
  };

  const confidenceInfo = getExtractionConfidenceInfo(comparisonResult.extractionConfidence);
  const ConfidenceIcon = confidenceInfo.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getMatchIcon()}
            {fieldName}
          </DialogTitle>
          <DialogDescription>
            Detailed comparison using <strong>{modelName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Match Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Match:</span>
            <span className={comparisonResult.isMatch ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
              {comparisonResult.isMatch ? 'Yes' : 'No'}
            </span>
            {getMatchTypeBadge()}
          </div>

          {/* Extraction Confidence Score */}
          <div className={`border rounded-lg p-4 ${confidenceInfo.colors}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ConfidenceIcon className="h-5 w-5" />
                <div>
                  <div className="font-semibold">
                    {confidenceInfo.percentage !== null 
                      ? `${confidenceInfo.percentage}% - ${confidenceInfo.label}`
                      : confidenceInfo.label
                    }
                  </div>
                  <div className="text-xs opacity-80">{confidenceInfo.description}</div>
                </div>
              </div>
              {confidenceInfo.percentage !== null && (
                <div className="text-2xl font-bold">
                  {confidenceInfo.percentage}%
                </div>
              )}
            </div>
            {/* Progress bar for visual representation */}
            {confidenceInfo.percentage !== null && (
              <div className="mt-3 h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    confidenceInfo.level === 'high' ? 'bg-green-500' :
                    confidenceInfo.level === 'medium' ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${confidenceInfo.percentage}%` }}
                />
              </div>
            )}
          </div>

          {/* Low confidence warning */}
          {confidenceInfo.alertLevel === 'critical' && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <strong>Low confidence extraction.</strong> The AI model was uncertain when extracting this value. 
                Please verify this result manually.
              </div>
            </div>
          )}

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
