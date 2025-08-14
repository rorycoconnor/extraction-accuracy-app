import React from 'react';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import ExtractionTable from '@/components/extraction-table';
import type { AccuracyData, AccuracyField, BoxFile, BoxTemplate } from '@/lib/types';

interface ComparisonResultsProps {
  accuracyData: AccuracyData;
  shownColumns: Record<string, boolean>;
  // Remove showMetrics prop - it will be computed automatically
  onOpenPromptStudio: (field: AccuracyField) => void;
  onOpenInlineEditor: (fileId: string, fieldKey: string) => void;
}

const ComparisonResults: React.FC<ComparisonResultsProps> = ({
  accuracyData,
  shownColumns,
  // Remove showMetrics prop
  onOpenPromptStudio,
  onOpenInlineEditor,
}) => {
  // Function to determine if metrics should be shown automatically
  const shouldShowMetrics = React.useMemo(() => {
    if (!accuracyData || !accuracyData.averages) return false;
    
    // Check if there are any computed averages for non-ground-truth models
    return Object.keys(accuracyData.averages).some(fieldKey => {
      const fieldAverages = accuracyData.averages[fieldKey];
      return Object.keys(fieldAverages).some(modelName => modelName !== 'Ground Truth');
    });
  }, [accuracyData]);

  const pathname = usePathname();
  const isHomePage = pathname === '/';

  // Conditional classes based on page
  const cardClassName = isHomePage 
    ? "bg-white dark:bg-gray-900 flex flex-col flex-1 min-h-0 rounded-none border-0"
    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex flex-col flex-1 min-h-0";
    
  const cardContentClassName = isHomePage
    ? "flex-1 min-h-0 overflow-hidden p-0 flex flex-col"
    : "p-0 flex-1 min-h-0 overflow-hidden";

  return (
    <div className="flex flex-col h-full">
      <Card className={cardClassName}>
        <CardHeader className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-gray-900 dark:text-gray-100">
                Model Comparison Analysis
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Select{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  Compare Models
                </span>{' '}
                to add &amp; remove models. You can also edit the{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  prompts
                </span>{' '}
                and{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  field averages are automatically shown when available.
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded"></div>
                <span>Different Format</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded"></div>
                <span>Partial match</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded"></div>
                <span>Mismatch</span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className={cardContentClassName}>
          <ExtractionTable
            data={accuracyData}
            onOpenPromptStudio={onOpenPromptStudio}
            onOpenInlineEditor={onOpenInlineEditor}
            shownColumns={shownColumns}
            showMetrics={shouldShowMetrics}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ComparisonResults; 