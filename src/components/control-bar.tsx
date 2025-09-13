import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuCheckboxItem, 
  DropdownMenuTrigger, 
  DropdownMenuLabel, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { 
  Play, 
  Loader2, 
  Eye, 
  EyeOff, 
  Trash2, 
  AlertTriangle, 
  Settings, 
  FileText, 
  Columns3,
  Copy,
  Download,
  MoreHorizontal
} from 'lucide-react';
import { formatModelName } from '@/lib/utils';
import type { AccuracyData } from '@/lib/types';
import { AVAILABLE_MODELS } from '@/lib/main-page-constants';

interface ControlBarProps {
  accuracyData: AccuracyData | null;
  isExtracting: boolean;
  progress: { processed: number; total: number };
  shownColumns: Record<string, boolean>;
  // Remove showMetrics prop - it will be computed automatically
  onSelectDocuments: () => void;
  onRunComparison: () => void;
  onAutoPopulateGroundTruth: () => void;
  // Remove onToggleMetrics prop - no longer needed
  onOpenSummary: () => void;
  onClearResults: () => void;
  onResetData: () => void;
  onColumnToggle: (modelName: string, checked: boolean) => void;
  onDownloadResults: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  accuracyData,
  isExtracting,
  progress,
  shownColumns,
  // Remove showMetrics prop - it will be computed automatically
  onSelectDocuments,
  onRunComparison,
  onAutoPopulateGroundTruth,
  // Remove onToggleMetrics prop - no longer needed
  onOpenSummary,
  onClearResults,
  onResetData,
  onColumnToggle,
  onDownloadResults,
}) => {
  // Get available model names for the dropdown
  const availableModels = React.useMemo(() => {
    // If no accuracy data, return all available models from constants
    if (!accuracyData?.results?.[0]?.fields) {
      return AVAILABLE_MODELS.sort();
    }
    
    const firstResultField = accuracyData.results[0].fields[accuracyData.fields[0]?.key];
    if (!firstResultField) {
      return AVAILABLE_MODELS.sort();
    }
    
    return Object.keys(firstResultField)
      .filter(key => key !== 'Ground Truth')
      .sort();
  }, [accuracyData]);

  return (
    <div className="flex items-center gap-2 px-6 py-4 mb-2">
      <Button onClick={onSelectDocuments} variant="outline" className="bg-gray-700 text-white hover:bg-gray-600 hover:text-white border-gray-700">
        <FileText className="mr-2 h-4 w-4" />
        Select Documents
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Columns3 className="mr-2 h-4 w-4" />
            Compare Models
            <Badge variant="secondary" className="ml-2">
              {Object.entries(shownColumns).filter(([key, value]) => value && key !== 'Ground Truth').length}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 max-w-none">
          <DropdownMenuLabel>Visible Models</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            key="Ground Truth"
            checked={shownColumns['Ground Truth']}
            onCheckedChange={(checked) => onColumnToggle('Ground Truth', !!checked)}
            onSelect={(event) => event.preventDefault()}
            className="whitespace-nowrap"
          >
            {formatModelName('Ground Truth')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {availableModels.map(modelName => (
            <DropdownMenuCheckboxItem
              key={modelName}
              checked={shownColumns[modelName]}
              onCheckedChange={(checked) => onColumnToggle(modelName, !!checked)}
              onSelect={(event) => event.preventDefault()}
              className="whitespace-nowrap"
            >
              {formatModelName(modelName)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Button 
        onClick={onRunComparison} 
        disabled={isExtracting || !accuracyData}
        className={accuracyData?.results?.length > 0 ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
        variant={accuracyData?.results?.length > 0 ? "default" : "outline"}
      >
        {isExtracting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        {isExtracting && progress.total > 0 
          ? `Processing ${progress.processed}/${progress.total} extractions` 
          : 'Run Comparison'}
      </Button>
      
      <Button variant="outline" onClick={onClearResults}>
        <Trash2 className="mr-2 h-4 w-4" />
        Clear Results
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="px-3"
            disabled={isExtracting}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={onAutoPopulateGroundTruth}
            disabled={!accuracyData || !accuracyData.results || accuracyData.results.length === 0}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Ground Truth
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={onDownloadResults}
            disabled={!accuracyData || !accuracyData.results || accuracyData.results.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      
      <div className="ml-auto mr-12 flex items-center gap-2">
        <div className="hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <AlertTriangle className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Danger Zone</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive hidden"
                onClick={onResetData}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Reset All Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default ControlBar; 