'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Plus, Trash2 } from 'lucide-react';
import { cn, formatModelName } from '@/lib/utils';
import { AGENT_ALPHA_CONFIG, PROMPT_GEN_MODELS } from '@/lib/agent-alpha-config';
import { formatEstimatedTime } from '../utils';
import { type ConfigureViewProps } from '../types';

export const ConfigureView: React.FC<ConfigureViewProps> = ({
  config,
  setConfig,
  availableModels,
  // Version management
  versions,
  selectedVersionId,
  activeVersionId,
  editedInstructions,
  hasModifiedInstructions,
  // Handlers
  onVersionSelect,
  onInstructionsChange,
  onSaveAsNew,
  onUpdateCurrent,
  onSetAsActive,
  onDeleteVersion,
}) => {
  // Get the currently selected version
  const selectedVersion = versions.find(v => v.id === selectedVersionId);
  const isDefault = selectedVersion?.isDefault ?? false;
  
  // Generate next version name based on selected version
  const getNextVersionName = () => {
    const baseName = selectedVersion?.name || 'Custom';
    // Find existing versions with this base name pattern
    const versionPattern = new RegExp(`^${baseName.replace(/\s+V\d+$/, '')}\\s+V(\\d+)$`);
    const existingNumbers = versions
      .map(v => {
        const match = v.name.match(versionPattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${baseName.replace(/\s+V\d+$/, '')} V${nextNum}`;
  };

  return (
    <div className="flex gap-6 py-2">
      {/* Left Column - Configuration Options */}
      <div className="w-[40%] flex-shrink-0 space-y-5">
        {/* Choose System Prompt */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Choose a System Prompt</Label>
          <Select
            value={selectedVersionId}
            onValueChange={onVersionSelect}
          >
            <SelectTrigger className="w-full bg-white dark:bg-input">
              <SelectValue placeholder="Choose a system prompt..." />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-popover">
              {versions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  <div className="flex items-center gap-2">
                    <span>{version.name}</span>
                    {version.id === activeVersionId && (
                      <Badge className="text-xs bg-green-100 text-green-700 border-green-300">Active</Badge>
                    )}
                    {version.isDefault && version.name !== 'Default' && (
                      <Badge variant="outline" className="text-xs">Default</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Quick Actions Row */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="default"
              onClick={onSetAsActive}
              disabled={selectedVersionId === activeVersionId}
              className="flex-1 h-9"
            >
              Set as Active
            </Button>
            {!isDefault && (
              <Button
                variant="outline"
                onClick={onDeleteVersion}
                className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          
        </div>

        {/* Prompt Generation Model */}
        <div className="space-y-2">
          <Label htmlFor="prompt-gen-model" className="text-sm font-medium">
            Prompt Generation Model
          </Label>
          <Select 
            value={config.promptGenerationModel} 
            onValueChange={(value) => setConfig(prev => ({ ...prev, promptGenerationModel: value }))}
          >
            <SelectTrigger id="prompt-gen-model" className="w-full bg-white dark:bg-input">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-popover">
              {PROMPT_GEN_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Model used to generate and improve extraction prompts
          </p>
        </div>

        {/* Model to Test With */}
        <div className="space-y-2">
          <Label htmlFor="model-select" className="text-sm font-medium">
            Model to Test With
          </Label>
          <Select value={config.testModel} onValueChange={(value) => setConfig(prev => ({ ...prev, testModel: value }))}>
            <SelectTrigger id="model-select" className="w-full bg-white dark:bg-input">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto bg-white dark:bg-popover">
              {availableModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {formatModelName(model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Compact Configuration Row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Documents to Test */}
          <div className="space-y-1.5">
            <Label htmlFor="max-docs" className="text-sm font-medium">
              Test Documents
            </Label>
            <Input
              id="max-docs"
              type="number"
              min={1}
              max={25}
              value={config.maxDocs}
              onChange={(e) => {
                const value = Math.max(1, Math.min(25, parseInt(e.target.value) || 1));
                setConfig(prev => ({ ...prev, maxDocs: value }));
              }}
              className="bg-white dark:bg-input text-center"
            />
          </div>

          {/* Max Attempts per Field */}
          <div className="space-y-1.5">
            <Label htmlFor="max-iterations" className="text-sm font-medium">
              Max Attempts
            </Label>
            <Input
              id="max-iterations"
              type="number"
              min={1}
              max={10}
              value={config.maxIterations}
              onChange={(e) => {
                const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                setConfig(prev => ({ ...prev, maxIterations: value }));
              }}
              className="bg-white dark:bg-input text-center"
            />
          </div>

          {/* Concurrent Fields */}
          <div className="space-y-1.5">
            <Label htmlFor="field-concurrency" className="text-sm font-medium">
              Concurrent Fields
            </Label>
            <Input
              id="field-concurrency"
              type="number"
              min={1}
              max={8}
              value={config.fieldConcurrency}
              onChange={(e) => {
                const value = Math.max(1, Math.min(8, parseInt(e.target.value) || 1));
                setConfig(prev => ({ ...prev, fieldConcurrency: value }));
              }}
              className="bg-white dark:bg-input text-center"
            />
          </div>
        </div>

        {/* Estimated Time */}
        <div className="rounded-lg border bg-gray-50 dark:bg-muted p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimated time per field:</span>
            <span className="text-sm font-semibold text-foreground">
              {formatEstimatedTime(1, config.maxIterations, config.maxDocs, config.fieldConcurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* Right Column - Instructions Editor */}
      <div className="flex-1 min-w-0 flex flex-col space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Instructions</h3>
          {hasModifiedInstructions && (
            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
              Modified
            </Badge>
          )}
        </div>
        
        {/* Instructions Textarea */}
        <div className="flex-1 min-h-0">
          <Textarea
            value={editedInstructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            className={cn(
              "h-full min-h-[300px] font-mono text-sm resize-none bg-white dark:bg-input",
              hasModifiedInstructions && "border-amber-300 dark:border-amber-700 focus:ring-amber-300 dark:focus:ring-amber-700"
            )}
            placeholder="Enter custom instructions..."
          />
        </div>

        {/* Save Actions - Show when modified (not for Default) */}
        {hasModifiedInstructions && !isDefault && (
          <div className="flex gap-3 pt-2 border-t">
            <Button
              onClick={onUpdateCurrent}
              className="flex-1"
            >
              <Save className="mr-2 h-4 w-4" />
              Update Version
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Auto-generate name and save
                const newName = getNextVersionName();
                onSaveAsNew(newName);
              }}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Version
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
