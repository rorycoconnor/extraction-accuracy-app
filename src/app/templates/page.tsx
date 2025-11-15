'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAccuracyDataCompat } from '@/store/AccuracyDataStore';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BoxTemplate, BoxTemplateField, AccuracyField } from '@/lib/types';
import type { CompareType, CompareTypeConfig, FieldCompareConfig } from '@/lib/compare-types';
import {
  COMPARE_TYPE_LABELS,
  COMPARE_TYPE_DESCRIPTIONS,
  COMPARE_TYPE_CATEGORIES,
  CONFIGURABLE_COMPARE_TYPES,
  DEFAULT_LLM_COMPARISON_PROMPT,
} from '@/lib/compare-types';
import {
  getOrCreateCompareTypeConfig,
  setCompareType as setCompareTypeStorage,
  setCompareParameters as setCompareParametersStorage,
  exportCompareTypeConfig,
  importAndSaveCompareTypeConfig,
  resetToDefaults,
} from '@/lib/compare-type-storage';
import {
  PlusCircle,
  Terminal,
  Trash2,
  MoreVertical,
  Settings2,
  Wand2,
  Download,
  Upload,
  RotateCcw,
  Info,
} from 'lucide-react';
import NewTemplateDialog from '@/components/new-template-dialog';
import PromptStudioSheet from '@/components/prompt-studio-sheet';
import {
  addConfiguredTemplates,
  getConfiguredTemplates,
  removeConfiguredTemplate,
  toggleTemplateFieldActive,
} from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

export default function TemplatesPage() {
  const { toast } = useToast();
  const compatData = useAccuracyDataCompat();
  const [configuredTemplates, setConfiguredTemplates] = useState<BoxTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BoxTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<BoxTemplate | null>(null);

  // Compare Types state
  const [compareTypeConfig, setCompareTypeConfig] = useState<CompareTypeConfig | null>(null);
  const [isParametersModalOpen, setIsParametersModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldCompareConfig | null>(null);
  const [parametersFormData, setParametersFormData] = useState<{
    comparisonPrompt?: string;
    separator?: string;
  }>({});

  // Prompt Studio state
  const [isPromptStudioOpen, setIsPromptStudioOpen] = useState(false);
  const [selectedFieldForPromptStudio, setSelectedFieldForPromptStudio] = useState<AccuracyField | null>(null);

  // Import/Export state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Load configured templates
  useEffect(() => {
    const templates = getConfiguredTemplates();
    setConfiguredTemplates(templates);
    
    // Auto-select first template if available
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0]);
    }
    
    setIsLoading(false);
  }, []);

  // Load compare type config when template changes
  useEffect(() => {
    if (!selectedTemplate) {
      setCompareTypeConfig(null);
      return;
    }

    try {
      const config = getOrCreateCompareTypeConfig(selectedTemplate);
      setCompareTypeConfig(config);
      setError(null);
    } catch (err) {
      logger.error('Failed to load compare type config', err as Error);
      setError('Failed to load compare type configuration');
    }
  }, [selectedTemplate]);

  const handleAddTemplates = (newTemplates: BoxTemplate[]) => {
    addConfiguredTemplates(newTemplates);
    const updated = getConfiguredTemplates();
    setConfiguredTemplates(updated);
    
    // Auto-select first new template
    if (newTemplates.length > 0) {
      setSelectedTemplate(newTemplates[0]);
    }
  };

  const handleRemoveTemplate = (template: BoxTemplate) => {
    setTemplateToDelete(template);
  };

  const confirmDeleteTemplate = () => {
    if (templateToDelete) {
      removeConfiguredTemplate(templateToDelete.id);
      const updated = getConfiguredTemplates();
      setConfiguredTemplates(updated);
      
      // If we deleted the selected template, select another one
      if (selectedTemplate?.id === templateToDelete.id) {
        setSelectedTemplate(updated.length > 0 ? updated[0] : null);
      }
      
      setTemplateToDelete(null);
    }
  };

  const cancelDeleteTemplate = () => {
    setTemplateToDelete(null);
  };
  
  const handleToggleField = (templateId: string, fieldId: string) => {
    toggleTemplateFieldActive(templateId, fieldId);
    const updated = getConfiguredTemplates();
    setConfiguredTemplates(updated);
    
    // Update selected template to reflect changes
    if (selectedTemplate?.id === templateId) {
      const updatedTemplate = updated.find(t => t.id === templateId);
      if (updatedTemplate) {
        setSelectedTemplate(updatedTemplate);
      }
    }
  };

  const handleSelectTemplate = (template: BoxTemplate) => {
    setSelectedTemplate(template);
  };

  // Handle compare type change
  const handleCompareTypeChange = (fieldKey: string, compareType: CompareType) => {
    if (!selectedTemplate) return;

    try {
      setCompareTypeStorage(selectedTemplate.templateKey, fieldKey, compareType);

      // Reload config
      const updatedConfig = getOrCreateCompareTypeConfig(selectedTemplate);
      setCompareTypeConfig(updatedConfig);

      toast({
        title: 'Compare Type Updated',
        description: `Compare type set to "${COMPARE_TYPE_LABELS[compareType]}"`,
      });
    } catch (err) {
      logger.error('Failed to update compare type', err as Error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update compare type. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle configure button click
  const handleConfigureClick = (field: FieldCompareConfig) => {
    setSelectedField(field);
    setParametersFormData({
      comparisonPrompt: field.parameters?.comparisonPrompt || DEFAULT_LLM_COMPARISON_PROMPT,
      separator: field.parameters?.separator || ',',
    });
    setIsParametersModalOpen(true);
  };

  // Handle parameters save
  const handleSaveParameters = () => {
    if (!selectedTemplate || !selectedField) return;

    try {
      setCompareParametersStorage(
        selectedTemplate.templateKey,
        selectedField.fieldKey,
        parametersFormData
      );

      // Reload config
      const updatedConfig = getOrCreateCompareTypeConfig(selectedTemplate);
      setCompareTypeConfig(updatedConfig);

      toast({
        title: 'Parameters Updated',
        description: 'Comparison parameters saved successfully.',
      });

      setIsParametersModalOpen(false);
    } catch (err) {
      logger.error('Failed to save parameters', err as Error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save parameters. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle Prompt Studio open
  const handleOpenPromptStudio = (field: BoxTemplateField) => {
    // Find the field in accuracy data to get the actual prompt
    const accuracyDataField = compatData?.accuracyData?.fields?.find(f => f.key === field.key);
    
    // Convert BoxTemplateField to AccuracyField for Prompt Studio
    const accuracyField: AccuracyField = {
      name: field.displayName,
      key: field.key,
      type: field.type === 'enum' ? 'enum' : field.type,
      prompt: accuracyDataField?.prompt || '',
      templatePrompt: accuracyDataField?.templatePrompt || '',
      promptHistory: accuracyDataField?.promptHistory || [],
      options: field.options,
    };
    
    setSelectedFieldForPromptStudio(accuracyField);
    setIsPromptStudioOpen(true);
  };

  // Handle export
  const handleExport = () => {
    if (!selectedTemplate) {
      toast({
        title: 'No Template Selected',
        description: 'Please select a template to export.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const jsonString = exportCompareTypeConfig(selectedTemplate.templateKey);

      // Download file
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedTemplate.templateKey}-compare-config-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: 'Compare type configuration exported.',
      });
    } catch (err) {
      logger.error('Export failed', err as Error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export configuration.',
        variant: 'destructive',
      });
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a JSON file to import.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const jsonString = await importFile.text();
      const importedConfig = importAndSaveCompareTypeConfig(jsonString);

      // Check if template matches
      if (selectedTemplate && importedConfig.templateKey !== selectedTemplate.templateKey) {
        toast({
          title: 'Template Mismatch',
          description: `Imported config is for "${importedConfig.templateKey}". Select that template to view the configuration.`,
        });
      }

      // Reload config
      if (selectedTemplate) {
        const updatedConfig = getOrCreateCompareTypeConfig(selectedTemplate);
        setCompareTypeConfig(updatedConfig);
      }

      toast({
        title: 'Import Successful',
        description: `Configuration imported with ${importedConfig.fields.length} fields.`,
      });

      setIsImportDialogOpen(false);
      setImportFile(null);
    } catch (err) {
      logger.error('Import failed', err as Error);
      toast({
        title: 'Import Failed',
        description: err instanceof Error ? err.message : 'Failed to import configuration.',
        variant: 'destructive',
      });
    }
  };

  // Handle reset to defaults
  const handleResetToDefaults = () => {
    if (!selectedTemplate) return;

    try {
      resetToDefaults(selectedTemplate);

      // Reload config
      const updatedConfig = getOrCreateCompareTypeConfig(selectedTemplate);
      setCompareTypeConfig(updatedConfig);

      toast({
        title: 'Reset to Defaults',
        description: 'Compare type configuration reset to default values.',
      });
    } catch (err) {
      logger.error('Reset failed', err as Error);
      toast({
        title: 'Reset Failed',
        description: 'Failed to reset configuration.',
        variant: 'destructive',
      });
    }
  };

  const renderLeftPanel = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      );
    }

    if (configuredTemplates.length === 0) {
        return (
        <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground p-4">
          <Info className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm">No templates configured</p>
          <p className="text-xs">Click "New Template" to get started</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-1">
          {configuredTemplates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const activeFieldCount = template.fields.filter(f => f.isActive !== false).length;
            
            return (
              <div
                key={template.id}
                      className={cn(
                  'group relative flex items-center justify-between p-3 rounded-md cursor-pointer transition-all',
                  isSelected
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted/50 border border-transparent'
                )}
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'font-medium truncate text-sm',
                    isSelected ? 'text-primary' : 'text-foreground'
                  )}>
                    {template.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeFieldCount} active field{activeFieldCount !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Template options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTemplate(template);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  const renderRightPanel = () => {
    if (!selectedTemplate) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <Settings2 className="h-16 w-16 mb-4 opacity-20" />
          <h3 className="text-lg font-medium mb-2">No Template Selected</h3>
          <p className="text-sm">Select a template from the left to configure fields</p>
        </div>
      );
    }

    if (!compareTypeConfig || compareTypeConfig.fields.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <Info className="h-16 w-16 mb-4 opacity-20" />
          <h3 className="text-lg font-medium mb-2">No Fields Configured</h3>
          <p className="text-sm">This template has no active fields</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetToDefaults}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Fields table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">Metadata Field</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead className="w-[200px]">Compare Type</TableHead>
                <TableHead className="w-[140px]">Parameters</TableHead>
                <TableHead className="w-[140px] text-right">Prompt Studio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedTemplate.fields.map((field) => {
                const compareField = compareTypeConfig.fields.find(cf => cf.fieldKey === field.key);
                if (!compareField) return null;

                const showConfigureButton = CONFIGURABLE_COMPARE_TYPES.includes(compareField.compareType);
                const isActive = field.isActive !== false;

                // Map Box field types to display names
                const getBoxTypeName = (type: string): string => {
                  const typeMap: Record<string, string> = {
                    'string': 'Text',
                    'enum': 'Dropdown',
                    'multiSelect': 'Dropdown - Multi Value',
                    'number': 'Number',
                    'float': 'Number',
                    'date': 'Date',
                  };
                  return typeMap[type] || type;
                };

                return (
                  <TableRow key={field.id}>
                    <TableCell className="w-[240px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => handleToggleField(selectedTemplate.id, field.id)}
                        />
                        <span className={cn(
                          'font-medium truncate',
                          !isActive && 'text-muted-foreground'
                        )}>
                      {field.displayName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <Badge variant="outline" className="font-normal">
                        {getBoxTypeName(field.type)}
                    </Badge>
                    </TableCell>
                    <TableCell className="w-[200px]">
                      <Select
                        value={compareField.compareType}
                        onValueChange={(value) => handleCompareTypeChange(field.key, value as CompareType)}
                        disabled={!isActive}
                      >
                        <SelectTrigger className="w-full text-left">
                          <SelectValue className="truncate" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(COMPARE_TYPE_CATEGORIES).map(([category, types]) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                {category}
                              </div>
                              {types.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {COMPARE_TYPE_LABELS[type]}
                                </SelectItem>
                ))}
              </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="w-[140px]">
                      {showConfigureButton && isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigureClick(compareField)}
                        >
                          <Settings2 className="mr-2 h-3 w-3" />
                          Configure
                        </Button>
                      )}
            </TableCell>
                    <TableCell className="w-[140px] text-right">
                      {isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPromptStudio(field)}
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          Open
                </Button>
                      )}
            </TableCell>
          </TableRow>
                );
              })}
      </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Manage your metadata templates and configure field comparison settings.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          {/* Left Panel - Template List */}
          <Card className="col-span-2 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Templates</CardTitle>
                <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                  Add
              </Button>
              </div>
              <CardDescription className="text-xs">
                Select a template to configure
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {renderLeftPanel()}
            </CardContent>
          </Card>

          {/* Right Panel - Field Configuration */}
          <Card className="col-span-10 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedTemplate ? `${selectedTemplate.displayName} - Fields` : 'Field Configuration'}
              </CardTitle>
              <CardDescription className="text-xs">
                Configure metadata fields, comparison types, and prompts
              </CardDescription>
          </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {renderRightPanel()}
          </CardContent>
        </Card>
        </div>
      </div>

      {/* New Template Dialog */}
      <NewTemplateDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onAddTemplates={handleAddTemplates}
        existingTemplates={configuredTemplates}
      />
      
      {/* Delete Template Confirmation */}
      <AlertDialog open={!!templateToDelete} onOpenChange={cancelDeleteTemplate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.displayName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteTemplate}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Parameters Configuration Modal */}
      <Dialog open={isParametersModalOpen} onOpenChange={setIsParametersModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Parameters</DialogTitle>
            <DialogDescription>
              {selectedField && (
                <>
                  Configure parameters for <strong>{selectedField.fieldName}</strong> (
                  {COMPARE_TYPE_LABELS[selectedField.compareType]})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedField?.compareType === 'llm-judge' && (
              <div className="space-y-2">
                <Label htmlFor="comparison-prompt">Comparison Prompt</Label>
                <Textarea
                  id="comparison-prompt"
                  value={parametersFormData.comparisonPrompt || ''}
                  onChange={(e) =>
                    setParametersFormData({
                      ...parametersFormData,
                      comparisonPrompt: e.target.value,
                    })
                  }
                  rows={6}
                  placeholder="Enter custom comparison criteria..."
                />
                <p className="text-xs text-muted-foreground">
                  Describe how the LLM should compare values. Focus on semantic meaning, not exact phrasing.
                </p>
              </div>
            )}
            {(selectedField?.compareType === 'list-ordered' ||
              selectedField?.compareType === 'list-unordered') && (
              <div className="space-y-2">
                <Label htmlFor="separator">List Separator</Label>
                <Input
                  id="separator"
                  value={parametersFormData.separator || ','}
                  onChange={(e) =>
                    setParametersFormData({
                      ...parametersFormData,
                      separator: e.target.value,
                    })
                  }
                  placeholder=","
                />
                <p className="text-xs text-muted-foreground">
                  Character used to separate list items (default: comma)
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsParametersModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveParameters}>Save Parameters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Compare Type Configuration</DialogTitle>
            <DialogDescription>
              Upload a JSON file to import compare type configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Configuration File (JSON)</Label>
              <Input
                id="import-file"
                type="file"
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt Studio Sheet */}
      <PromptStudioSheet
        isOpen={isPromptStudioOpen}
        onClose={() => setIsPromptStudioOpen(false)}
        field={selectedFieldForPromptStudio}
        templateName={selectedTemplate?.displayName}
        onUpdatePrompt={(fieldKey: string, newPrompt: string) => {
          if (compatData?.updatePrompt) {
            compatData.updatePrompt(fieldKey, newPrompt);
          }
        }}
        onUsePromptVersion={() => {}}
        onToggleFavorite={() => {}}
        onDeletePromptVersion={() => {}}
        selectedFileIds={compatData?.accuracyData?.results?.map(r => r.id) ?? []}
        accuracyData={compatData?.accuracyData ?? null}
        shownColumns={compatData?.shownColumns ?? {}}
      />
    </>
  );
}
