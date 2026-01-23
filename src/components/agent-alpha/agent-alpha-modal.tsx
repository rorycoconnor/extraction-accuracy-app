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
  resetToDefaultAgentSystemPrompt,
} from '@/lib/system-prompt-storage';

// Import view components
import { ConfigureView } from './views/configure-view';
import { RunningView } from './views/running-view';
import { PreviewView } from './views/preview-view';
import { ErrorView } from './views/error-view';
import type { AgentAlphaModalProps } from './types';
import { CREATE_NEW_ID } from './types';

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
  const [showInstructionsEditor, setShowInstructionsEditor] = useState(false);
  const [editedInstructions, setEditedInstructions] = useState(DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
  const [hasModifiedInstructions, setHasModifiedInstructions] = useState(false);
  
  // Version management state
  const [versions, setVersions] = useState<SystemPromptVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; versionId: string; versionName: string }>({
    isOpen: false,
    versionId: '',
    versionName: '',
  });

  // Track whether we're in the initial load phase to prevent race conditions
  const isInitialLoadRef = useRef(true);
  
  // Helper function to load and initialize all version state
  const initializeVersionState = useCallback(() => {
    const allVersions = getAllAgentSystemPromptVersions();
    const active = getActiveAgentSystemPrompt();
    
    setVersions(allVersions);
    setActiveVersionId(active.id);
    setSelectedVersionId(active.id);
    setEditedInstructions(active.agentInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
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
      const defaultConfig = getDefaultRuntimeConfig();
      
      // Use the model from last comparison if available
      if (defaultModel) {
        defaultConfig.testModel = defaultModel;
      }
      
      // Set customInstructions directly based on active version
      if (!active.isDefault && active.agentInstructions) {
        defaultConfig.customInstructions = active.agentInstructions;
      }
      
      setConfig(defaultConfig);
      setShowInstructionsEditor(false);
      setIsCreatingNew(false);
      setNewVersionName('');
      
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
    if (!activeVersion.isDefault && activeVersion.agentInstructions) {
      setConfig(prev => ({ ...prev, customInstructions: activeVersion.agentInstructions }));
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
    if (versionId === CREATE_NEW_ID) {
      setIsCreatingNew(true);
      setNewVersionName('');
      setEditedInstructions(selectedVersion?.agentInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
      setHasModifiedInstructions(false);
    } else {
      setIsCreatingNew(false);
      setSelectedVersionId(versionId);
      const version = versions.find(v => v.id === versionId);
      if (version) {
        setEditedInstructions(version.agentInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
        setHasModifiedInstructions(false);
      }
    }
  };

  const handleInstructionsChange = (value: string) => {
    setEditedInstructions(value);
    const currentVersion = isCreatingNew ? null : selectedVersion;
    const originalInstructions = currentVersion?.agentInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS;
    setHasModifiedInstructions(value !== originalInstructions);
  };

  const handleResetInstructions = () => {
    resetToDefaultAgentSystemPrompt();
    const defaultVersion = versions.find(v => v.isDefault);
    if (defaultVersion) {
      setSelectedVersionId(defaultVersion.id);
      setActiveVersionId(defaultVersion.id);
      setEditedInstructions(defaultVersion.agentInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
    } else {
      setEditedInstructions(DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
    }
    setHasModifiedInstructions(false);
    setIsCreatingNew(false);
    toast({ title: 'Reset to Default', description: 'Agent system prompt reset to default version.' });
  };

  const handleSaveAsNew = () => {
    if (!newVersionName.trim()) {
      toast({ title: 'Error', description: 'Please enter a version name.', variant: 'destructive' });
      return;
    }
    
    const newVersion = createAgentSystemPromptVersion(newVersionName.trim(), editedInstructions);
    setVersions(getAllAgentSystemPromptVersions());
    setSelectedVersionId(newVersion.id);
    setIsCreatingNew(false);
    setNewVersionName('');
    setHasModifiedInstructions(false);
    
    // Auto-set as active
    setActiveAgentSystemPrompt(newVersion.id);
    setActiveVersionId(newVersion.id);
    
    toast({ title: 'Version Created', description: `"${newVersion.name}" saved and set as active.` });
  };

  const handleUpdateCurrent = () => {
    if (isDefault || isCreatingNew) return;
    
    const updated = updateAgentSystemPromptVersion(selectedVersionId, {
      agentInstructions: editedInstructions,
    });
    
    if (updated) {
      setVersions(getAllAgentSystemPromptVersions());
      setHasModifiedInstructions(false);
      toast({ title: 'Version Updated', description: `"${updated.name}" has been updated.` });
    }
  };

  const handleSetAsActive = () => {
    if (isCreatingNew) return;
    
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
        setEditedInstructions(active.agentInstructions || DEFAULT_PROMPT_GENERATION_INSTRUCTIONS);
      }
      
      toast({ title: 'Version Deleted', description: `"${deleteConfirm.versionName}" has been deleted.` });
    }
    
    setDeleteConfirm({ isOpen: false, versionId: '', versionName: '' });
  };

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
          <ConfigureView
            config={config}
            setConfig={setConfig}
            showInstructionsEditor={showInstructionsEditor}
            setShowInstructionsEditor={setShowInstructionsEditor}
            availableModels={availableModels}
            versions={versions}
            selectedVersionId={selectedVersionId}
            activeVersionId={activeVersionId}
            isCreatingNew={isCreatingNew}
            newVersionName={newVersionName}
            editedInstructions={editedInstructions}
            hasModifiedInstructions={hasModifiedInstructions}
            onVersionSelect={handleVersionSelect}
            onInstructionsChange={handleInstructionsChange}
            onResetInstructions={handleResetInstructions}
            onSaveAsNew={handleSaveAsNew}
            onUpdateCurrent={handleUpdateCurrent}
            onSetAsActive={handleSetAsActive}
            onDeleteVersion={(versionId, versionName) => setDeleteConfirm({ isOpen: true, versionId, versionName })}
            setNewVersionName={setNewVersionName}
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
            <Button onClick={onCancel} variant="outline">
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
    </Dialog>
  );
};

export default AgentAlphaModal;
