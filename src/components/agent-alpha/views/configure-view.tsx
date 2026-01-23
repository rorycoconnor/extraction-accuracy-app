'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileCode, RotateCcw, PanelRightOpen, PanelRightClose, Save, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatModelName } from '@/lib/utils';
import { DEFAULT_PROMPT_GENERATION_INSTRUCTIONS } from '@/lib/agent-alpha-config';
import { CREATE_NEW_ID, type ConfigureViewProps } from '../types';

export const ConfigureView: React.FC<ConfigureViewProps> = ({
  config,
  setConfig,
  showInstructionsEditor,
  setShowInstructionsEditor,
  availableModels,
  // Version management
  versions,
  selectedVersionId,
  activeVersionId,
  isCreatingNew,
  newVersionName,
  editedInstructions,
  hasModifiedInstructions,
  // Handlers
  onVersionSelect,
  onInstructionsChange,
  onResetInstructions,
  onSaveAsNew,
  onUpdateCurrent,
  onSetAsActive,
  onDeleteVersion,
  setNewVersionName,
}) => {
  // Get the currently selected version
  const selectedVersion = versions.find(v => v.id === selectedVersionId);
  const isDefault = selectedVersion?.isDefault ?? false;
  const isActive = selectedVersionId === activeVersionId;

  return (
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
                hasModifiedInstructions && "border-amber-300 bg-amber-50",
                !versions.find(v => v.id === activeVersionId)?.isDefault && "border-amber-300 bg-amber-50"
              )}
            >
              <span className="flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                <span>System Prompt:</span>
                <Badge
                  variant={versions.find(v => v.id === activeVersionId)?.isDefault ? "secondary" : "outline"}
                  className={cn(
                    "text-xs",
                    !versions.find(v => v.id === activeVersionId)?.isDefault && "bg-amber-100 text-amber-800 border-amber-300"
                  )}
                >
                  {versions.find(v => v.id === activeVersionId)?.name || 'Default'}
                </Badge>
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
              Customize the prompt generation template - active version persists across runs
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
              <h3 className="text-sm font-semibold text-gray-900">Agent System Prompt</h3>
              <p className="text-xs text-muted-foreground">
                Customize how the agent generates improved prompts
              </p>
            </div>
          </div>
          
          {/* Choose Version Card */}
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-3 space-y-2.5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white">
                <FileCode className="h-3 w-3" />
              </div>
              <div>
                <h4 className="font-medium text-xs text-gray-900">Choose System Prompt</h4>
                <p className="text-[10px] text-gray-500">Select a version or create new</p>
              </div>
            </div>
            
            <Select
              value={isCreatingNew ? CREATE_NEW_ID : selectedVersionId}
              onValueChange={onVersionSelect}
            >
              <SelectTrigger className="w-full bg-white border-2 h-9 text-sm">
                <SelectValue placeholder="Choose a system prompt..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    <div className="flex items-center gap-2">
                      <span>{version.name}</span>
                      {version.id === activeVersionId && (
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      )}
                      {version.isDefault && (
                        <Badge variant="outline" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value={CREATE_NEW_ID}>
                  <div className="flex items-center gap-2 text-blue-600 font-medium">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create New Version...</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Quick Actions Row */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {!isCreatingNew && !isActive && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onSetAsActive}
                  className="flex-1 h-7 text-xs"
                >
                  Set as Active
                </Button>
              )}
              {!isCreatingNew && isActive && (
                <div className="flex-1 flex items-center justify-center gap-1.5 text-xs text-green-600 font-medium py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Currently Active
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onResetInstructions}
                disabled={activeVersionId === versions.find(v => v.isDefault)?.id && !isCreatingNew && !hasModifiedInstructions}
                className="h-7 text-xs px-2"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              {!isDefault && !isCreatingNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteVersion(selectedVersionId, selectedVersion?.name || '')}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs px-2"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* New Version Name Input (shown when creating new) */}
          {isCreatingNew && (
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-xs font-medium text-gray-700">New Version Name</Label>
              <Input
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="Enter version name..."
                className="bg-white"
              />
            </div>
          )}
          
          {/* Instructions Textarea */}
          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <Label className="text-xs font-medium text-gray-700">Instructions</Label>
            <div className="relative flex-1 min-h-0">
              <Textarea
                value={editedInstructions}
                onChange={(e) => onInstructionsChange(e.target.value)}
                className={cn(
                  "h-full font-mono text-sm resize-none bg-white",
                  hasModifiedInstructions && "border-amber-300 focus:ring-amber-300"
                )}
                placeholder="Enter custom instructions..."
              />
              {hasModifiedInstructions && (
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                    Modified
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Save Actions */}
          <div className="flex-shrink-0 pt-2 border-t space-y-2">
            {isCreatingNew ? (
              <Button
                onClick={onSaveAsNew}
                disabled={!newVersionName.trim()}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                Create Version
              </Button>
            ) : (
              <Button
                variant={hasModifiedInstructions ? 'default' : 'outline'}
                onClick={onUpdateCurrent}
                disabled={!hasModifiedInstructions || isDefault}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                Update Version
              </Button>
            )}
          </div>
          
          <div className="rounded-lg border border-gray-200 bg-white p-3 flex-shrink-0">
            <p className="text-xs text-gray-600">
              <strong>Tip:</strong> The instructions control how the agent analyzes failures and generates improved prompts. 
              Include guidance about format, specificity, and what makes a good extraction prompt.
              The active version will be used for all agent runs until changed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
