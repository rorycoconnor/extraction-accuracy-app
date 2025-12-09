'use client';
import { logger } from '@/lib/logger';

import React, { useState, useMemo } from 'react';
import { AlertCircle, BookOpen, Plus, ChevronDown, MoreHorizontal, Download, Upload, Box, Trash2, Edit, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePromptLibrary } from '../hooks/use-prompt-library';
import { ALL_CATEGORIES, ALL_TEMPLATES } from '../types';
import { SearchBar } from './search-bar';
import { FieldCard } from './field-card';
import { ImportExportManager } from './import-export-manager';
import { AddCategoryDialog } from './add-category-dialog';
import { AddTemplateDialog } from './add-template-dialog';
import { AddFieldDialog } from './add-field-dialog';
import type { Template, Field, Prompt, FieldType } from '../types';
import { useToast } from '@/hooks/use-toast';
import { transformToBoxTemplate, validateBoxTemplate } from '../utils/box-transformer';
import { createMetadataTemplate, checkTemplateExists } from '@/services/box';
import { analyzeAndPushPrompts, type PushPromptsResult, type FieldMatch } from '../utils/apply-prompts';

export function PromptLibraryMain() {
  const { filteredFields, isLoading, error, database, searchFilters, setSelectedTemplate, addCategory, addTemplate, deleteTemplate, renameTemplate, addField, addPrompt, deletePrompt, reorderFields, batchImport } = usePromptLibrary();
  const { toast } = useToast();

  // Generate dynamic title based on current filters
  const getDisplayTitle = () => {
    const hasSearch = searchFilters.searchTerm.trim() !== '';
    const hasCategory = searchFilters.category && searchFilters.category !== ALL_CATEGORIES;
    const hasTemplate = searchFilters.template && searchFilters.template !== ALL_TEMPLATES;
    
    if (hasSearch) {
      return `${filteredFields.length} items showing`;
    }
    
    if (hasTemplate) {
      const template = database.templates.find(t => t.id === searchFilters.template);
      return template ? template.name : 'All Fields';
    }
    
    if (hasCategory) {
      return searchFilters.category;
    }
    
    return 'All Fields';
  };

  // Get currently selected template
  const getSelectedTemplate = (): Template | null => {
    if (searchFilters.template && searchFilters.template !== ALL_TEMPLATES) {
      return database.templates.find(t => t.id === searchFilters.template) || null;
    }
    return null;
  };
  
    // Dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  
  // Box template creation state
  const [createBoxTemplateDialogOpen, setCreateBoxTemplateDialogOpen] = useState(false);
  const [isCreatingBoxTemplate, setIsCreatingBoxTemplate] = useState(false);

  // Delete template state
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);

  // Rename template state
  const [renameTemplateDialogOpen, setRenameTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Import/Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Push to Prompt Studio state
  const [pushPromptsDialogOpen, setPushPromptsDialogOpen] = useState(false);
  const [pushPromptsPreview, setPushPromptsPreview] = useState<PushPromptsResult | null>(null);
  const [isPushingPrompts, setIsPushingPrompts] = useState(false);

  if (error) {
    return (
      <div className="flex-1 p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }



  // Handle template deletion
  const handleDeleteTemplate = () => {
    const selectedTemplate = getSelectedTemplate();
    if (!selectedTemplate) return;

    deleteTemplate(selectedTemplate.id);
    // Reset template filter to "All" after deletion
    setSelectedTemplate(null);
    setDeleteTemplateDialogOpen(false);
  };

  // Handle template rename
  const handleRenameTemplate = () => {
    const selectedTemplate = getSelectedTemplate();
    if (!selectedTemplate || !newTemplateName.trim()) return;

    renameTemplate(selectedTemplate.id, newTemplateName.trim());
    setRenameTemplateDialogOpen(false);
    setNewTemplateName('');
  };

  const handleOpenRenameDialog = () => {
    const selectedTemplate = getSelectedTemplate();
    if (selectedTemplate) {
      setNewTemplateName(selectedTemplate.name);
      setRenameTemplateDialogOpen(true);
    }
  };

  // Handle Box template creation
  const handleCreateBoxTemplate = async () => {
    const selectedTemplate = getSelectedTemplate();
    if (!selectedTemplate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No template selected.',
      });
      return;
    }

    setIsCreatingBoxTemplate(true);

    try {
      // First check if template already exists in Box
      const exists = await checkTemplateExists(selectedTemplate.name);
      
      if (exists) {
        toast({
          variant: 'destructive',
          title: 'Template Already Exists',
          description: `A template named "${selectedTemplate.name}" already exists in Box. Please rename your template or use a different name.`,
        });
        setIsCreatingBoxTemplate(false);
        setCreateBoxTemplateDialogOpen(false);
        return;
      }

      // Transform the template to Box API format
      const boxTemplate = transformToBoxTemplate(selectedTemplate);

      // Validate the template
      if (!validateBoxTemplate(boxTemplate)) {
        const errors = boxTemplate._validation?.errors || [];
        toast({
          variant: 'destructive',
          title: 'Template Validation Failed',
          description: `Template has validation errors: ${errors.join(', ')}`,
        });
        setIsCreatingBoxTemplate(false);
        setCreateBoxTemplateDialogOpen(false);
        return;
      }

      // Create the template in Box
      const createdTemplate = await createMetadataTemplate(boxTemplate);

      toast({
        title: 'Template Created Successfully',
        description: `Template "${selectedTemplate.name}" has been created in Box with key "${createdTemplate.templateKey}".`,
        duration: 4000,
      });

      logger.info('Box template created', { template: createdTemplate });
      
    } catch (error) {
      logger.error('Failed to create Box template', error instanceof Error ? error : { error });
      toast({
        variant: 'destructive',
        title: 'Failed to Create Template',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while creating the template in Box.',
      });
    } finally {
      setIsCreatingBoxTemplate(false);
      setCreateBoxTemplateDialogOpen(false);
    }
  };

  // Handle opening push prompts dialog with preview
  const handleOpenPushPromptsDialog = () => {
    const selectedTemplate = getSelectedTemplate();
    if (!selectedTemplate) {
      toast({
        variant: 'destructive',
        title: 'No Template Selected',
        description: 'Please select a template first.',
      });
      return;
    }

    // Get preview (dry run)
    const preview = analyzeAndPushPrompts(selectedTemplate, true);
    setPushPromptsPreview(preview);
    setPushPromptsDialogOpen(true);
  };

  // Handle actually pushing the prompts
  const handlePushPrompts = async () => {
    const selectedTemplate = getSelectedTemplate();
    if (!selectedTemplate || !pushPromptsPreview?.matchedTemplate) {
      return;
    }

    setIsPushingPrompts(true);

    try {
      // Execute the push (not dry run)
      const result = analyzeAndPushPrompts(selectedTemplate, false);

      if (result.success && result.pushedCount > 0) {
        toast({
          title: 'Prompts Pushed Successfully',
          description: `${result.pushedCount} prompt(s) have been pushed to Prompt Studio for template "${result.matchedTemplate?.displayName}".`,
          duration: 4000,
        });
        logger.info('Prompts pushed to Prompt Studio', { 
          template: selectedTemplate.name,
          pushedCount: result.pushedCount 
        });
      } else if (result.errorMessage) {
        toast({
          variant: 'destructive',
          title: 'Push Failed',
          description: result.errorMessage,
        });
      }
    } catch (error) {
      logger.error('Failed to push prompts', error instanceof Error ? error : { error });
      toast({
        variant: 'destructive',
        title: 'Push Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsPushingPrompts(false);
      setPushPromptsDialogOpen(false);
      setPushPromptsPreview(null);
    }
  };

  // Get available templates based on current category filter
  const availableTemplatesForField = React.useMemo(() => {
    if (searchFilters.category && searchFilters.category !== ALL_CATEGORIES) {
      return database.templates.filter(t => t.category === searchFilters.category);
    }
    return database.templates;
  }, [database.templates, searchFilters.category]);

  const fieldTypes = ['text', 'number', 'date', 'dropdown_single', 'dropdown_multi', 'taxonomy'];

  return (
    <div className="max-w-full">
      <div className="space-y-6">
        {/* Header - matches Templates page */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Library
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Curate and manage templates, prompts and prompt versions
            </p>
          </div>
          
          <div className="flex gap-2">
            {/* New + Dropdown Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-1.5 h-4 w-4" />
                  New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCategoryDialogOpen(true)}>
                  Category
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTemplateDialogOpen(true)}>
                  Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFieldDialogOpen(true)}>
                  Field
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* More (Import/Export) Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="px-3">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Template
                </DropdownMenuItem>
                
                {/* Template-specific actions - only show when template is selected */}
                {getSelectedTemplate() && (
                  <>
                    <DropdownMenuItem className="p-0">
                      <div className="w-full h-px bg-gray-200 my-1" />
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenRenameDialog}>
                      <Edit className="mr-2 h-4 w-4" />
                      Rename Template
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteTemplateDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Template
                    </DropdownMenuItem>
                    <DropdownMenuItem className="p-0">
                      <div className="w-full h-px bg-gray-200 my-1" />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setCreateBoxTemplateDialogOpen(true)}
                    >
                      <Box className="mr-2 h-4 w-4" />
                      Create Template in Box
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleOpenPushPromptsDialog}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Push Prompts to Prompt Studio
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        <SearchBar />

        {/* Dynamic Title */}
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100" style={{paddingLeft: '22px'}}>
            {getDisplayTitle()}
          </h2>
        </div>

        {/* Content Area */}
        <div>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading prompt library...</p>
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No fields found</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  Try adjusting your search or filter criteria to find relevant fields and prompts.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredFields.map(({ template, field }) => (
                <FieldCard
                  key={`${template.id}-${field.id}-${field.name}`}
                  field={field}
                  template={template}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CRUD Dialogs */}
      <AddCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        addCategory={addCategory}
      />

      <AddTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        categories={database.categories}
        addTemplate={addTemplate}
      />

      <AddFieldDialog
        open={fieldDialogOpen}
        onOpenChange={setFieldDialogOpen}
        availableTemplates={database.templates}
        addField={addField}
      />

      {/* Create Box Template Dialog */}
      <AlertDialog open={createBoxTemplateDialogOpen} onOpenChange={setCreateBoxTemplateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Template in Box</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to create the template "{getSelectedTemplate()?.name}" in Box?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCreateBoxTemplateDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateBoxTemplate} disabled={isCreatingBoxTemplate}>
              {isCreatingBoxTemplate ? 'Creating...' : 'Create Template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
              </AlertDialog>

        {/* Delete Template Dialog */}
        <AlertDialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{getSelectedTemplate()?.name}"? 
                This action cannot be undone and will remove all fields and prompts in this template.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteTemplateDialogOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteTemplate}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Template
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Rename Template Dialog */}
        <AlertDialog open={renameTemplateDialogOpen} onOpenChange={setRenameTemplateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rename Template</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="bg-white dark:bg-gray-800 h-11"
                placeholder="Enter template name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRenameTemplate();
                  }
                }}
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setRenameTemplateDialogOpen(false);
                setNewTemplateName('');
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleRenameTemplate}
                disabled={!newTemplateName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Rename Template
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import/Export Manager */}
      <ImportExportManager
        database={database}
        addCategory={addCategory}
        addTemplate={addTemplate}
        addField={addField}
        addPrompt={addPrompt}
        batchImport={batchImport}
        exportDialogOpen={exportDialogOpen}
        setExportDialogOpen={setExportDialogOpen}
        importDialogOpen={importDialogOpen}
        setImportDialogOpen={setImportDialogOpen}
      />

      {/* Push Prompts to Prompt Studio Dialog */}
      <Dialog open={pushPromptsDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPushPromptsDialogOpen(false);
          setPushPromptsPreview(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Push Prompts to Prompt Studio
            </DialogTitle>
            <DialogDescription>
              {pushPromptsPreview?.matchedTemplate 
                ? `Push prompts from "${getSelectedTemplate()?.name}" to "${pushPromptsPreview.matchedTemplate.displayName}" in Prompt Studio.`
                : `Looking for a matching template in Prompt Studio...`
              }
            </DialogDescription>
          </DialogHeader>

          {pushPromptsPreview && (
            <div className="space-y-4 py-4">
              {/* Error state */}
              {pushPromptsPreview.errorMessage && !pushPromptsPreview.matchedTemplate && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{pushPromptsPreview.errorMessage}</AlertDescription>
                </Alert>
              )}

              {/* Success preview */}
              {pushPromptsPreview.matchedTemplate && (
                <>
                  {/* Summary */}
                  <div className="flex gap-4 text-sm">
                    <div className="flex-1 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="font-semibold text-green-700 dark:text-green-300">{pushPromptsPreview.fieldMatches.length}</div>
                      <div className="text-green-600 dark:text-green-400">Fields to Update</div>
                    </div>
                    {pushPromptsPreview.unmatchedFields.length > 0 && (
                      <div className="flex-1 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="font-semibold text-yellow-700 dark:text-yellow-300">{pushPromptsPreview.unmatchedFields.length}</div>
                        <div className="text-yellow-600 dark:text-yellow-400">Fields Skipped</div>
                      </div>
                    )}
                  </div>

                  {/* Fields to update */}
                  {pushPromptsPreview.fieldMatches.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Fields to Update:</Label>
                      <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                        {pushPromptsPreview.fieldMatches.map((match, idx) => (
                          <div key={idx} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm">{match.libraryField.name}</div>
                              <div className="text-xs text-gray-500">→ {match.boxField.displayName}</div>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              "{match.selectedPrompt.text.substring(0, 100)}{match.selectedPrompt.text.length > 100 ? '...' : ''}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unmatched fields */}
                  {pushPromptsPreview.unmatchedFields.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Skipped Fields:</Label>
                      <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg divide-y max-h-32 overflow-y-auto bg-yellow-50/50 dark:bg-yellow-950/50">
                        {pushPromptsPreview.unmatchedFields.map((item, idx) => (
                          <div key={idx} className="p-2 text-sm">
                            <span className="font-medium">{item.field.name}</span>
                            <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">
                              ({item.reason === 'no-match-in-box' ? 'No matching field in Prompt Studio' : 'No prompts available'})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setPushPromptsDialogOpen(false);
                setPushPromptsPreview(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePushPrompts}
              disabled={isPushingPrompts || !pushPromptsPreview?.matchedTemplate || pushPromptsPreview.fieldMatches.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPushingPrompts ? 'Pushing...' : `Push ${pushPromptsPreview?.fieldMatches.length || 0} Prompt(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 