'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { getConfiguredTemplates } from '@/lib/mock-data';
import type { BoxTemplate } from '@/lib/types';
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
  Settings2,
  Download,
  Upload,
  RotateCcw,
  Terminal,
  Info,
} from 'lucide-react';

export default function CompareTypesPage() {
  const { toast } = useToast();

  // State
  const [configuredTemplates, setConfiguredTemplates] = useState<BoxTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BoxTemplate | null>(null);
  const [compareTypeConfig, setCompareTypeConfig] = useState<CompareTypeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isParametersModalOpen, setIsParametersModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldCompareConfig | null>(null);
  const [parametersFormData, setParametersFormData] = useState<{
    comparisonPrompt?: string;
    separator?: string;
  }>({});

  // Import/Export state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Load configured templates
  useEffect(() => {
    const templates = getConfiguredTemplates();
    setConfiguredTemplates(templates);

    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0]);
    }
  }, []);

  // Load compare type config when template changes
  useEffect(() => {
    if (!selectedTemplate) {
      setCompareTypeConfig(null);
      return;
    }

    try {
      setIsLoading(true);
      const config = getOrCreateCompareTypeConfig(selectedTemplate);
      setCompareTypeConfig(config);
      setError(null);
    } catch (err) {
      logger.error('Failed to load compare type config', err as Error);
      setError('Failed to load compare type configuration');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTemplate]);

  // Handle template selection
  const handleTemplateChange = (templateKey: string) => {
    const template = configuredTemplates.find((t) => t.templateKey === templateKey);
    if (template) {
      setSelectedTemplate(template);
    }
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

  // Render table content
  const renderTableContent = () => {
    if (isLoading) {
      return [...Array(5)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-10 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-10 w-24" />
          </TableCell>
        </TableRow>
      ));
    }

    if (error) {
      return (
        <TableRow>
          <TableCell colSpan={3}>
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </TableCell>
        </TableRow>
      );
    }

    if (!selectedTemplate) {
      return (
        <TableRow>
          <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Settings2 className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-lg font-medium">No Template Selected</div>
              <div className="text-sm">
                Select a template from the dropdown above to configure compare types.
              </div>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    if (!compareTypeConfig || compareTypeConfig.fields.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Info className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-lg font-medium">No Fields Configured</div>
              <div className="text-sm">
                This template has no active fields.
              </div>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    return compareTypeConfig.fields.map((field) => {
      const showConfigureButton = CONFIGURABLE_COMPARE_TYPES.includes(field.compareType);

      return (
        <TableRow key={field.fieldKey}>
          <TableCell className="font-medium">{field.fieldName}</TableCell>
          <TableCell>
            <Select
              value={field.compareType}
              onValueChange={(value) => handleCompareTypeChange(field.fieldKey, value as CompareType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPARE_TYPE_CATEGORIES).map(([category, types]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {category}
                    </div>
                    {types.map((type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex flex-col">
                          <span>{COMPARE_TYPE_LABELS[type]}</span>
                          <span className="text-xs text-muted-foreground">
                            {COMPARE_TYPE_DESCRIPTIONS[type]}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            {showConfigureButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfigureClick(field)}
              >
                <Settings2 className="mr-2 h-3 w-3" />
                Configure
              </Button>
            )}
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Compare Types Configuration
          </h1>
          <p className="text-muted-foreground">
            Configure how each field is compared during accuracy validation.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <Label htmlFor="template-select">Template</Label>
                <Select
                  value={selectedTemplate?.templateKey}
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger id="template-select" className="w-full mt-2">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {configuredTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.templateKey}>
                        {template.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Field Name</TableHead>
                    <TableHead className="w-[55%]">Compare Type</TableHead>
                    <TableHead className="w-[15%] text-right pr-8">Parameters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderTableContent()}</TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  Describe how the LLM should compare values. Focus on semantic meaning, not exact
                  phrasing.
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
    </>
  );
}
