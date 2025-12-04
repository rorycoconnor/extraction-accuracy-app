'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, Sparkles, Settings2, Info, ChevronDown, ChevronUp, FileCode, RotateCcw, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatModelName } from '@/lib/utils';
import type { AgentAlphaState, AgentAlphaPendingResults } from '@/lib/agent-alpha-types';
import type { AgentAlphaRuntimeConfig } from '@/lib/agent-alpha-config';
import { AGENT_ALPHA_CONFIG, DEFAULT_AGENT_SYSTEM_PROMPT, DEFAULT_PROMPT_GENERATION_INSTRUCTIONS, getDefaultRuntimeConfig } from '@/lib/agent-alpha-config';
import { AVAILABLE_MODELS } from '@/lib/main-page-constants';

interface AgentAlphaModalProps {
  isOpen: boolean;
  agentAlphaState: AgentAlphaState;
  results: AgentAlphaPendingResults | null;
  availableModels?: string[];
  defaultModel?: string; // Model from last comparison run
  onApply: () => void;
  onCancel: () => void;
  onStartWithConfig?: (config: AgentAlphaRuntimeConfig) => void;
}

export const AgentAlphaModal: React.FC<AgentAlphaModalProps> = ({
  isOpen,
  agentAlphaState,
  results,
  availableModels = AVAILABLE_MODELS,
  defaultModel,
  onApply,
  onCancel,
  onStartWithConfig,
}) => {
  const isConfigure = agentAlphaState.status === 'configure';
  const isRunning = agentAlphaState.status === 'running';
  const isPreview = agentAlphaState.status === 'preview';
  const isError = agentAlphaState.status === 'error';

  // Configuration state
  const [config, setConfig] = useState<AgentAlphaRuntimeConfig>(getDefaultRuntimeConfig());
  const [showInstructionsEditor, setShowInstructionsEditor] = useState(false);
  const [editedInstructions, setEditedInstructions] = useState(DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
  const [hasModifiedInstructions, setHasModifiedInstructions] = useState(false);
  
  // Reset config when modal opens in configure mode
  useEffect(() => {
    if (isConfigure) {
      const defaultConfig = getDefaultRuntimeConfig();
      // Use the model from last comparison if available
      if (defaultModel) {
        defaultConfig.testModel = defaultModel;
      }
      setConfig(defaultConfig);
      setShowInstructionsEditor(false);
      setEditedInstructions(DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
      setHasModifiedInstructions(false);
    }
  }, [isConfigure, defaultModel]);

  // Update config when instructions are modified
  useEffect(() => {
    if (hasModifiedInstructions) {
      setConfig(prev => ({ ...prev, customInstructions: editedInstructions }));
    } else {
      setConfig(prev => ({ ...prev, customInstructions: undefined }));
    }
  }, [editedInstructions, hasModifiedInstructions]);

  const handleInstructionsChange = (value: string) => {
    setEditedInstructions(value);
    setHasModifiedInstructions(value !== DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
  };

  const handleResetInstructions = () => {
    setEditedInstructions(DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
    setHasModifiedInstructions(false);
  };

  const progressPercentage = agentAlphaState.totalFields > 0
    ? (agentAlphaState.fieldsProcessed / agentAlphaState.totalFields) * 100
    : 0;

  const handleStartAgent = () => {
    if (onStartWithConfig) {
      onStartWithConfig(config);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto transition-all duration-300",
        isConfigure && showInstructionsEditor ? "max-w-[95vw] w-[95vw]" : 
        isConfigure ? "max-w-4xl w-full" : 
        "max-w-[95vw] w-[95vw]"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            {isConfigure && 'Configure & Start Agent'}
            {isRunning && 'Agent Prompt Optimization'}
            {isPreview && 'Agent Prompt Optimization Results'}
            {isError && 'Agent Error'}
          </DialogTitle>
        </DialogHeader>

        {/* Configure Mode */}
        {isConfigure && (
          <div className={cn(
            "py-2",
            showInstructionsEditor ? "flex gap-6" : ""
          )}>
            {/* Left Column - Configuration Options */}
            <div className={cn(
              "space-y-6",
              showInstructionsEditor ? "w-[35%] flex-shrink-0" : "w-full"
            )}>
              {/* Configuration Options */}
              <div className="space-y-5">
                {/* Model Selection */}
                <div className="space-y-2">
                  <Label htmlFor="model-select" className="text-sm font-medium">
                    Model to Test With
                  </Label>
                  <Select value={config.testModel} onValueChange={(value) => setConfig(prev => ({ ...prev, testModel: value }))}>
                    <SelectTrigger id="model-select" className="w-full bg-white">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto bg-white">
                      {availableModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {formatModelName(model)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The AI model used to test extractions during optimization
                  </p>
                </div>

                {/* Number of Documents */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Documents to Test
                    </Label>
                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {config.maxDocs}
                    </span>
                  </div>
                  <Slider
                    value={[config.maxDocs]}
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, maxDocs: value }))}
                    min={1}
                    max={25}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 (faster)</span>
                    <span>25 (most thorough)</span>
                  </div>
                </div>

                {/* Max Iterations */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Max Attempts per Field
                    </Label>
                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {config.maxIterations}
                    </span>
                  </div>
                  <Slider
                    value={[config.maxIterations]}
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, maxIterations: value }))}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 (quick)</span>
                    <span>10 (persistent)</span>
                  </div>
                </div>

                {/* Edit Instructions Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowInstructionsEditor(!showInstructionsEditor)}
                    className={cn(
                      "w-full justify-between bg-white",
                      hasModifiedInstructions && "border-amber-300 bg-amber-50"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      {showInstructionsEditor ? 'Hide Instructions' : 'Edit Instructions'}
                      {hasModifiedInstructions && (
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                          Modified
                        </Badge>
                      )}
                    </span>
                    {showInstructionsEditor ? (
                      <PanelRightOpen className="h-4 w-4" />
                    ) : (
                      <PanelRightClose className="h-4 w-4" />
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Customize the prompt generation template for this run
                  </p>
                </div>
              </div>

              {/* Estimated Time */}
              <div className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Estimated time per field:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    ~{Math.ceil(config.maxIterations * 12 / 60)} - {Math.ceil(config.maxIterations * 15 / 60)} min
                  </span>
                </div>
              </div>

              {/* Info Section - Moved below Estimated Time */}
              <div className="rounded-lg border bg-white p-4">
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="font-medium">Agent will iteratively test and refine prompts for failing fields.</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>Tests extractions on sampled documents</li>
                    <li>Analyzes failures and generates improved prompts</li>
                    <li>Repeats until target accuracy or max iterations reached</li>
                    <li>Prompts will be shown for your approval before saving</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Column - Instructions Editor (shown when expanded) */}
            {showInstructionsEditor && (
              <div className="flex-1 min-w-0 space-y-3 animate-in slide-in-from-right-4 duration-300 flex flex-col max-h-[calc(90vh-12rem)]">
                <div className="flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Prompt Generation Instructions</h3>
                    <p className="text-xs text-muted-foreground">
                      Customize how the agent generates improved prompts
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetInstructions}
                    disabled={!hasModifiedInstructions}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset to Default
                  </Button>
                </div>
                
                <div className="relative flex-1 min-h-0">
                  <Textarea
                    value={editedInstructions}
                    onChange={(e) => handleInstructionsChange(e.target.value)}
                    className={cn(
                      "h-full font-mono text-sm resize-none bg-white",
                      hasModifiedInstructions && "border-amber-300 focus:ring-amber-300"
                    )}
                    placeholder="Enter custom instructions..."
                  />
                  {hasModifiedInstructions && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                        Custom
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="rounded-lg border border-gray-200 bg-white p-3 flex-shrink-0">
                  <p className="text-xs text-gray-600">
                    <strong>Tip:</strong> The instructions control how the agent analyzes failures and generates improved prompts. 
                    Include guidance about format, specificity, and what makes a good extraction prompt.
                    Changes only apply to this run.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Running Mode - Table Layout */}
        {isRunning && (
          <div className="space-y-4">
            {/* Overall Progress Bar */}
            <div className="space-y-2 px-6 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  Optimizing Prompts...
                </h3>
                <Badge variant="outline" className="text-xs font-normal bg-white">
                  {agentAlphaState.fieldsProcessed} / {agentAlphaState.totalFields} Fields Complete
                </Badge>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {/* Runtime Config Summary */}
            {agentAlphaState.runtimeConfig && (
              <div className="px-6">
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Model: <strong className="text-gray-700">{formatModelName(agentAlphaState.runtimeConfig.testModel)}</strong></span>
                  <span>Docs: <strong className="text-gray-700">{agentAlphaState.actualDocCount ?? agentAlphaState.runtimeConfig.maxDocs}</strong></span>
                  <span>Max Attempts: <strong className="text-gray-700">{agentAlphaState.runtimeConfig.maxIterations}</strong></span>
                </div>
              </div>
            )}

            {/* Processing Section */}
            <div className="px-6">
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                      <h4 className="text-sm font-semibold text-gray-900">Processing</h4>
                    </div>
                    {agentAlphaState.processingFields && agentAlphaState.processingFields.length > 0 && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {agentAlphaState.processingFields.length} in parallel
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Table */}
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-[180px]">Field Name</th>
                      <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[80px]">Iteration</th>
                      <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[100px]">Initial Accuracy</th>
                      <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[80px]">Accuracy</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-[100px]">Elapsed</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {agentAlphaState.processingFields && agentAlphaState.processingFields.length > 0 ? (
                      agentAlphaState.processingFields.map((field, idx) => (
                        <tr key={field.fieldKey} className="border-b border-gray-100">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                              {field.fieldName}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center text-gray-700">
                            <span className="text-gray-600">{agentAlphaState.runtimeConfig?.maxIterations || AGENT_ALPHA_CONFIG.MAX_ITERATIONS} max</span>
                          </td>
                          <td className="px-2 py-3 text-center text-gray-700">{(field.initialAccuracy * 100).toFixed(0)}%</td>
                          <td className="px-2 py-3 text-center text-gray-400">—</td>
                          <td className="px-4 py-3 text-xs text-blue-600 font-medium">Optimizing...</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500">
                            <ElapsedTime startTime={field.startTime} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-center text-gray-400">
                          {agentAlphaState.fieldsProcessed === agentAlphaState.totalFields 
                            ? 'All fields completed' 
                            : 'Preparing next batch...'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Processed Section */}
            <div className="px-6 pb-4">
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <h4 className="text-sm font-semibold text-gray-900">Processed</h4>
                  </div>
                </div>
                
                {/* Table */}
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-[180px]">Field Name</th>
                        <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[80px]">Iteration</th>
                        <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[100px]">Initial Accuracy</th>
                        <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500 w-[80px]">Accuracy</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Prompt</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-[100px]">Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {agentAlphaState.processedFields && agentAlphaState.processedFields.length > 0 ? (
                        agentAlphaState.processedFields.map((field, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-900 align-top">{field.fieldName}</td>
                            <td className="px-2 py-3 text-center text-gray-700 align-top">{field.iterationCount}/{agentAlphaState.runtimeConfig?.maxIterations || AGENT_ALPHA_CONFIG.MAX_ITERATIONS}</td>
                            <td className="px-2 py-3 text-center text-gray-700 align-top">{(field.initialAccuracy * 100).toFixed(0)}%</td>
                            <td className="px-2 py-3 text-center font-medium text-green-600 align-top">{(field.finalAccuracy * 100).toFixed(0)}%</td>
                            <td className="px-4 py-3 text-xs text-gray-600 align-top">
                              <div className="whitespace-pre-wrap break-words max-w-full">
                                {field.finalPrompt}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-500 align-top whitespace-nowrap">
                              {formatDuration(field.timeMs)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                            No fields completed yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Time Estimate Footer */}
            <div className="flex items-center justify-start px-6 pb-4 pt-3">
              <span className="text-sm font-medium text-gray-600">
                Estimated time: {formatEstimatedTime(
                  agentAlphaState.totalFields, 
                  agentAlphaState.runtimeConfig?.maxIterations,
                  agentAlphaState.runtimeConfig?.maxDocs
                )}
              </span>
            </div>
          </div>
        )}

        {/* Error Mode */}
        {isError && (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-2 text-red-600">
              <span className="text-lg font-semibold">❌ Agent-Alpha Failed</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {agentAlphaState.errorMessage || 'An unknown error occurred.'}
            </p>
            <Button onClick={onCancel} variant="outline">
              Close
            </Button>
          </div>
        )}

        {/* Preview Mode */}
        {isPreview && results && (
          <div className="space-y-6">
            {/* Summary Stats - 4 cards matching Library page style */}
            {(() => {
              const improvedCount = results.results.filter(r => r.improved !== false).length;
              const skippedCount = results.results.filter(r => r.improved === false).length;
              const improvedResults = results.results.filter(r => r.improved !== false);
              
              return (
            <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Fields Processed */}
              <div className="rounded-xl border bg-gray-50 shadow-sm px-6 py-5 flex flex-col justify-center">
                <span className="text-5xl font-bold text-gray-900">{results.results.length}</span>
                <p className="text-xl text-gray-600 mt-2">Fields Processed</p>
              </div>
              
              {/* Will Apply */}
              <div className="rounded-xl border border-green-200 bg-green-50 shadow-sm px-6 py-5 flex flex-col justify-center">
                <span className="text-5xl font-bold text-green-600">{improvedCount}</span>
                <p className="text-xl text-gray-600 mt-2">Will Apply</p>
              </div>
              
              {/* Will Skip */}
              {skippedCount > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm px-6 py-5 flex flex-col justify-center">
                  <span className="text-5xl font-bold text-red-600">{skippedCount}</span>
                  <p className="text-xl text-gray-600 mt-2">Will Skip</p>
                </div>
              )}
              
              {/* Avg Improvement - only for improved results */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 shadow-sm px-6 py-5 flex flex-col justify-center">
                <span className="text-5xl font-bold text-blue-600">+{calculateAvgImprovement(improvedResults)}%</span>
                <p className="text-xl text-gray-600 mt-2">Avg Improvement</p>
              </div>
              
            </section>
              );
            })()}

            {/* Field Results - matching Library page Card style */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Generated Prompts</h2>
              <div className="space-y-4">
                {results.results.map((result) => {
                  // Check if prompt improved (use the flag if available, otherwise compare accuracies)
                  const didImprove = result.improved ?? (result.finalAccuracy >= result.initialAccuracy);
                  
                  return (
                  <div key={result.fieldKey} className={cn(
                    "rounded-xl border shadow-sm p-5",
                    didImprove ? "bg-white" : "bg-gray-50 border-gray-300"
                  )}>
                    {/* Header */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className={cn(
                          "text-lg font-semibold",
                          didImprove ? "text-gray-900" : "text-gray-500"
                        )}>{result.fieldName}</h3>
                        {!didImprove && (
                          <Badge className="bg-red-100 text-red-800 border-transparent">⚠️ No Improvement - Will Skip</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {didImprove && result.converged ? (
                          <Badge className="bg-green-100 text-green-800 border-transparent">✓ 100% Accuracy</Badge>
                        ) : didImprove ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-transparent">Max Iterations</Badge>
                        ) : null}
                        <Badge className="bg-gray-100 text-gray-800 border-transparent">
                          {result.iterationCount} iteration{result.iterationCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>

                    {/* Accuracy - separate lines */}
                    <div className="space-y-1 text-sm mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Previous Accuracy:</span>
                        <span className="font-semibold text-gray-900">{(result.initialAccuracy * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">New Accuracy:</span>
                        <span className={cn(
                          "font-semibold",
                          result.finalAccuracy > result.initialAccuracy ? "text-green-600" : 
                          result.finalAccuracy < result.initialAccuracy ? "text-red-600" : 
                          "text-gray-900"
                        )}>
                          {(result.finalAccuracy * 100).toFixed(0)}%
                        </span>
                        <span className={cn(
                          "text-sm font-medium",
                          result.finalAccuracy > result.initialAccuracy ? "text-green-600" : 
                          result.finalAccuracy < result.initialAccuracy ? "text-red-600" : 
                          "text-gray-900"
                        )}>
                          ({result.finalAccuracy > result.initialAccuracy ? '+' : result.finalAccuracy < result.initialAccuracy ? '' : ''}{((result.finalAccuracy - result.initialAccuracy) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>

                    {/* Prompts */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">Original Prompt:</p>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {result.initialPrompt || `Extract the ${result.fieldName} from this document.`}
                          </p>
                        </div>
                      </div>
                      {didImprove ? (
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-2">Optimized Prompt:</p>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {result.finalPrompt}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Generated Prompt (not recommended):</p>
                          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 opacity-60">
                            <p className="text-sm text-gray-500 whitespace-pre-wrap">
                              {result.finalPrompt}
                            </p>
                            <p className="text-xs text-red-600 mt-2 italic">
                              This prompt performed worse than the original and will not be applied.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tested on */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Tested on:</span>
                      {result.sampledDocIds.slice(0, 3).map((docId) => (
                        <Badge key={docId} variant="outline" className="text-xs bg-gray-50">
                          {results.sampledDocNames?.[docId] || `Doc ${docId.slice(-4)}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* Footer Actions */}
        {isConfigure && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleStartAgent} className="bg-blue-600 hover:bg-blue-700">
              <Sparkles className="mr-2 h-4 w-4" />
              Start Agent
            </Button>
          </DialogFooter>
        )}
        
        {isPreview && (
          <DialogFooter>
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
            <Button onClick={onApply}>
              Apply All Prompts
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface StatCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, variant = 'default' }) => {
  const variantClass =
    variant === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : variant === 'success'
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-muted border-transparent text-foreground';

  return (
    <div className={cn('rounded-lg border p-4 flex flex-col gap-1', variantClass)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
};

function calculateAvgImprovement(results: AgentAlphaPendingResults['results']): string {
  if (results.length === 0) return '0.0';
  const totalImprovement = results.reduce((sum, r) => sum + (r.finalAccuracy - r.initialAccuracy), 0);
  return ((totalImprovement / results.length) * 100).toFixed(1);
}

function formatEstimatedTime(totalFields: number, maxIterations?: number, maxDocs?: number): string {
  const iterations = maxIterations || AGENT_ALPHA_CONFIG.MAX_ITERATIONS;
  const docs = maxDocs || AGENT_ALPHA_CONFIG.MAX_DOCS;
  const fieldConcurrency = AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY;
  
  // With parallelization:
  // - Documents are extracted in parallel (5 at a time)
  // - Fields are processed in parallel (2 at a time)
  // Each iteration takes ~6-8 seconds (parallel doc extraction)
  // Average iterations per field is typically ~2-3 (not always max)
  const avgIterationsPerField = Math.min(iterations, 3);
  const secondsPerIteration = 6 + (docs / AGENT_ALPHA_CONFIG.EXTRACTION_CONCURRENCY) * 3;
  const secondsPerField = avgIterationsPerField * secondsPerIteration;
  
  // Fields processed in parallel batches
  const fieldBatches = Math.ceil(totalFields / fieldConcurrency);
  const estimatedSeconds = fieldBatches * secondsPerField;
  
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = Math.round(estimatedSeconds % 60);
  
  if (minutes === 0) {
    return `~${seconds}s`;
  }
  return `~${minutes}m ${seconds}s`;
}

// Component to show live elapsed time
const ElapsedTime: React.FC<{ startTime: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  
  return <span>{formatDuration(elapsed)}</span>;
};

function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatTimeDifference(actualMs: number, estimatedMs: number): string {
  const diffMs = Math.abs(actualMs - estimatedMs);
  const diffSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  
  const sign = actualMs <= estimatedMs ? '-' : '+';
  if (minutes === 0) {
    return `${sign}${seconds}s`;
  }
  return `${sign}${minutes}m ${seconds}s`;
}

// Calculate total time from individual field results when actualTimeMs is 0
function calculateTotalTimeFromResults(results: AgentAlphaPendingResults['results']): string {
  // This is a fallback - ideally actualTimeMs should be set properly
  // Estimate ~70 seconds per field based on observed logs
  const estimatedMs = results.length * 70 * 1000;
  return formatDuration(estimatedMs);
}

export default AgentAlphaModal;
