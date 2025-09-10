
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { AccuracyField, PromptVersion } from '@/lib/types';
import { Save, History, Star, Play, Copy, Sparkles, Loader2, TrendingUp, TrendingDown, BarChart3, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { generateInitialPrompt, improvePrompt } from '@/ai/flows/generate-initial-prompt';
import { PromptPickerDialog } from '@/features/prompt-library/components/prompt-picker-dialog';

type PromptStudioSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  field: AccuracyField | null;
  templateName?: string | null;
  onUpdatePrompt: (fieldKey: string, newPrompt: string) => void;
  onUsePromptVersion: (fieldKey: string, promptVersion: PromptVersion) => void;
  onToggleFavorite?: (fieldKey: string, versionId: string) => void;
  selectedFileIds?: string[];
};

export default function PromptStudioSheet({
  isOpen,
  onClose,
  field,
  templateName,
  onUpdatePrompt,
  onUsePromptVersion,
  onToggleFavorite,
  selectedFileIds = [],
}: PromptStudioSheetProps) {
  const [activePromptText, setActivePromptText] = React.useState('');
  const [originalPromptText, setOriginalPromptText] = React.useState('');
  const [improvementInstructions, setImprovementInstructions] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (field) {
      setActivePromptText(field.prompt);
      setOriginalPromptText(field.prompt);
      setImprovementInstructions('');
    }
  }, [field]);

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

  // Determine button text and icon
  const getButtonContent = () => {
    if (isGenerating) {
      return {
        icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
        text: isImprovementMode ? "Improving..." : hasExistingPrompt ? "Improving..." : "Generating..."
      };
    }
    
    if (hasExistingPrompt) {
      return {
        icon: <Wand2 className="mr-2 h-4 w-4" />,
        text: "Improve Prompt"
      };
    } else {
      return {
        icon: <Sparkles className="mr-2 h-4 w-4" />,
        text: "Generate Prompt"
      };
    }
  };

  const buttonContent = getButtonContent();
  
  // Button is enabled when:
  // 1. Not generating AND has field name AND
  // 2. EITHER: no existing prompt (generate mode) OR (has existing prompt AND has improvement instructions)
  const canGenerate = !isGenerating && field && (
    !hasExistingPrompt || // Generate mode: no existing prompt
    (hasExistingPrompt && improvementInstructions.trim().length > 0) // Improve mode: has prompt AND instructions
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Prompt Studio - {field.name}
          </SheetTitle>
          <SheetDescription>
            Generate, edit, and improve extraction prompts for better AI accuracy. All changes are automatically 
            snapshotted when you save and re-run an analysis.
          </SheetDescription>
          
          {/* No Files Warning */}
          {selectedFileIds.length === 0 && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <span className="font-medium">⚠️ No context files:</span>
                <span>Prompt generation will work without document context. Select files for better results.</span>
              </div>
            </div>
          )}
        </SheetHeader>
        <div className="flex-1 flex flex-col min-h-0 p-6">
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-6">
                    <History className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Prompt Versions</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                    Active prompt and version history. Edit the active prompt or restore from previous versions.
                </p>
                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4 pb-4">
                            {/* Active Prompt Card */}
                            <Card className="border-2 border-primary bg-primary/5">
                                <CardHeader className="flex flex-row items-center justify-between pb-3">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-base font-medium flex items-center gap-2">
                                            Active Prompt
                                            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded font-normal">Current</span>
                                        </CardTitle>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleGeneratePrompt}
                                            disabled={!canGenerate}
                                        >
                                            {buttonContent.icon}
                                            {buttonContent.text}
                                        </Button>
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
                                        <div className="space-y-2">
                                          <Label htmlFor="improvement-instructions" className="text-sm font-medium">
                                            What do you need this prompt to do better?
                                          </Label>
                                          <Textarea
                                            id="improvement-instructions"
                                            value={improvementInstructions}
                                            onChange={(e) => setImprovementInstructions(e.target.value)}
                                            className="min-h-[60px] text-sm"
                                          />
                                        </div>
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
                                    <div key={version.id} className={`space-y-3 ${isLatestVersion ? 'bg-muted/20 p-4 rounded-lg' : 'p-4'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-base font-medium flex items-center gap-2">
                                                    Version {versionNumber}
                                                    {isLatestVersion && <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Latest</span>}
                                                    {isCurrentVersion && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Same as Active</span>}
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
                                        <div className="relative rounded-md border bg-muted/50 p-3">
                                            <p className="text-sm whitespace-pre-wrap break-words pr-8">{version.prompt}</p>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute top-2 right-2 h-7 w-7"
                                                onClick={() => handleCopyToClipboard(version.prompt)}
                                            >
                                                <Copy className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                        {version.metrics ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">Performance Metrics</span>
                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
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
                                                        <div className="space-y-3">
                                                            {topModels.map((model, index) => (
                                                                <div key={model.name} className="bg-background rounded-lg p-4 border shadow-sm">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                                            {model.displayName}
                                                                        </div>
                                                                        {index === 0 && (
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                                                                                    🏆 Best
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {index === 1 && (
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                                                                                    🥈 2nd Best
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="grid grid-cols-4 gap-4">
                                                                        <div className="text-center">
                                                                            <div className="text-xs text-muted-foreground mb-1">Accuracy</div>
                                                                            <div className={`font-bold text-lg ${model.metrics.accuracy >= 0.9 ? 'text-green-600' : model.metrics.accuracy >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                {(model.metrics.accuracy * 100).toFixed(0)}%
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-center">
                                                                            <div className="text-xs text-muted-foreground mb-1">Accuracy Score</div>
                                                                            <div className={`font-bold text-lg ${model.metrics.f1 >= 0.9 ? 'text-green-600' : model.metrics.f1 >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                {(model.metrics.f1 * 100).toFixed(0)}%
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-center">
                                                                            <div className="text-xs text-muted-foreground mb-1">Precision</div>
                                                                            <div className={`font-bold text-lg ${model.metrics.precision >= 0.9 ? 'text-green-600' : model.metrics.precision >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                {(model.metrics.precision * 100).toFixed(0)}%
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-center">
                                                                            <div className="text-xs text-muted-foreground mb-1">Recall</div>
                                                                            <div className={`font-bold text-lg ${model.metrics.recall >= 0.9 ? 'text-green-600' : model.metrics.recall >= 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                {(model.metrics.recall * 100).toFixed(0)}%
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            
                                                            {/* Show count of models tested */}
                                                            {sortedModels.length > 2 && (
                                                                <div className="text-xs text-muted-foreground text-center italic">
                                                                    Showing top 2 of {sortedModels.length} models tested
                                                                </div>
                                                            )}
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
                    </ScrollArea>
                </div>
            </div>
        </div>
        <SheetFooter className="px-6 py-4">
          <div className="flex gap-2 ml-auto">
            <SheetClose asChild>
              <Button>Close</Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

