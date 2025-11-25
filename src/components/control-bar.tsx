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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  FileImage,
  Wand2,
  RotateCcw,
  Sparkles
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
  isOptimizerRunning?: boolean;
  optimizerProgressLabel?: string | null;
  shownColumns: Record<string, boolean>;
  // Remove showMetrics prop - it will be computed automatically
  onSelectDocuments: () => void;
  onRunComparison: () => void;
  onRunOptimizer: () => void;
  onAutoPopulateGroundTruth: () => void;
  // Remove onToggleMetrics prop - no longer needed
  onOpenSummary: () => void;
  onClearResults: () => void;
  onResetData: () => void;
  onResetPrompts: () => void;
  onColumnToggle: (modelName: string, checked: boolean) => void;
  onDownloadResults: () => void;
  // Agent-Alpha props
  isAgentAlphaRunning?: boolean;
  selectedAgentAlphaModel?: string | null;
  onRunAgentAlpha?: () => void;
  onSelectAgentAlphaModel?: (model: string) => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  accuracyData,
  isExtracting,
  isJudging = false,
  progress,
  isOptimizerRunning = false,
  optimizerProgressLabel,
  shownColumns,
  // Remove showMetrics prop - it will be computed automatically
  onSelectDocuments,
  onRunComparison,
  onRunOptimizer,
  onAutoPopulateGroundTruth,
  // Remove onToggleMetrics prop - no longer needed
  onOpenSummary,
  onClearResults,
  onResetData,
  onResetPrompts,
  onColumnToggle,
  onDownloadResults,
  // Agent-Alpha props
  isAgentAlphaRunning = false,
  selectedAgentAlphaModel,
  onRunAgentAlpha,
  onSelectAgentAlphaModel,
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
  
  // DSPy Alpha confirmation dialog state
  const [showDSpyConfirmDialog, setShowDSpyConfirmDialog] = useState(false);
  
  // Agent-Alpha confirmation dialog state
  const [showAgentAlphaDialog, setShowAgentAlphaDialog] = useState(false);

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

  const optimizerButtonLabel = (() => {
    if (isOptimizerRunning && optimizerProgressLabel) {
      return optimizerProgressLabel;
    }
    if (isOptimizerRunning) {
      return 'Optimizing…';
    }
    return 'DSPy Alpha';
  })();

  // Check if comparison has been run (actual model extraction results exist, not just "Pending...")
  // When documents are selected, results exist but field values are "Pending..."
  // After comparison runs, field values contain actual extracted data from models
  const hasComparisonResults = React.useMemo(() => {
    if (!accuracyData?.results || accuracyData.results.length === 0) return false;
    
    // Check if any field has actual model results (not just Ground Truth and not "Pending...")
    return accuracyData.results.some(result => {
      if (!result.fields) return false;
      
      return Object.values(result.fields).some(fieldData => {
        // fieldData is Record<modelName, extractedValue>
        // Check if any model (excluding Ground Truth) has a non-pending value
        return Object.entries(fieldData).some(([modelName, value]) => {
          if (modelName === 'Ground Truth') return false;
          // Check if value exists and is not "Pending..."
          return value && typeof value === 'string' && !value.includes('Pending');
        });
      });
    });
  }, [accuracyData]);

  const optimizerDisabled =
    isOptimizerRunning || isExtracting || isJudging || !accuracyData || !hasComparisonResults;

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
        <Button
          onClick={() => setShowDSpyConfirmDialog(true)}
          disabled={optimizerDisabled}
          variant="outline"
        >
          {isOptimizerRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <AlertTriangle className="mr-2 h-4 w-4" />
          )}
          {optimizerButtonLabel}
        </Button>

        {/* Agent Model Selection Dropdown */}
        {onSelectAgentAlphaModel && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isAgentAlphaRunning || isExtracting || !hasComparisonResults}>
                {selectedAgentAlphaModel ? formatModelName(selectedAgentAlphaModel) : 'Select Agent Model'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
              <DropdownMenuLabel>Model for Agent</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableModels.map((model) => (
                <DropdownMenuItem
                  key={model}
                  onClick={() => onSelectAgentAlphaModel(model)}
                  className={selectedAgentAlphaModel === model ? 'bg-accent' : ''}
                >
                  {formatModelName(model)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Run Agent Button */}
        {onRunAgentAlpha && (
          <Button
            onClick={() => setShowAgentAlphaDialog(true)}
            disabled={!accuracyData || isExtracting || isAgentAlphaRunning || !selectedAgentAlphaModel || !hasComparisonResults}
            variant="outline"
          >
            {isAgentAlphaRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isAgentAlphaRunning ? 'Processing...' : 'Run Agent'}
          </Button>
        )}

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

      {/* DSPy Alpha Confirmation Dialog */}
      <AlertDialog open={showDSpyConfirmDialog} onOpenChange={setShowDSpyConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              DSPy Alpha - Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Warning: This feature is a work in progress. Selecting this button will add versions to all targeted fields automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDSpyConfirmDialog(false);
                onRunOptimizer();
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Agent Confirmation Dialog */}
      {onRunAgentAlpha && (
        <AlertDialog open={showAgentAlphaDialog} onOpenChange={setShowAgentAlphaDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Agent Confirmation
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-base space-y-2">
                  <p>Agent will iteratively test and refine prompts for failing fields.</p>
                  <p>This process:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Tests extractions on up to 3 documents</li>
                    <li>Analyzes failures and generates improved prompts</li>
                    <li>Repeats up to 5 times per field until 100% accuracy</li>
                    <li>Uses <strong>{selectedAgentAlphaModel ? formatModelName(selectedAgentAlphaModel) : 'selected model'}</strong> for testing</li>
                  </ul>
                  <p className="font-medium">Prompts will be shown in a preview modal for your approval before saving.</p>
                  <p className="text-sm text-muted-foreground">
                    Estimated time: 3-5 minutes for typical runs.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowAgentAlphaDialog(false);
                  onRunAgentAlpha();
                }}
              >
                Start Agent
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default ControlBar; 
