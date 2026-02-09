'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { AgentAlphaRuntimeConfig } from '@/lib/agent-alpha-config';
import { DEFAULT_PROMPT_GENERATION_INSTRUCTIONS, getDefaultRuntimeConfig } from '@/lib/agent-alpha-config';
import { AVAILABLE_MODELS } from '@/lib/main-page-constants';
import type { SystemPromptVersion } from '@/lib/system-prompt-storage';
import {
  getActiveAgentSystemPrompt,
  setActiveAgentSystemPrompt,
  createAgentSystemPromptVersion,
  updateAgentSystemPromptVersion,
  deleteAgentSystemPromptVersion,
  getAllAgentSystemPromptVersions,
} from '@/lib/system-prompt-storage';

// Import view components
import { ConfigureView } from './views/configure-view';
import { RunningView } from './views/running-view';
import { PreviewView } from './views/preview-view';
import { ErrorView } from './views/error-view';
import type { AgentAlphaModalProps } from './types';

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
  const { toast } = useToast();
  const isConfigure = agentAlphaState.status === 'configure';
  const isRunning = agentAlphaState.status === 'running';
  const isPreview = agentAlphaState.status === 'preview';
  const isError = agentAlphaState.status === 'error';

  // Configuration state
  const [config, setConfig] = useState<AgentAlphaRuntimeConfig>(getDefaultRuntimeConfig());
  const [editedInstructions, setEditedInstructions] = useState(DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
  const [hasModifiedInstructions, setHasModifiedInstructions] = useState(false);
  
  // Version management state
  const [versions, setVersions] = useState<SystemPromptVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; versionId: string; versionName: string }>({
    isOpen: false,
    versionId: '',
    versionName: '',
  });
  
  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; versionId: string; versionName: string; newName: string }>({
    isOpen: false,
    versionId: '',
    versionName: '',
    newName: '',
  });
  
  // State for unsaved results confirmation dialog
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // Track whether we're in the initial load phase to prevent race conditions
  const isInitialLoadRef = useRef(true);
  
  // Helper function to load and initialize all version state
  const initializeVersionState = useCallback(() => {
    const allVersions = getAllAgentSystemPromptVersions();
    const active = getActiveAgentSystemPrompt();
    
    setVersions(allVersions);
    setActiveVersionId(active.id);
    setSelectedVersionId(active.id);
    setEditedInstructions(active.generateInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
    setHasModifiedInstructions(false);
    
    return { allVersions, active };
  }, []);
  
  // Initialize versions on mount (runs once)
  useEffect(() => {
    initializeVersionState();
  }, [initializeVersionState]);
  
  // Reset everything when modal opens in configure mode
  // This is the main initialization effect that sets up all state correctly
  useEffect(() => {
    if (isConfigure) {
      // Mark that we're doing an initial load to prevent activeVersionId effect from racing
      isInitialLoadRef.current = true;
      
      // Load versions and get active
      const { active } = initializeVersionState();
      
      // Set up config with correct values
      // Always use the default from config (Gemini 2.5 Flash), not from last comparison
      const defaultConfig = getDefaultRuntimeConfig();
      
      // Set customInstructions directly based on active version
      if (!active.isDefault && active.generateInstructions) {
        defaultConfig.customInstructions = active.generateInstructions;
      }
      
      setConfig(defaultConfig);
      
      // Mark initial load complete after state updates are queued
      // Use setTimeout to ensure this runs after React processes state updates
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 0);
    }
  }, [isConfigure, defaultModel, initializeVersionState]);

  // Update config when user changes the active version (not during initial load)
  // This only runs after user explicitly changes the active version via UI
  useEffect(() => {
    // Skip during initial load to prevent race condition
    if (isInitialLoadRef.current) return;
    
    // Guard: Don't run until versions are loaded
    if (versions.length === 0) return;
    
    const activeVersion = versions.find(v => v.id === activeVersionId);
    
    // Guard: Only update if we found the version in the list
    if (!activeVersion) {
      logger.warn('Active version not found in versions list', { activeVersionId });
      return;
    }
    
    // Update config with the new active version's instructions
    if (!activeVersion.isDefault && activeVersion.generateInstructions) {
      setConfig(prev => ({ ...prev, customInstructions: activeVersion.generateInstructions }));
    } else {
      setConfig(prev => ({ ...prev, customInstructions: undefined }));
    }
  }, [activeVersionId, versions]);

  // Get the currently selected version
  const selectedVersion = useMemo(() => {
    return versions.find(v => v.id === selectedVersionId);
  }, [versions, selectedVersionId]);

  // Check if selected version is default
  const isDefault = selectedVersion?.isDefault ?? false;
  const isActive = selectedVersionId === activeVersionId;

  const handleVersionSelect = (versionId: string) => {
    setSelectedVersionId(versionId);
    const version = versions.find(v => v.id === versionId);
    if (version) {
      setEditedInstructions(version.generateInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
      setHasModifiedInstructions(false);
    }
  };

  const handleInstructionsChange = (value: string) => {
    setEditedInstructions(value);
    const originalInstructions = selectedVersion?.generateInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS;
    setHasModifiedInstructions(value !== originalInstructions);
  };

  const handleSaveAsNew = (versionName: string) => {
    if (!versionName.trim()) {
      toast({ title: 'Error', description: 'Please enter a version name.', variant: 'destructive' });
      return;
    }
    
    const newVersion = createAgentSystemPromptVersion(versionName.trim(), editedInstructions);
    setVersions(getAllAgentSystemPromptVersions());
    setSelectedVersionId(newVersion.id);
    setHasModifiedInstructions(false);
    
    // Auto-set as active
    setActiveAgentSystemPrompt(newVersion.id);
    setActiveVersionId(newVersion.id);
    
    toast({ title: 'Version Created', description: `"${newVersion.name}" saved and set as active.` });
  };

  const handleUpdateCurrent = () => {
    if (isDefault) return;
    
    const updated = updateAgentSystemPromptVersion(selectedVersionId, {
      generateInstructions: editedInstructions,
    });
    
    if (updated) {
      setVersions(getAllAgentSystemPromptVersions());
      setHasModifiedInstructions(false);
      
      // Auto-set as active when updating
      setActiveAgentSystemPrompt(selectedVersionId);
      setActiveVersionId(selectedVersionId);
      
      toast({ title: 'Version Updated', description: `"${updated.name}" has been updated and set as active.` });
    }
  };

  const handleSetAsActive = () => {
    setActiveAgentSystemPrompt(selectedVersionId);
    setActiveVersionId(selectedVersionId);
    toast({ title: 'Active Version Changed', description: `"${selectedVersion?.name}" is now active.` });
  };

  const handleDeleteVersion = () => {
    if (!deleteConfirm.versionId) return;
    
    const success = deleteAgentSystemPromptVersion(deleteConfirm.versionId);
    if (success) {
      const updatedVersions = getAllAgentSystemPromptVersions();
      setVersions(updatedVersions);
      
      // If deleted the selected version, switch to active
      if (selectedVersionId === deleteConfirm.versionId) {
        const active = getActiveAgentSystemPrompt();
        setSelectedVersionId(active.id);
        setActiveVersionId(active.id);
        setEditedInstructions(active.generateInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
      }
      
      toast({ title: 'Version Deleted', description: `"${deleteConfirm.versionName}" has been deleted.` });
    }
    
    setDeleteConfirm({ isOpen: false, versionId: '', versionName: '' });
  };

  const handleRenameVersion = () => {
    if (!renameDialog.versionId || !renameDialog.newName.trim()) return;
    
    const updated = updateAgentSystemPromptVersion(renameDialog.versionId, {
      name: renameDialog.newName.trim(),
    });
    
    if (updated) {
      setVersions(getAllAgentSystemPromptVersions());
      toast({ title: 'Version Renamed', description: `Renamed to "${updated.name}".` });
    }
    
    setRenameDialog({ isOpen: false, versionId: '', versionName: '', newName: '' });
  };

  const handleCreateNew = () => {
    // Generate a default name based on the selected version
    const baseName = selectedVersion?.name || 'Custom';
    const versionPattern = new RegExp(`^${baseName.replace(/\s+V\d+$/, '')}\\s+V(\\d+)$`);
    const existingNumbers = versions
      .map(v => {
        const match = v.name.match(versionPattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const newName = `${baseName.replace(/\s+V\d+$/, '')} V${nextNum}`;
    
    // Create with current edited instructions
    const newVersion = createAgentSystemPromptVersion(newName, editedInstructions);
    setVersions(getAllAgentSystemPromptVersions());
    setSelectedVersionId(newVersion.id);
    setHasModifiedInstructions(false);
    
    // Auto-set as active
    setActiveAgentSystemPrompt(newVersion.id);
    setActiveVersionId(newVersion.id);
    
    toast({ title: 'Version Created', description: `"${newVersion.name}" saved and set as active.` });
  };

  const handleStartAgent = () => {
    if (onStartWithConfig) {
      onStartWithConfig(config);
    }
  };

  // Handle close attempt - show confirmation if in preview mode with results
  const handleCloseAttempt = useCallback(() => {
    if (isPreview && results && results.results.length > 0) {
      // Show confirmation dialog before closing
      setShowUnsavedConfirm(true);
    } else {
      onCancel();
    }
  }, [isPreview, results, onCancel]);

  // Handle discard and close
  const handleDiscardAndClose = () => {
    setShowUnsavedConfirm(false);
    onCancel();
  };

  // Handle apply and close
  const handleApplyAndClose = () => {
    setShowUnsavedConfirm(false);
    onApply();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseAttempt()}>
      <DialogContent className={cn(
        "overflow-y-auto transition-all duration-300",
        isConfigure ? "max-w-[85vw] w-[85vw] max-h-[85vh]" : "max-w-[95vw] w-[95vw] max-h-[90vh]"
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
          <ConfigureView
            config={config}
            setConfig={setConfig}
            availableModels={availableModels}
            versions={versions}
            selectedVersionId={selectedVersionId}
            activeVersionId={activeVersionId}
            editedInstructions={editedInstructions}
            hasModifiedInstructions={hasModifiedInstructions}
            onVersionSelect={handleVersionSelect}
            onInstructionsChange={handleInstructionsChange}
            onSaveAsNew={handleSaveAsNew}
            onUpdateCurrent={handleUpdateCurrent}
            onSetAsActive={handleSetAsActive}
            onDeleteVersion={() => setDeleteConfirm({
              isOpen: true,
              versionId: selectedVersionId,
              versionName: selectedVersion?.name || '',
            })}
            onRenameVersion={() => setRenameDialog({
              isOpen: true,
              versionId: selectedVersionId,
              versionName: selectedVersion?.name || '',
              newName: selectedVersion?.name || '',
            })}
            onCreateNew={handleCreateNew}
          />
        )}

        {/* Running Mode */}
        {isRunning && (
          <RunningView agentAlphaState={agentAlphaState} />
        )}

        {/* Error Mode */}
        {isError && (
          <ErrorView errorMessage={agentAlphaState.errorMessage} onClose={onCancel} />
        )}

        {/* Preview Mode */}
        {isPreview && results && (
          <PreviewView results={results} />
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
          <DialogFooter className="!justify-start gap-2">
            <Button onClick={handleCloseAttempt} variant="outline">
              Cancel
            </Button>
            <Button onClick={onApply}>
              Apply All Prompts
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, versionId: '', versionName: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm.versionName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVersion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <AlertDialog open={renameDialog.isOpen} onOpenChange={(open) => !open && setRenameDialog({ isOpen: false, versionId: '', versionName: '', newName: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename System Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for &quot;{renameDialog.versionName}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-input" className="sr-only">New name</Label>
            <Input
              id="rename-input"
              value={renameDialog.newName}
              onChange={(e) => setRenameDialog(prev => ({ ...prev, newName: e.target.value }))}
              placeholder="Enter new name..."
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameDialog.newName.trim()) {
                  handleRenameVersion();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRenameVersion} 
              disabled={!renameDialog.newName.trim() || renameDialog.newName.trim() === renameDialog.versionName}
            >
              Rename
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Results Confirmation Dialog */}
      <AlertDialog open={showUnsavedConfirm} onOpenChange={setShowUnsavedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Optimized Prompts</AlertDialogTitle>
            <AlertDialogDescription>
              You have optimized prompts that haven&apos;t been applied yet. Would you like to apply them before closing, or discard the changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={handleDiscardAndClose}>
              Discard Changes
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyAndClose} className="bg-blue-600 hover:bg-blue-700">
              Apply All Prompts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default AgentAlphaModal;
