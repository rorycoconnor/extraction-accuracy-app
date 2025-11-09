import React, { useMemo, useState } from 'react';
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
  MoreHorizontal,
  Crown,
  FileImage
} from 'lucide-react';
import { formatModelName } from '@/lib/utils';
import type { AccuracyData } from '@/lib/types';
import { AVAILABLE_MODELS, isPremiumModel, isMultiModalModel } from '@/lib/main-page-constants';
import { ModelIcon, ModelPill } from '@/components/model-pill';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ControlBarProps {
  accuracyData: AccuracyData | null;
  isExtracting: boolean;
  isJudging?: boolean;
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
  isJudging = false,
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

  // Filter state for pills
  const [premiumFilter, setPremiumFilter] = useState<'all' | 'premium' | 'standard'>('all');
  const [showMultiModalOnly, setShowMultiModalOnly] = useState(false);

  // Filter available models based on pill selections
  const filteredModels = useMemo(() => {
    let filtered = availableModels;
    
    if (premiumFilter === 'premium') {
      filtered = filtered.filter(model => isPremiumModel(model));
    } else if (premiumFilter === 'standard') {
      filtered = filtered.filter(model => !isPremiumModel(model));
    }
    
    if (showMultiModalOnly) {
      filtered = filtered.filter(model => isMultiModalModel(model));
    }
    
    return filtered;
  }, [availableModels, premiumFilter, showMultiModalOnly]);

  const handlePremiumClick = () => {
    if (premiumFilter === 'all') {
      setPremiumFilter('premium');
    } else if (premiumFilter === 'premium') {
      setPremiumFilter('standard');
    } else {
      setPremiumFilter('all');
    }
  };

  const handleMultiModalClick = () => {
    setShowMultiModalOnly(!showMultiModalOnly);
  };

  const comparisonButtonLabel = (() => {
    if (isJudging) {
      return 'Comparing...';
    }
    if (isExtracting && progress.total > 0) {
      return `Processing ${progress.processed}/${progress.total} extractions`;
    }
    if (isExtracting) {
      return 'Processing extractions...';
    }
    return 'Run Comparison';
  })();

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
        <DropdownMenuContent align="start" className="w-96 max-w-none max-h-[80vh] overflow-y-auto">
          <DropdownMenuLabel className="flex items-center gap-2 sticky top-0 bg-background z-10 border-b">
            <span>Visible Models</span>
            <div className="flex gap-1">
              <button
                onClick={handlePremiumClick}
                className={`flex items-center gap-1 text-xs px-1.5 py-0.5 border rounded-full transition-all cursor-pointer ${
                  premiumFilter === 'all'
                    ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-150'
                    : premiumFilter === 'premium'
                    ? 'bg-amber-200 text-amber-900 border-amber-300 font-bold'
                    : 'bg-green-200 text-green-900 border-green-300 font-bold'
                }`}
              >
                <Crown className="h-3 w-3" />
                {premiumFilter === 'all' ? 'Premium' : premiumFilter === 'premium' ? 'Premium Only' : 'Standard Only'}
              </button>
              <button
                onClick={handleMultiModalClick}
                className={`flex items-center gap-1 text-xs px-1.5 py-0.5 border rounded-full transition-all cursor-pointer ${
                  showMultiModalOnly 
                    ? 'bg-blue-200 text-blue-900 border-blue-300 font-bold' 
                    : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-150'
                }`}
              >
                <FileImage className="h-3 w-3" />
                Multimodal
              </button>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            key="Ground Truth"
            checked={shownColumns['Ground Truth']}
            onCheckedChange={(checked) => onColumnToggle('Ground Truth', !!checked)}
            onSelect={(event) => event.preventDefault()}
            className="whitespace-nowrap py-1.5"
          >
            {formatModelName('Ground Truth')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {filteredModels.map(modelName => (
            <DropdownMenuCheckboxItem
              key={modelName}
              checked={shownColumns[modelName]}
              onCheckedChange={(checked) => onColumnToggle(modelName, !!checked)}
              onSelect={(event) => event.preventDefault()}
              className="whitespace-nowrap py-1.5"
            >
              <div className="flex items-center gap-2 w-full">
                <span>{formatModelName(modelName)}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <ModelIcon modelId={modelName} size="sm" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        {isPremiumModel(modelName) && <div>👑 Premium Model</div>}
                        {isMultiModalModel(modelName) && <div>📄 Multimodal Model</div>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Button 
        onClick={onRunComparison} 
        disabled={isExtracting || !accuracyData}
        className={accuracyData?.results && accuracyData.results.length > 0 ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
        variant={accuracyData?.results && accuracyData.results.length > 0 ? "default" : "outline"}
      >
        {isExtracting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        {comparisonButtonLabel}
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
