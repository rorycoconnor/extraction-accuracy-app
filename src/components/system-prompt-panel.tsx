'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { X, RotateCcw, Save, Trash2, Plus, Settings2 } from 'lucide-react';
import type { SystemPromptVersion } from '@/lib/system-prompt-storage';
import {
  getAllSystemPromptVersions,
  getActiveSystemPrompt,
  setActiveSystemPrompt,
  createSystemPromptVersion,
  updateSystemPromptVersion,
  deleteSystemPromptVersion,
  resetToDefaultSystemPrompt,
} from '@/lib/system-prompt-storage';

interface SystemPromptPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSystemPromptChange?: (version: SystemPromptVersion) => void;
}

const CREATE_NEW_ID = '__create_new__';

export function SystemPromptPanel({
  isOpen,
  onClose,
  onSystemPromptChange,
}: SystemPromptPanelProps) {
  const { toast } = useToast();
  
  // State for versions
  const [versions, setVersions] = React.useState<SystemPromptVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = React.useState<string>('');
  
  // State for editing
  const [selectedVersionId, setSelectedVersionId] = React.useState<string>('');
  const [editName, setEditName] = React.useState('');
  const [editGeneratePrompt, setEditGeneratePrompt] = React.useState('');
  const [editImprovePrompt, setEditImprovePrompt] = React.useState('');
  const [isCreatingNew, setIsCreatingNew] = React.useState(false);
  
  // Track if content has been modified
  const [hasModifications, setHasModifications] = React.useState(false);
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    isOpen: boolean;
    versionId: string;
    versionName: string;
  }>({ isOpen: false, versionId: '', versionName: '' });

  // Load data when panel opens
  React.useEffect(() => {
    if (isOpen) {
      // Get only Prompt Studio versions (filtered by type)
      const promptStudioVersions = getAllSystemPromptVersions();
      setVersions(promptStudioVersions);
      
      // Get the active Prompt Studio version
      const activeVersion = getActiveSystemPrompt();
      setActiveVersionId(activeVersion.id);
      
      // Set selected version to active version
      setSelectedVersionId(activeVersion.id);
      setEditName(activeVersion.name);
      setEditGeneratePrompt(activeVersion.generatePrompt || '');
      setEditImprovePrompt(activeVersion.improvePrompt || '');
      setIsCreatingNew(false);
      setHasModifications(false);
    }
  }, [isOpen]);

  // Get the currently selected version object
  const selectedVersion = React.useMemo(() => {
    return versions.find(v => v.id === selectedVersionId);
  }, [versions, selectedVersionId]);

  // Check if content has been modified from the selected version
  React.useEffect(() => {
    if (isCreatingNew) {
      // For new versions, check if any content has been entered
      setHasModifications(
        editName.trim() !== '' || 
        editGeneratePrompt.trim() !== '' || 
        editImprovePrompt.trim() !== ''
      );
    } else if (selectedVersion) {
      setHasModifications(
        editName !== selectedVersion.name ||
        editGeneratePrompt !== (selectedVersion.generatePrompt || '') ||
        editImprovePrompt !== (selectedVersion.improvePrompt || '')
      );
    }
  }, [editName, editGeneratePrompt, editImprovePrompt, selectedVersion, isCreatingNew]);

  // Handle version selection change
  const handleVersionSelect = (versionId: string) => {
    if (versionId === CREATE_NEW_ID) {
      // Switch to create new mode
      setIsCreatingNew(true);
      setSelectedVersionId('');
      setEditName('');
      setEditGeneratePrompt('');
      setEditImprovePrompt('');
    } else {
      setIsCreatingNew(false);
      const version = versions.find(v => v.id === versionId);
      if (version) {
        setSelectedVersionId(version.id);
        setEditName(version.name);
        setEditGeneratePrompt(version.generatePrompt || '');
        setEditImprovePrompt(version.improvePrompt || '');
      }
    }
    setHasModifications(false);
  };

  // Handle setting as active
  const handleSetAsActive = () => {
    if (selectedVersionId && selectedVersionId !== activeVersionId) {
      setActiveSystemPrompt(selectedVersionId);
      setActiveVersionId(selectedVersionId);
      
      const version = versions.find(v => v.id === selectedVersionId);
      if (version && onSystemPromptChange) {
        onSystemPromptChange(version);
      }
      
      toast({
        title: 'System Prompt Activated',
        description: `"${version?.name}" is now the active system prompt.`,
      });
    }
  };

  // Handle save as new version
  const handleSaveAsNew = () => {
    if (!editName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name Required',
        description: 'Please enter a name for the new version.',
      });
      return;
    }

    // Use default prompts if fields are empty
    const defaultVersion = versions.find(v => v.isDefault);
    const generatePrompt = editGeneratePrompt.trim() || defaultVersion?.generatePrompt || '';
    const improvePrompt = editImprovePrompt.trim() || defaultVersion?.improvePrompt || '';

    const newVersion = createSystemPromptVersion(
      editName.trim(),
      generatePrompt,
      improvePrompt
    );

    // Refresh versions list (only Prompt Studio versions)
    setVersions(getAllSystemPromptVersions());
    
    // Select the new version
    setSelectedVersionId(newVersion.id);
    setIsCreatingNew(false);
    setHasModifications(false);

    toast({
      title: 'Version Created',
      description: `"${newVersion.name}" has been saved.`,
    });
  };

  // Handle update current version
  const handleUpdateCurrent = () => {
    if (!selectedVersion || selectedVersion.isDefault) {
      return;
    }

    const updated = updateSystemPromptVersion(selectedVersion.id, {
      name: editName.trim() || selectedVersion.name,
      generatePrompt: editGeneratePrompt,
      improvePrompt: editImprovePrompt,
    });

    if (updated) {
      // Refresh versions list (only Prompt Studio versions)
      setVersions(getAllSystemPromptVersions());
      setHasModifications(false);

      // If this is the active version, notify the parent
      if (selectedVersion.id === activeVersionId && onSystemPromptChange) {
        onSystemPromptChange(updated);
      }

      toast({
        title: 'Version Updated',
        description: `"${updated.name}" has been updated.`,
      });
    }
  };

  // Handle delete version
  const handleDeleteVersion = () => {
    if (!deleteConfirm.versionId) return;

    const success = deleteSystemPromptVersion(deleteConfirm.versionId);
    if (success) {
      // Refresh versions list (only Prompt Studio versions)
      const updatedVersions = getAllSystemPromptVersions();
      setVersions(updatedVersions);
      
      // Get the new active version
      const newActiveVersion = getActiveSystemPrompt();
      setActiveVersionId(newActiveVersion.id);

      // If we deleted the selected version, select the active one
      if (deleteConfirm.versionId === selectedVersionId) {
        setSelectedVersionId(newActiveVersion.id);
        setEditName(newActiveVersion.name);
        setEditGeneratePrompt(newActiveVersion.generatePrompt || '');
        setEditImprovePrompt(newActiveVersion.improvePrompt || '');
      }

      // Notify parent if active version changed
      if (deleteConfirm.versionId === activeVersionId && onSystemPromptChange) {
        onSystemPromptChange(newActiveVersion);
      }

      toast({
        title: 'Version Deleted',
        description: `"${deleteConfirm.versionName}" has been deleted.`,
      });
    }

    setDeleteConfirm({ isOpen: false, versionId: '', versionName: '' });
  };

  // Handle reset to default
  const handleResetToDefault = () => {
    resetToDefaultSystemPrompt();
    
    // Refresh versions list (only Prompt Studio versions)
    const updatedVersions = getAllSystemPromptVersions();
    setVersions(updatedVersions);
    
    // Get the new active version (which will be the default)
    const defaultVersion = getActiveSystemPrompt();
    setActiveVersionId(defaultVersion.id);
    setSelectedVersionId(defaultVersion.id);
    setEditName(defaultVersion.name);
    setEditGeneratePrompt(defaultVersion.generatePrompt || '');
    setEditImprovePrompt(defaultVersion.improvePrompt || '');
    
    if (onSystemPromptChange) {
      onSystemPromptChange(defaultVersion);
    }
    
    setIsCreatingNew(false);
    setHasModifications(false);

    toast({
      title: 'Reset to Default',
      description: 'System prompt has been reset to the default version.',
    });
  };

  if (!isOpen) return null;

  const isDefault = selectedVersion?.isDefault ?? false;
  const isActive = selectedVersionId === activeVersionId && !isCreatingNew;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">System Prompt Settings</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4" style={{ scrollbarGutter: 'stable' }}>
          {/* Version Selector */}
          <div className="space-y-2">
            <Label>Select System Prompt Version</Label>
            <Select
              value={isCreatingNew ? CREATE_NEW_ID : selectedVersionId}
              onValueChange={handleVersionSelect}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Select a version" />
              </SelectTrigger>
              <SelectContent>
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
                  <div className="flex items-center gap-2 text-primary">
                    <Plus className="h-3 w-3" />
                    <span>Create New Version</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Version Actions - Delete, Reset to Default, Set as Active */}
          {!isCreatingNew && (
            <div className="flex items-center justify-end gap-2 pb-4 border-b">
              {/* Delete */}
              {!isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm({
                    isOpen: true,
                    versionId: selectedVersionId,
                    versionName: selectedVersion?.name || '',
                  })}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}

              {/* Reset to Default */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToDefault}
                disabled={activeVersionId === versions.find(v => v.isDefault)?.id}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>

              {/* Set as Active */}
              <Button
                variant={isActive ? 'secondary' : 'default'}
                size="sm"
                onClick={handleSetAsActive}
                disabled={isActive}
              >
                {isActive ? 'Currently Active' : 'Set as Active'}
              </Button>
            </div>
          )}

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="version-name">Name</Label>
            <Input
              id="version-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={isCreatingNew ? 'Enter version name...' : selectedVersion?.name}
              disabled={isDefault && !isCreatingNew}
              className={cn(
                isDefault && !isCreatingNew && 'opacity-60'
              )}
            />
          </div>

          {/* Generate Prompt Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="generate-prompt">Generate Prompt Instructions</Label>
              {hasModifications && !isCreatingNew && (
                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                  Modified
                </Badge>
              )}
            </div>
            <Textarea
              id="generate-prompt"
              value={editGeneratePrompt}
              onChange={(e) => setEditGeneratePrompt(e.target.value)}
              placeholder={isCreatingNew ? 'Enter system prompt for generating new prompts...' : 'System prompt for generating new prompts'}
              className={cn(
                'min-h-[150px] font-mono text-sm',
                isDefault && !isCreatingNew && 'opacity-60',
                hasModifications && !isCreatingNew && 'border-amber-300 dark:border-amber-700'
              )}
              disabled={isDefault && !isCreatingNew}
            />
            <p className="text-xs text-muted-foreground">
              Used when clicking "Generate Prompt" to create a new extraction prompt.
            </p>
          </div>

          {/* Improve Prompt Textarea */}
          <div className="space-y-2">
            <Label htmlFor="improve-prompt">Improve Prompt Instructions</Label>
            <Textarea
              id="improve-prompt"
              value={editImprovePrompt}
              onChange={(e) => setEditImprovePrompt(e.target.value)}
              placeholder={isCreatingNew ? 'Enter system prompt for improving prompts...' : 'System prompt for improving prompts'}
              className={cn(
                'min-h-[150px] font-mono text-sm',
                isDefault && !isCreatingNew && 'opacity-60',
                hasModifications && !isCreatingNew && 'border-amber-300 dark:border-amber-700'
              )}
              disabled={isDefault && !isCreatingNew}
            />
            <p className="text-xs text-muted-foreground">
              Used when clicking "Improve Prompt" to refine an existing prompt.
            </p>
          </div>

          {/* Info Box */}
          {isDefault && !isCreatingNew && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> The default system prompt cannot be modified. 
                Create a new version to customize the prompts.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 pt-4 border-t">
          {isCreatingNew ? (
            <Button
              onClick={handleSaveAsNew}
              disabled={!editName.trim()}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              Create Version
            </Button>
          ) : (
            !isDefault && (
              <Button
                variant={hasModifications ? 'default' : 'outline'}
                size="sm"
                onClick={handleUpdateCurrent}
                disabled={!hasModifications}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                Update Version
              </Button>
            )
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, versionId: '', versionName: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm.versionName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVersion}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

