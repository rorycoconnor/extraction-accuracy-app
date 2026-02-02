'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { FileResult, PromptVersion } from '@/lib/types';
import { Save, History, Star, Sparkles, Loader2, Wand2, FlaskConical, Settings2, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { generateInitialPrompt, improvePrompt } from '@/ai/flows/generate-initial-prompt';
import { PromptPickerDialog } from '@/features/prompt-library/components/prompt-picker-dialog';
import { extractMetadataBatch, type BatchExtractionJob } from '@/ai/flows/batch-metadata-extraction';
import { compareValues } from '@/lib/metrics';
import { cn, findFieldValue } from '@/lib/utils';
import { SystemPromptPanel } from '@/components/system-prompt-panel';
import { getActiveSystemPrompt, type SystemPromptVersion } from '@/lib/system-prompt-storage';

// Import extracted components
import { FileSelectionPanel } from './panels/file-selection-panel';
import { TestResultsPanel } from './panels/test-results-panel';
import { VersionHistoryCard } from './components/version-history-card';
import { formatDateValue } from './utils';
import type { PromptStudioSheetProps, CategorizedFiles } from './types';

export default function PromptStudioSheet({
  isOpen,
  onClose,
  field,
  templateName,
  onUpdatePrompt,
  onUsePromptVersion,
  onToggleFavorite,
  onDeletePromptVersion,
  selectedFileIds = [],
  accuracyData,
  shownColumns = {},
}: PromptStudioSheetProps) {
  const [activePromptText, setActivePromptText] = React.useState('');
  const [originalPromptText, setOriginalPromptText] = React.useState('');
  const [improvementInstructions, setImprovementInstructions] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [currentGenerationMethod, setCurrentGenerationMethod] = React.useState<'standard' | 'dspy' | 'agent' | undefined>(undefined);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState<{
    isOpen: boolean;
    versionId: string;
    versionNumber: number;
  }>({ isOpen: false, versionId: '', versionNumber: 0 });
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResults, setTestResults] = React.useState<FileResult[] | null>(null);
  const [showTestResults, setShowTestResults] = React.useState(false);
  const [showFileSelection, setShowFileSelection] = React.useState(false);
  const [testProgress, setTestProgress] = React.useState({ current: 0, total: 0 });
  const [selectedTestFiles, setSelectedTestFiles] = React.useState<Set<string>>(new Set());
  const [showSystemPromptPanel, setShowSystemPromptPanel] = React.useState(false);
  const [activeSystemPrompt, setActiveSystemPrompt] = React.useState<SystemPromptVersion | null>(null);
  const { toast } = useToast();

  // Load active system prompt on mount
  React.useEffect(() => {
    const activePrompt = getActiveSystemPrompt();
    setActiveSystemPrompt(activePrompt);
  }, []);

  // Handle system prompt change from the panel
  const handleSystemPromptChange = React.useCallback((version: SystemPromptVersion) => {
    setActiveSystemPrompt(version);
  }, []);

  React.useEffect(() => {
    if (field) {
      setActivePromptText(field.prompt);
      setOriginalPromptText(field.prompt);
      setImprovementInstructions('');
      setCurrentGenerationMethod(undefined);
      // Reset test results when switching fields
      setShowTestResults(false);
      setShowFileSelection(false);
      setTestResults(null);
      setSelectedTestFiles(new Set());
      // Close system prompt panel when switching fields
      setShowSystemPromptPanel(false);
    }
  }, [field]);

  // Categorize and sort files by match quality
  const categorizedFiles: CategorizedFiles = React.useMemo(() => {
    if (!field || !accuracyData || !accuracyData.results) {
      return { mismatches: [], partialMatches: [], differentFormats: [], matches: [] };
    }

    const mismatches: FileResult[] = [];
    const partialMatches: FileResult[] = [];
    const differentFormats: FileResult[] = [];
    const matches: FileResult[] = [];

    // Get the models that were run (excluding Ground Truth and NO PROMPT models)
    const testedModels = Object.keys(shownColumns)
      .filter(model => shownColumns[model] && model !== 'Ground Truth' && !model.endsWith('_no_prompt'));

    accuracyData.results.forEach(fileResult => {
      const groundTruth = fileResult.fields[field.key]?.['Ground Truth'] || '';
      
      // Check results across all tested models
      let hasAnyMismatch = false;
      let hasAnyPartialMatch = false;
      let hasAnyDifferentFormat = false;
      let hasAnyMatch = false;

      testedModels.forEach(modelName => {
        const value = fileResult.fields[field.key]?.[modelName];
        
        // Skip if not tested yet
        if (!value || value === 'Pending...') return;

        const comparison = compareValues(value, groundTruth);
        
        if (!comparison.isMatch) {
          // Check if it's a "different-format" non-match
          if (comparison.matchClassification === 'different-format') {
            hasAnyDifferentFormat = true;
          } else {
            hasAnyMismatch = true;
          }
        } else {
          hasAnyMatch = true;
          // Use matchClassification for categorization
          if (comparison.matchClassification === 'partial') {
            hasAnyPartialMatch = true;
          } else if (comparison.matchClassification === 'different-format' || comparison.matchType === 'date_format') {
            hasAnyDifferentFormat = true;
          }
        }
      });

      // Categorize by worst result (prioritize problems)
      if (hasAnyMismatch) {
        mismatches.push(fileResult);
      } else if (hasAnyPartialMatch) {
        partialMatches.push(fileResult);
      } else if (hasAnyDifferentFormat) {
        differentFormats.push(fileResult);
      } else if (hasAnyMatch) {
        matches.push(fileResult);
      }
    });

    return { mismatches, partialMatches, differentFormats, matches };
  }, [field, accuracyData, shownColumns]);

  if (!field) {
    return null;
  }
  
  const handleSaveChanges = () => {
    onUpdatePrompt(field.key, activePromptText, currentGenerationMethod);
    // Update original text after saving to reset the "changed" state
    setOriginalPromptText(activePromptText);
    // Reset generation method after saving
    setCurrentGenerationMethod(undefined);
  };

  // Determine if we have existing prompt text
  const hasExistingPrompt = activePromptText && activePromptText.trim().length > 0;
  
  // Determine if we're in improvement mode
  const isImprovementMode = hasExistingPrompt && improvementInstructions.trim().length > 0;
  
  // Check if the prompt text has changed from the original
  const hasPromptChanged = activePromptText !== originalPromptText;

  const handleGeneratePrompt = async () => {
    if (!field) {
      toast({
        variant: "destructive",
        title: "Cannot Generate Prompt",
        description: "Missing field information."
      });
      return;
    }

    setIsGenerating(true);
    try {
      let result;
      
      // Get custom system prompts if not using default
      const customGeneratePrompt = activeSystemPrompt && !activeSystemPrompt.isDefault 
        ? activeSystemPrompt.generateInstructions 
        : undefined;
      const customImprovePrompt = activeSystemPrompt && !activeSystemPrompt.isDefault 
        ? activeSystemPrompt.improvePrompt 
        : undefined;
      
      if (isImprovementMode) {
        // Improve existing prompt
        logger.info('Improving prompt with feedback', { 
          improvementInstructions,
          usingCustomSystemPrompt: !!customImprovePrompt,
          systemPromptName: activeSystemPrompt?.name
        });
        result = await improvePrompt({
          originalPrompt: activePromptText,
          userFeedback: improvementInstructions,
          templateName: templateName || 'document',
          field: {
            name: field.name,
            key: field.key,
            type: field.type
          },
          fileIds: selectedFileIds,
          customSystemPrompt: customImprovePrompt
        });
        
        toast({
          title: "Prompt Improved",
          description: "Your prompt has been improved based on your feedback."
        });
        
        // Clear improvement instructions after successful improvement
        setImprovementInstructions('');
      } else {
        // Generate new prompt
        logger.info('Generating new prompt for field', { 
          fieldName: field.name,
          usingCustomSystemPrompt: !!customGeneratePrompt,
          systemPromptName: activeSystemPrompt?.name
        });
        result = await generateInitialPrompt({
          templateName: templateName || 'document',
          field: {
            name: field.name,
            key: field.key,
            type: field.type,
            options: field.options  // Include dropdown/enum options for better prompts
          },
          fileIds: selectedFileIds,
          customSystemPrompt: customGeneratePrompt
        });
        
        toast({
          title: "Prompt Generated",
          description: "A new prompt has been generated for you."
        });
      }
      
      // Replace the current prompt text with the new one
      logger.debug('Replacing prompt text', { promptLength: result.prompt.length, generationMethod: result.generationMethod });
      setActivePromptText(result.prompt);
      setCurrentGenerationMethod(result.generationMethod);
      
    } catch (error) {
      // Type guard for error handling
      const errorToLog = error instanceof Error ? error : undefined;
      logger.error('Failed to generate/improve prompt', errorToLog);
      
      // Handle specific Box API authentication errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('401 Unauthorized')) {
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "Box API authentication expired. Please check your settings and try again."
        });
      } else if (errorMessage.includes('400 Bad Request')) {
        toast({
          variant: "destructive", 
          title: "API Request Error",
          description: "There was an issue with the request format. Please try again."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Prompt Generation Failed",
          description: "Failed to generate/improve prompt. Please try again or check your connection."
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Prompt Copied', description: 'The prompt has been copied to your clipboard.' });
    } catch (error) {
      logger.error('Failed to copy to clipboard', error instanceof Error ? error : undefined);
      toast({ 
        variant: 'destructive',
        title: 'Copy Failed', 
        description: 'Unable to copy to clipboard. Please try selecting and copying manually.' 
      });
    }
  };

  const handleToggleFavorite = (versionId: string) => {
    if (onToggleFavorite && field) {
      onToggleFavorite(field.key, versionId);
    }
  };

  const handleDeletePromptVersion = (versionId: string, versionNumber: number) => {
    if (onDeletePromptVersion && field) {
      // Open confirmation dialog
      setDeleteConfirmation({
        isOpen: true,
        versionId,
        versionNumber
      });
    }
  };

  const handleConfirmDelete = () => {
    if (onDeletePromptVersion && field && deleteConfirmation.versionId) {
      onDeletePromptVersion(field.key, deleteConfirmation.versionId);
      toast({
        title: "Prompt Version Deleted",
        description: `Version ${deleteConfirmation.versionNumber} has been permanently deleted.`
      });
      
      // Close the dialog
      setDeleteConfirmation({ isOpen: false, versionId: '', versionNumber: 0 });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, versionId: '', versionNumber: 0 });
  };

  const handleOpenFileSelection = () => {
    if (!field || !accuracyData || !accuracyData.results || accuracyData.results.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Run Test",
        description: "No files available to test. Please run a comparison on the home page first."
      });
      return;
    }

    // Show file selection panel
    setShowFileSelection(true);
    setSelectedTestFiles(new Set()); // Reset selection
  };

  const handleRunTest = async () => {
    if (!field || !accuracyData || !accuracyData.results || accuracyData.results.length === 0) {
      return;
    }

    // Check if files are selected
    if (selectedTestFiles.size === 0) {
      toast({
        variant: "destructive",
        title: "No Files Selected",
        description: "Please select up to 3 files to test."
      });
      return;
    }

    // Get models that were run (from shownColumns) and filter out NO PROMPT models
    const modelsToTest = Object.keys(shownColumns)
      .filter(model => shownColumns[model] && model !== 'Ground Truth' && !model.endsWith('_no_prompt'));

    if (modelsToTest.length === 0) {
      toast({
        variant: "destructive",
        title: "No Models Selected",
        description: "Please select at least one model with a prompt on the home page."
      });
      return;
    }

    // Hide file selection and show test results
    setShowFileSelection(false);
    setShowTestResults(true);
    setIsTesting(true);
    
    // Filter to only selected files
    const filesToTest = accuracyData.results.filter(f => selectedTestFiles.has(f.id));
    const totalOperations = filesToTest.length * modelsToTest.length;
    setTestProgress({ current: 0, total: totalOperations });

    try {
      logger.info('Starting test', {
        promptLength: activePromptText.length,
        models: modelsToTest,
        fileCount: filesToTest.length
      });

      // Create a test field with the current prompt
      // For taxonomy fields: use multiSelect if options exist, otherwise string for free-text
      // Taxonomy options are stored separately in Box and may not be in the template
      const hasOptions = field.options && field.options.length > 0;
      let boxAIFieldType: 'string' | 'date' | 'enum' | 'multiSelect' | 'number' | 'float';
      
      if (field.type === 'dropdown_multi') {
        boxAIFieldType = 'multiSelect';
      } else if (field.type === 'taxonomy') {
        boxAIFieldType = hasOptions ? 'multiSelect' : 'string';
      } else {
        boxAIFieldType = field.type as 'string' | 'date' | 'enum' | 'multiSelect' | 'number' | 'float';
      }
      
      const testField = {
        key: field.key,
        type: boxAIFieldType,
        displayName: field.name,
        prompt: activePromptText,
        ...(hasOptions && { options: field.options })
      };

      // Initialize results with placeholders (only for selected files)
      const testResultsData: FileResult[] = filesToTest.map(fileResult => ({
        id: fileResult.id,
        fileName: fileResult.fileName,
        fileType: fileResult.fileType,
        fields: {
          [field.key]: {
            'Ground Truth': fileResult.fields[field.key]?.['Ground Truth'] || ''
          }
        }
      }));

      // Set initial empty table
      setTestResults([...testResultsData]);

      let currentOperation = 0;

      // Create extraction jobs only for selected files
      const extractionJobs: Array<{ fileIndex: number; fileId: string; modelName: string }> = [];
      for (let i = 0; i < filesToTest.length; i++) {
        const fileResult = filesToTest[i];
        for (const modelName of modelsToTest) {
          extractionJobs.push({
            fileIndex: i,
            fileId: fileResult.id,
            modelName: modelName
          });
        }
      }

      // Run extractions with concurrency limit
      const CONCURRENCY_LIMIT = 10;
      
      // Prepare all batch extraction jobs
      const batchJobs: BatchExtractionJob[] = extractionJobs.map((job) => ({
        jobId: `prompt-test-${job.fileIndex}-${job.modelName}`,
        fileId: job.fileId,
        fields: [testField],
        model: job.modelName,
        templateKey: undefined
      }));

      // Execute all extractions
      const startTime = Date.now();
      logger.info('Starting batch extractions', { jobCount: batchJobs.length, concurrencyLimit: CONCURRENCY_LIMIT });

      const batchResults = await extractMetadataBatch(batchJobs, CONCURRENCY_LIMIT);

      // Process results and update UI
      batchResults.forEach((batchResult, index) => {
        const job = extractionJobs[index];
        
        if (batchResult.success && batchResult.data) {
          // Store the extracted value using the same field matching logic as home page
          const extractedValue = findFieldValue(batchResult.data, field.key);
          let formattedValue = '';
          if (extractedValue !== undefined && extractedValue !== null && extractedValue !== '') {
            formattedValue = String(extractedValue).trim();
            // Format date values to remove timestamps
            formattedValue = formatDateValue(formattedValue);
          }
          testResultsData[job.fileIndex].fields[field.key][job.modelName] = formattedValue;
          
          logger.debug('Extraction completed', { 
            modelName: job.modelName, 
            fileIndex: job.fileIndex + 1, 
            duration: batchResult.duration ? (batchResult.duration / 1000).toFixed(1) : 'N/A'
          });
        } else {
          logger.error('Extraction failed', { 
            modelName: job.modelName, 
            fileIndex: job.fileIndex + 1, 
            error: batchResult.error,
            duration: batchResult.duration ? (batchResult.duration / 1000).toFixed(1) : 'N/A'
          });
          testResultsData[job.fileIndex].fields[field.key][job.modelName] = 'ERROR';
        }

        // Update progress incrementally
        currentOperation++;
        setTestProgress({ current: currentOperation, total: totalOperations });
        
        // Update table with results so far
        setTestResults([...testResultsData]);
      });
      
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info('All extractions completed', {
        totalDuration,
        averageDuration: (parseFloat(totalDuration) / extractionJobs.length).toFixed(1)
      });
      
      toast({
        title: "Test Complete",
        description: `Tested ${modelsToTest.length} model(s) on ${filesToTest.length} file(s).`
      });

    } catch (error) {
      // Type guard for error handling
      const errorToLog = error instanceof Error ? error : undefined;
      logger.error('Test failed', errorToLog);
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: "An error occurred while running the test. Please try again."
      });
    } finally {
      setIsTesting(false);
      setTestProgress({ current: 0, total: 0 });
    }
  };

  // Button is enabled when:
  // 1. Not generating AND has field name AND
  // 2. EITHER: no existing prompt (generate mode) OR (has existing prompt AND has improvement instructions)
  const canGenerate = !isGenerating && field && (
    !hasExistingPrompt || // Generate mode: no existing prompt
    (hasExistingPrompt && improvementInstructions.trim().length > 0) // Improve mode: has prompt AND instructions
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        className={cn(
          "!p-0 gap-0 flex flex-col transition-all duration-500 ease-in-out",
          (showTestResults || showFileSelection || showSystemPromptPanel) ? "!w-screen !max-w-none" : "!w-[50vw] !max-w-[50vw]"
        )}
        style={{ scrollbarGutter: 'stable' }}
      >
        {/* Fixed Header */}
        <div className="shrink-0 px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2 mb-1">
            <Wand2 className="h-5 w-5" />
            <span>Prompt Studio - {field.name}</span>
          </SheetTitle>
          
          {/* No Files Warning */}
          {selectedFileIds.length === 0 && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <span className="font-medium">⚠️ No context files:</span>
                <span>Prompt generation will work without document context. Select files for better results.</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Flexible Content Area */}
        <div className="flex-1 flex gap-8 px-6 py-4 overflow-hidden transition-all duration-500 ease-in-out" style={{ minHeight: 0, overflow: 'hidden' }}>
          {/* System Prompt Panel (shown when System Prompt button is clicked) */}
          {showSystemPromptPanel && (
            <div className="flex flex-col transition-all duration-500 ease-in-out border-r pr-8" style={{ flex: '0 0 50%', minWidth: 0, minHeight: 0 }}>
              <SystemPromptPanel
                isOpen={showSystemPromptPanel}
                onClose={() => setShowSystemPromptPanel(false)}
                onSystemPromptChange={handleSystemPromptChange}
              />
            </div>
          )}

          {/* File Selection Panel */}
          {showFileSelection && (
            <FileSelectionPanel
              categorizedFiles={categorizedFiles}
              accuracyData={accuracyData || null}
              selectedTestFiles={selectedTestFiles}
              setSelectedTestFiles={setSelectedTestFiles}
              onRunTest={handleRunTest}
              onClose={() => setShowFileSelection(false)}
            />
          )}

          {/* Test Results Panel */}
          {showTestResults && (
            <TestResultsPanel
              testResults={testResults}
              field={field}
              shownColumns={shownColumns}
              isTesting={isTesting}
              testProgress={testProgress}
              onClose={() => setShowTestResults(false)}
            />
          )}
          
          {/* Prompt Studio Panel */}
          <div className="flex flex-col transition-all duration-500 ease-in-out" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <div className="shrink-0 flex items-center justify-between mb-4 h-8 pr-2">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <h3 className="font-semibold">Prompt Versions</h3>
              </div>
              {/* System Prompt Button */}
              <Button
                variant={showSystemPromptPanel ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowSystemPromptPanel(!showSystemPromptPanel)}
                className="flex items-center gap-2"
                style={{ marginRight: '10px' }}
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">System Prompt:</span>
                <Badge 
                  variant={activeSystemPrompt?.isDefault ? "secondary" : "outline"} 
                  className={cn(
                    "text-xs",
                    !activeSystemPrompt?.isDefault && "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                  )}
                >
                  {activeSystemPrompt?.name || 'Default'}
                </Badge>
              </Button>
            </div>
            <div className="overflow-y-auto" style={{ flex: 1, minHeight: 0, scrollbarGutter: 'stable' }}>
              <div className="space-y-4 pb-4">
                {/* Active Prompt Card */}
                <Card className="border-2 border-primary bg-primary/5">
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        Active Prompt
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full font-normal">Current</span>
                      </CardTitle>
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                      <PromptPickerDialog
                        fieldName={field.name}
                        onSelectPrompt={(promptText) => setActivePromptText(promptText)}
                        triggerButtonContent={
                          <>
                            <Star className="h-4 w-4" />
                            Library
                          </>
                        }
                      />
                      {/* Only show Generate Prompt button when NOT in improvement mode */}
                      {!isImprovementMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGeneratePrompt}
                          disabled={!canGenerate}
                        >
                          {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          {isGenerating ? "Generating..." : "Generate Prompt"}
                        </Button>
                      )}
                      {activePromptText.trim() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenFileSelection}
                          disabled={isTesting || showFileSelection || showTestResults}
                        >
                          <FlaskConical className="mr-2 h-4 w-4" />
                          Test
                        </Button>
                      )}
                      <Button 
                        onClick={handleSaveChanges} 
                        size="sm"
                        variant={hasPromptChanged ? "default" : "outline"}
                        disabled={!hasPromptChanged}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save as New Version
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Textarea
                        value={activePromptText}
                        onChange={(e) => setActivePromptText(e.target.value)}
                        className="min-h-[120px] text-base pr-8"
                        placeholder="Enter your extraction prompt here..."
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={() => handleCopyToClipboard(activePromptText)}
                      >
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    
                    {/* Improvement Instructions Field - Show when there's existing prompt */}
                    {hasExistingPrompt && (
                      <div className="space-y-3 pt-3">
                        <div className="flex items-center justify-between h-[40px]">
                          <Label htmlFor="improvement-instructions" className="text-sm font-medium">
                            What do you need this prompt to do better?
                          </Label>
                          {/* Fixed height container to prevent any layout shift */}
                          <div className="flex items-center justify-end w-[140px] h-[40px]">
                            {improvementInstructions.trim().length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGeneratePrompt}
                                disabled={!canGenerate}
                              >
                                {isGenerating ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Wand2 className="mr-2 h-4 w-4" />
                                )}
                                {isGenerating ? "Improving..." : "Improve Prompt"}
                              </Button>
                            )}
                          </div>
                        </div>
                        <Textarea
                          id="improvement-instructions"
                          value={improvementInstructions}
                          onChange={(e) => setImprovementInstructions(e.target.value)}
                          className="min-h-[60px] text-sm"
                          placeholder="Describe what you want to improve about this prompt..."
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Version History Cards */}
                {field?.promptHistory && field.promptHistory.length > 0 ? (
                  field.promptHistory.map((version, index) => {
                    const isCurrentVersion = field.prompt === version.prompt;
                    const versionNumber = field.promptHistory!.length - index;
                    const isLatestVersion = index === 0;
                    
                    return (
                      <VersionHistoryCard
                        key={`${version.id}-${index}`}
                        version={version}
                        versionNumber={versionNumber}
                        isLatestVersion={isLatestVersion}
                        isCurrentVersion={isCurrentVersion}
                        field={field}
                        totalVersions={field.promptHistory!.length}
                        onToggleFavorite={onToggleFavorite ? handleToggleFavorite : undefined}
                        onDeleteVersion={handleDeletePromptVersion}
                        onUseVersion={(v: PromptVersion) => onUsePromptVersion(field.key, v)}
                        onCopyToClipboard={handleCopyToClipboard}
                      />
                    );
                  })
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>No version history available yet.</p>
                    <p className="text-xs mt-1">Save your first version to start tracking changes.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={handleCancelDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Version
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Version {deleteConfirmation.versionNumber}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
