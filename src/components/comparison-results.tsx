import React from 'react';
import TanStackExtractionTable from './tanstack-extraction-table';
import type { AccuracyData, AccuracyField } from '@/lib/types';

interface ComparisonResultsProps {
  accuracyData: AccuracyData;
  shownColumns: Record<string, boolean>;
  showMetrics?: boolean;
  onOpenPromptStudio: (field: AccuracyField) => void;
  onOpenInlineEditor?: (fileId: string, fieldKey: string) => void;
  onRunSingleField?: (field: AccuracyField) => void;
  onRunSingleFieldForFile?: (field: AccuracyField, fileId: string) => void;
  recentlyChangedPrompts?: Set<string>;
  isExtracting?: boolean;
  extractingFields?: Set<string>;
}

export default function ComparisonResults({
  accuracyData,
  shownColumns,
  showMetrics = false,
  onOpenPromptStudio,
  onOpenInlineEditor,
  onRunSingleField,
  onRunSingleFieldForFile,
  recentlyChangedPrompts = new Set(),
  isExtracting = false,
  extractingFields = new Set()
}: ComparisonResultsProps) {
  // Auto-determine showMetrics like the original implementation
  const shouldShowMetrics = React.useMemo(() => {
    if (!accuracyData || !accuracyData.averages) return false;
    
    // Check if there are any computed averages for non-ground-truth models
    return Object.keys(accuracyData.averages).some(fieldKey => {
      const fieldAverages = accuracyData.averages[fieldKey];
      return Object.keys(fieldAverages).some(modelName => modelName !== 'Ground Truth');
    });
  }, [accuracyData]);

  return (
    <div className="flex flex-col h-full">
      {/* Header text with inline legend */}
      <div className="px-4 md:px-8 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Model Comparison Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Select <strong>Compare Models</strong> to add & remove models. You can also edit the <strong>prompts</strong>.
          </p>
        </div>
        
        {/* Legend for comparison results - moved 0.5 inch left */}
        <div className="flex items-center gap-4 text-xs mr-9">
          <span className="font-medium text-muted-foreground">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded-sm"></div>
            <span className="text-muted-foreground">Match</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded-sm"></div>
            <span className="text-muted-foreground">Different Format</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded-sm"></div>
            <span className="text-muted-foreground">Partial Match</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-100 border border-red-200 rounded-sm"></div>
            <span className="text-muted-foreground">Mismatch</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <TanStackExtractionTable
          data={accuracyData}
          shownColumns={shownColumns}
          showMetrics={shouldShowMetrics}
          onOpenPromptStudio={onOpenPromptStudio}
          onOpenInlineEditor={onOpenInlineEditor}
          onRunSingleField={onRunSingleField}
          onRunSingleFieldForFile={onRunSingleFieldForFile}
          recentlyChangedPrompts={recentlyChangedPrompts}
          isExtracting={isExtracting}
          extractingFields={extractingFields}
        />
      </div>
    </div>
  );
} 