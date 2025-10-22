
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { AccuracyField, PromptVersion, AccuracyData, FileResult } from '@/lib/types';
import { Save, History, Star, Play, Copy, Sparkles, Loader2, TrendingUp, TrendingDown, BarChart3, Wand2, Trash2, X, FlaskConical, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { generateInitialPrompt, improvePrompt } from '@/ai/flows/generate-initial-prompt';
import { PromptPickerDialog } from '@/features/prompt-library/components/prompt-picker-dialog';
import { extractMetadata } from '@/ai/flows/metadata-extraction';
import { compareValues } from '@/lib/metrics';
import { cn, findFieldValue, formatModelName } from '@/lib/utils';

type PromptStudioSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  field: AccuracyField | null;
  templateName?: string | null;
  onUpdatePrompt: (fieldKey: string, newPrompt: string) => void;
  onUsePromptVersion: (fieldKey: string, promptVersion: PromptVersion) => void;
  onToggleFavorite?: (fieldKey: string, versionId: string) => void;
  onDeletePromptVersion?: (fieldKey: string, versionId: string) => void;
  selectedFileIds?: string[];
  accuracyData?: AccuracyData | null;
  shownColumns?: Record<string, boolean>;
};

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
  const { toast } = useToast();

  React.useEffect(() => {
    if (field) {
      setActivePromptText(field.prompt);
      setOriginalPromptText(field.prompt);
      setImprovementInstructions('');
      // Reset test results when switching fields
      setShowTestResults(false);
      setShowFileSelection(false);
      setTestResults(null);
      setSelectedTestFiles(new Set());
    }
  }, [field]);

  // Categorize and sort files by match quality
  const categorizedFiles = React.useMemo(() => {
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
          hasAnyMismatch = true;
        } else {
          hasAnyMatch = true;
          if (comparison.matchType === 'partial') {
            hasAnyPartialMatch = true;
          } else if (comparison.matchType === 'date_format') {
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
      onUpdatePrompt(field.key, activePromptText);
      // Update original text after saving to reset the "changed" state
      setOriginalPromptText(activePromptText);
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
        
        if (isImprovementMode) {
          // Improve existing prompt
          console.log('🔧 Improving prompt with feedback:', improvementInstructions);
          result = await improvePrompt({
            originalPrompt: activePromptText,
            userFeedback: improvementInstructions,
            templateName: templateName || 'document',
            field: {
              name: field.name,
              key: field.key,
              type: field.type
            },
            fileIds: selectedFileIds
          });
          
          toast({
            title: "Prompt Improved",
            description: "Your prompt has been improved based on your feedback."
          });
          
          // Clear improvement instructions after successful improvement
          setImprovementInstructions('');
        } else {
          // Generate new prompt
          console.log('🔧 Generating new prompt for field:', field.name);
          result = await generateInitialPrompt({
            templateName: templateName || 'document',
            field: {
              name: field.name,
              key: field.key,
              type: field.type
            },
            fileIds: selectedFileIds
          });
          
          toast({
            title: "Prompt Generated",
            description: "A new prompt has been generated for you."
          });
        }
        
        // Replace the current prompt text with the new one
        console.log('🔧 Replacing prompt text:', result.prompt);
        setActivePromptText(result.prompt);
        
    } catch (error) {
        console.error("Failed to generate/improve prompt:", error);
        
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

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Prompt Copied', description: 'The prompt has been copied to your clipboard.' });
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

  // Helper function to format date values (remove timestamp from ISO dates)
  const formatDateValue = (value: string): string => {
    if (!value || typeof value !== 'string') return value;
    
    // Check if it's an ISO 8601 date with timestamp
    // Handles: "2025-04-04T00:00:00Z", "2025-04-04T00:00:00", "2026-03-26T00:00:00Z"
    const isoDatePattern = /^(\d{4}-\d{2}-\d{2})T[\d:.]+(Z)?$/;
    const match = value.match(isoDatePattern);
    
    if (match) {
      // Return just the date portion (YYYY-MM-DD)
      return match[1];
    }
    
    return value;
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
      console.log('🧪 Starting test with prompt:', activePromptText);
      console.log('🧪 Testing models:', modelsToTest);
      console.log('🧪 Testing files:', filesToTest.map(r => r.fileName));

      // Create a test field with the current prompt
      const testField = {
        ...field,
        prompt: activePromptText
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
      const extractionJobs = [];
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

      // Run extractions with concurrency limit (5 to avoid Box AI rate limiting)
      const CONCURRENCY_LIMIT = 5;
      
      const runExtraction = async (job: { fileIndex: number; fileId: string; modelName: string }) => {
        const startTime = Date.now();
        console.log(`🚀 Starting extraction: ${job.modelName} for file ${job.fileIndex + 1}`);
        
        try {
          const result = await extractMetadata({
            fileId: job.fileId,
            fields: [testField],
            model: job.modelName,
            templateKey: accuracyData.templateKey
          });

          // Store the extracted value using the same field matching logic as home page
          const extractedValue = findFieldValue(result.data, field.key);
          let formattedValue = '';
          if (extractedValue !== undefined && extractedValue !== null && extractedValue !== '') {
            formattedValue = String(extractedValue).trim();
            // Format date values to remove timestamps
            formattedValue = formatDateValue(formattedValue);
          }
          testResultsData[job.fileIndex].fields[field.key][job.modelName] = formattedValue;
          
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`✅ Completed: ${job.modelName} for file ${job.fileIndex + 1} in ${duration}s`);
        } catch (error) {
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          console.error(`❌ Failed: ${job.modelName} for file ${job.fileIndex + 1} after ${duration}s:`, error);
          testResultsData[job.fileIndex].fields[field.key][job.modelName] = 'ERROR';
        }

        // Update progress
        currentOperation++;
        setTestProgress({ current: currentOperation, total: totalOperations });
        
        // Update table with results so far
        setTestResults([...testResultsData]);
      };

      // Process jobs with concurrency limit using proper queue
      const startTime = Date.now();
      console.log(`🧪 Starting ${extractionJobs.length} extractions with concurrency limit of ${CONCURRENCY_LIMIT}`);

      const executeWithLimit = async () => {
        const executing: Set<Promise<void>> = new Set();
        
        for (const job of extractionJobs) {
          // Start the extraction
          const promise = runExtraction(job);
          executing.add(promise);
          
          // Remove from set when done
          promise.finally(() => executing.delete(promise));

          // If we've hit the limit, wait for one to finish
          if (executing.size >= CONCURRENCY_LIMIT) {
            await Promise.race(executing);
          }
        }

        // Wait for all remaining to finish
        await Promise.all(Array.from(executing));
      };

      await executeWithLimit();
      
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ All extractions completed in ${totalDuration}s`);
      console.log(`📊 Average: ${(parseFloat(totalDuration) / extractionJobs.length).toFixed(1)}s per extraction`);
      
      toast({
        title: "Test Complete",
        description: `Tested ${modelsToTest.length} model(s) on ${accuracyData.results.length} file(s).`
      });

    } catch (error) {
      console.error("Test failed:", error);
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
          (showTestResults || showFileSelection) ? "!w-screen !max-w-none" : "!w-[50vw] !max-w-[50vw]"
        )}
        style={{ 
          scrollbarGutter: 'stable'
        }}
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
        <div className="flex-1 flex gap-6 px-6 py-4 overflow-hidden transition-all duration-500 ease-in-out" style={{ minHeight: 0 }}>
          {/* File Selection Panel (shown when Test button is clicked) */}
          {showFileSelection && (
            <div className="flex flex-col transition-all duration-500 ease-in-out" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <div className="shrink-0 flex items-center justify-between mb-4 h-8">
                <div className="flex items-center gap-3">
                  <FlaskConical className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold">Select Files to Test</h3>
                  <span className="text-xs text-muted-foreground">
                    ({selectedTestFiles.size} / 3 selected)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowFileSelection(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
                <div className="overflow-auto flex-1 p-4" style={{ scrollbarGutter: 'stable' }}>
                  <div className="space-y-2">
              {/* Mismatches */}
              {categorizedFiles.mismatches.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1 px-2">
                    Mismatches ({categorizedFiles.mismatches.length})
                  </div>
                  {categorizedFiles.mismatches.map(file => {
                    const isSelected = selectedTestFiles.has(file.id);
                    const isDisabled = !isSelected && selectedTestFiles.size >= 3;
                    return (
                      <label
                        key={file.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors",
                          isSelected && "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800",
                          !isSelected && !isDisabled && "hover:bg-muted/50 border-border",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newSelected = new Set(selectedTestFiles);
                            if (e.target.checked) {
                              newSelected.add(file.id);
                            } else {
                              newSelected.delete(file.id);
                            }
                            setSelectedTestFiles(newSelected);
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm flex-1">{file.fileName}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Partial Matches */}
              {categorizedFiles.partialMatches.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 px-2">
                    Partial Matches ({categorizedFiles.partialMatches.length})
                  </div>
                  {categorizedFiles.partialMatches.map(file => {
                    const isSelected = selectedTestFiles.has(file.id);
                    const isDisabled = !isSelected && selectedTestFiles.size >= 3;
                    return (
                      <label
                        key={file.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors",
                          isSelected && "bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800",
                          !isSelected && !isDisabled && "hover:bg-muted/50 border-border",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newSelected = new Set(selectedTestFiles);
                            if (e.target.checked) {
                              newSelected.add(file.id);
                            } else {
                              newSelected.delete(file.id);
                            }
                            setSelectedTestFiles(newSelected);
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm flex-1">{file.fileName}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Different Formats */}
              {categorizedFiles.differentFormats.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1 px-2">
                    Different Formats ({categorizedFiles.differentFormats.length})
                  </div>
                  {categorizedFiles.differentFormats.map(file => {
                    const isSelected = selectedTestFiles.has(file.id);
                    const isDisabled = !isSelected && selectedTestFiles.size >= 3;
                    return (
                      <label
                        key={file.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors",
                          isSelected && "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800",
                          !isSelected && !isDisabled && "hover:bg-muted/50 border-border",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newSelected = new Set(selectedTestFiles);
                            if (e.target.checked) {
                              newSelected.add(file.id);
                            } else {
                              newSelected.delete(file.id);
                            }
                            setSelectedTestFiles(newSelected);
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm flex-1">{file.fileName}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Matches */}
              {categorizedFiles.matches.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1 px-2">
                    Matches ({categorizedFiles.matches.length})
                  </div>
                  {categorizedFiles.matches.map(file => {
                    const isSelected = selectedTestFiles.has(file.id);
                    const isDisabled = !isSelected && selectedTestFiles.size >= 3;
                    return (
                      <label
                        key={file.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors",
                          isSelected && "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800",
                          !isSelected && !isDisabled && "hover:bg-muted/50 border-border",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newSelected = new Set(selectedTestFiles);
                            if (e.target.checked) {
                              newSelected.add(file.id);
                            } else {
                              newSelected.delete(file.id);
                            }
                            setSelectedTestFiles(newSelected);
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm flex-1">{file.fileName}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Show all files if no comparison was run */}
              {categorizedFiles.mismatches.length === 0 && 
               categorizedFiles.partialMatches.length === 0 && 
               categorizedFiles.differentFormats.length === 0 && 
               categorizedFiles.matches.length === 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1 px-2">
                    All Files ({accuracyData.results.length})
                  </div>
                  {accuracyData.results.map(file => {
                    const isSelected = selectedTestFiles.has(file.id);
                    const isDisabled = !isSelected && selectedTestFiles.size >= 3;
                    return (
                      <label
                        key={file.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors",
                          isSelected && "bg-primary/10 border-primary",
                          !isSelected && !isDisabled && "hover:bg-muted/50 border-border",
                          isDisabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newSelected = new Set(selectedTestFiles);
                            if (e.target.checked) {
                              newSelected.add(file.id);
                            } else {
                              newSelected.delete(file.id);
                            }
                            setSelectedTestFiles(newSelected);
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm flex-1">{file.fileName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
                  </div>
                </div>
                {/* Run Test Button */}
                <div className="shrink-0 p-4 border-t bg-muted/20">
                  <Button
                    onClick={handleRunTest}
                    disabled={selectedTestFiles.size === 0}
                    className="w-full"
                  >
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Run Test ({selectedTestFiles.size} file{selectedTestFiles.size !== 1 ? 's' : ''})
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Test Results Panel */}
          {showTestResults && (
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
                  onClick={() => setShowTestResults(false)}
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
                          {Object.keys(shownColumns)
                            .filter(model => shownColumns[model] && model !== 'Ground Truth' && !model.endsWith('_no_prompt'))
                            .map(modelName => (
                              <th key={modelName} className="border-b border-r px-4 py-3 text-center text-sm font-semibold">
                                {formatModelName(modelName)}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.map((fileResult) => {
                          const groundTruth = fileResult.fields[field!.key]?.['Ground Truth'] || '';
                          return (
                            <tr key={fileResult.id} className="hover:bg-muted/20">
                              <td className="border-b border-r px-4 py-3 text-sm sticky left-0 bg-background z-10">
                                {fileResult.fileName}
                              </td>
                              <td className="border-b border-r px-4 py-3 text-sm text-center">
                                {groundTruth || '-'}
                              </td>
                              {Object.keys(shownColumns)
                                .filter(model => shownColumns[model] && model !== 'Ground Truth' && !model.endsWith('_no_prompt'))
                                .map(modelName => {
                                  const value = fileResult.fields[field!.key]?.[modelName] || '';
                                  const comparison = compareValues(value, groundTruth);
                                  const isError = value === 'ERROR';
                                  
                                  let bgClass = '';
                                  if (isError) {
                                    bgClass = 'bg-red-100/80 dark:bg-red-900/55';
                                  } else if (groundTruth && value) {
                                    if (comparison.isMatch) {
                                      switch (comparison.matchType) {
                                        case 'exact':
                                        case 'normalized':
                                          bgClass = 'bg-green-100/80 dark:bg-green-900/55';
                                          break;
                                        case 'partial':
                                          bgClass = 'bg-blue-100/80 dark:bg-blue-900/55';
                                          break;
                                        case 'date_format':
                                          bgClass = 'bg-yellow-100/80 dark:bg-yellow-900/55';
                                          break;
                                      }
                                    } else {
                                      bgClass = 'bg-red-100/80 dark:bg-red-900/55';
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
          )}
          
          {/* Prompt Studio Panel */}
          <div className="flex flex-col transition-all duration-500 ease-in-out" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <div className="shrink-0 flex items-center gap-2 mb-4 h-8">
                    <History className="h-5 w-5" />
              <h3 className="font-semibold">Prompt Versions</h3>
                </div>
            <div className="overflow-y-auto pr-2" style={{ flex: 1, minHeight: 0, scrollbarGutter: 'stable' }}>
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
                                    // Calculate performance comparison based on average F1 across all models
                                    const versionsWithMetrics = field.promptHistory.filter(v => v.metrics);
                                    const isCurrentVersion = field.prompt === version.prompt;
                                    let performanceIndicator = null;
                                    
                                    if (version.metrics && versionsWithMetrics.length > 1) {
                                        const modelMetrics = version.metrics.modelMetrics;
                                        const currentF1 = modelMetrics ? 
                                            Object.values(modelMetrics).reduce((sum, m) => sum + m.f1, 0) / Object.values(modelMetrics).length : 0;
                                        
                                        const otherVersions = versionsWithMetrics.filter(v => v.id !== version.id);
                                        const otherF1s = otherVersions.map(v => {
                                            const metrics = v.metrics!.modelMetrics;
                                            return metrics ? Object.values(metrics).reduce((sum, m) => sum + m.f1, 0) / Object.values(metrics).length : 0;
                                        });
                                        const avgOtherF1 = otherF1s.reduce((sum, f1) => sum + f1, 0) / otherF1s.length;
                                        
                                        if (currentF1 > avgOtherF1 + 0.05) { // 5% improvement threshold
                                            performanceIndicator = <TrendingUp className="h-4 w-4 text-green-600" />;
                                        } else if (currentF1 < avgOtherF1 - 0.05) { // 5% degradation threshold
                                            performanceIndicator = <TrendingDown className="h-4 w-4 text-red-600" />;
                                        }
                                    }
                                    
                                    // Show versions in chronological order (newest first)
                                    const versionNumber = field.promptHistory.length - index;
                                    const isLatestVersion = index === 0;
                                    
                                    return (
                      <div key={`${version.id}-${index}`} className={`space-y-3 ${isLatestVersion ? 'bg-muted/20 p-4 rounded-lg' : 'p-4'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-base font-medium flex items-center gap-2">
                                                    Version {versionNumber}
                                                    {isLatestVersion && <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">Latest</span>}
                                                    {isCurrentVersion && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Same as Active</span>}
                                                </h4>
                                                {performanceIndicator}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8"
                                                    onClick={() => handleToggleFavorite(version.id)}
                                                    disabled={!onToggleFavorite}
                                                >
                                                    <Star className={`h-4 w-4 ${version.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeletePromptVersion(version.id, versionNumber)}
                                                    disabled={!onDeletePromptVersion || field.promptHistory.length <= 1}
                                                    title={field.promptHistory.length <= 1 ? "Cannot delete the last remaining prompt version" : "Delete this prompt version"}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => onUsePromptVersion(field.key, version)}
                                                    disabled={isCurrentVersion}
                                                >
                                                    <Play className="mr-2 h-4 w-4" />
                                                    {isCurrentVersion ? 'In Use' : 'Use this Version'}
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Saved on: {format(new Date(version.savedAt), 'P p')}</p>
                        <div className="relative rounded-md border bg-muted/50 p-4">
                          {version.prompt && version.prompt.trim() ? (
                            <>
                              <p className="text-sm whitespace-pre-wrap break-words pr-10">{version.prompt}</p>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                className="absolute top-3 right-3 h-8 w-8"
                                                onClick={() => handleCopyToClipboard(version.prompt)}
                                title="Copy prompt"
                                            >
                                                <Copy className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No prompt</p>
                          )}
                                        </div>
                                        {version.metrics ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">Performance Metrics</span>
                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                                        Updated {format(new Date(version.metrics.lastRunAt), 'MMM d, h:mm a')}
                                                    </span>
                                                </div>
                                                
                                                {/* Top 2 models performance */}
                                                {version.metrics.modelMetrics && (() => {
                                                    // Calculate average Accuracy for each model to determine ranking
                                                    const modelEntries = Object.entries(version.metrics.modelMetrics);
                                                    if (modelEntries.length === 0) return null;
                                    
                                                    // Sort models by Accuracy (best first)
                                                    const sortedModels = modelEntries
                                                        .map(([modelName, metrics]) => ({
                                                            name: modelName,
                                                            metrics,
                                                            displayName: modelName
                                                                .replace('openai-', '')
                                                                .replace('anthropic-', '')
                                                                .replace('google-', '')
                                                                .replace('GOOGLE_', '')
                                                                .replace('ENHANCED_', '')
                                                                .replace(/_/g, ' ')
                                                                .replace(/\b\w/g, l => l.toUpperCase())
                                                        }))
                                                        .sort((a, b) => b.metrics.accuracy - a.metrics.accuracy);
                                    
                                                    // Show top 2 models
                                                    const topModels = sortedModels.slice(0, 2);
                                    
                                                    return (
                                <div className="space-y-2">
                                                            {topModels.map((model, index) => (
                                    <div key={model.name} className="flex items-center justify-between py-2 px-3 border rounded-lg bg-card">
                                      <span className="text-sm font-medium text-foreground uppercase tracking-wide">
                                                                            {model.displayName}
                                                                                </span>
                                      <div className={`font-semibold text-base ${model.metrics.accuracy >= 0.9 ? 'text-green-600 dark:text-green-400' : model.metrics.accuracy >= 0.7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                                {(model.metrics.accuracy * 100).toFixed(0)}%
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground italic">
                                                No performance data available yet. Run a comparison to see metrics.
                                            </div>
                                        )}
                                     </div>
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

