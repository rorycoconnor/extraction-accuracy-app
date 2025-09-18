import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
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
  onOpenSummary?: () => void;
  onToggleFieldMetrics?: (fieldKey: string, include: boolean) => void;
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
  extractingFields = new Set(),
  onOpenSummary,
  onToggleFieldMetrics
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

  // Determine if we should show the Summary button
  const shouldShowSummaryButton = React.useMemo(() => {
    if (!accuracyData || !onOpenSummary) return false;
    
    // Check if there's ground truth data
    const hasGroundTruth = accuracyData.results.some(result => 
      Object.values(result.fields).some(fieldData => 
        fieldData['Ground Truth'] && fieldData['Ground Truth'].trim() !== ''
      )
    );
    
    // Check if comparison has been run (there are model results)
    const hasComparisonResults = accuracyData.results.some(result =>
      Object.values(result.fields).some(fieldData =>
        Object.keys(fieldData).some(modelName => 
          modelName !== 'Ground Truth' && 
          fieldData[modelName] && 
          fieldData[modelName].trim() !== '' &&
          !fieldData[modelName].startsWith('Pending') &&
          !fieldData[modelName].startsWith('Error:')
        )
      )
    );
    
    return hasGroundTruth && hasComparisonResults;
  }, [accuracyData, onOpenSummary]);

  return (
    <div className="flex flex-col h-full">
      {/* Header area with fixed height to prevent table movement */}
      <div className="px-4 md:px-8 flex justify-between h-[72px] py-3">
        <div className="flex items-start h-full">
          {!shouldShowSummaryButton && (
            <div className="flex flex-col justify-start h-full">
              <h2 className="text-lg font-semibold text-foreground mb-1">Model Comparison Analysis</h2>
              <p className="text-sm text-muted-foreground">
                Select <strong>Compare Models</strong> to add & remove models. You can also edit the <strong>prompts</strong>.
              </p>
            </div>
          )}
          
          {/* Show Summary button positioned at top left when conditions are met */}
          {shouldShowSummaryButton && (
            <div className="flex items-start justify-start h-full pt-1">
              <Button variant="outline" onClick={onOpenSummary}>
                <Eye className="mr-2 h-4 w-4" />
                Show Summary
              </Button>
            </div>
          )}
        </div>
        
        {/* Legend for comparison results - restored to center alignment */}
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
          onToggleFieldMetrics={onToggleFieldMetrics}
        />
      </div>
    </div>
  );
} 