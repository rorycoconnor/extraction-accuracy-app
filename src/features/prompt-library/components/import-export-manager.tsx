'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { exportTemplatesToCSV, parseImportCSV, validateImportData, downloadCSV, parseOptionsFromCSV } from '../utils/csv-import-export';
import type { Database, Template, Field, Prompt, FieldType } from '../types';

interface ImportExportManagerProps {
  database: Database;
  addCategory: (categoryName: string) => void;
  addTemplate: (templateName: string, categoryName: string) => void;
  addField: (templateId: string, fieldName: string, fieldType: string) => void;
  addPrompt: (templateId: string, fieldId: string, promptText: string, createdAtOverride?: number) => void;
  batchImport: (importData: { categories: string[], templates: Template[] }) => void;
  exportDialogOpen: boolean;
  setExportDialogOpen: (open: boolean) => void;
  importDialogOpen: boolean;
  setImportDialogOpen: (open: boolean) => void;
}

interface FieldWithImportData extends Field {
  csvPrompts: string[];
  csvOrder?: number;
}

export function ImportExportManager({
  database,
  addCategory,
  addTemplate,
  addField,
  addPrompt,
  batchImport,
  exportDialogOpen,
  setExportDialogOpen,
  importDialogOpen,
  setImportDialogOpen
}: ImportExportManagerProps) {
  const { toast } = useToast();

  // Import/Export state
  const [selectedTemplatesForExport, setSelectedTemplatesForExport] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importCategory, setImportCategory] = useState('');
  const [importTemplateName, setImportTemplateName] = useState('');
  const [newImportCategoryName, setNewImportCategoryName] = useState('');
  const [newImportTemplateName, setNewImportTemplateName] = useState('');

  // Refs for auto-focusing inputs
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  const newTemplateInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus new category input when it appears
  useEffect(() => {
    if (importCategory === '__new_category__' && newCategoryInputRef.current) {
      // Small delay to ensure Select dropdown has closed
      setTimeout(() => {
        newCategoryInputRef.current?.focus();
      }, 100);
    }
  }, [importCategory]);

  // Auto-focus new template input when it appears
  useEffect(() => {
    if (importTemplateName === '__new_template__' && newTemplateInputRef.current) {
      // Small delay to ensure Select dropdown has closed
      setTimeout(() => {
        newTemplateInputRef.current?.focus();
      }, 100);
    }
  }, [importTemplateName]);

  const handleExportTemplates = () => {
    if (selectedTemplatesForExport.length === 0) {
      toast({
        title: 'No Templates Selected',
        description: 'Please select at least one template to export.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const csvContent = exportTemplatesToCSV(database, selectedTemplatesForExport);
      const filename = `prompt-library-templates-${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csvContent, filename);
      
      toast({
        title: 'Export Complete',
        description: `Successfully exported ${selectedTemplatesForExport.length === 1 && selectedTemplatesForExport[0] === 'all' ? database.templates.length : selectedTemplatesForExport.length} template(s) to CSV.`,
      });
      
      setExportDialogOpen(false);
      setSelectedTemplatesForExport([]);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export templates. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleImportTemplates = async () => {
    if (!csvFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to import.',
        variant: 'destructive',
      });
      return;
    }

    const finalCategory = importCategory === '__new_category__' ? newImportCategoryName : importCategory;
    
    if (!finalCategory) {
      toast({
        title: 'Category Required',
        description: 'Please select or create a category.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Read file with explicit UTF-8 encoding to handle special characters properly
      const csvText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(e.target.result as string);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        // Explicitly read as UTF-8 text
        reader.readAsText(csvFile, 'UTF-8');
      });
      
      const parsedData = parseImportCSV(csvText);
      
      if (parsedData.length === 0) {
        toast({
          title: 'No Data Found',
          description: 'The CSV file appears to be empty or invalid.',
          variant: 'destructive',
        });
        return;
      }

      const validationResult = validateImportData(parsedData);
      if (!validationResult.valid) {
        toast({
          title: 'Invalid Data',
          description: validationResult.errors[0],
          variant: 'destructive',
        });
        return;
      }

      const finalTemplateName = importTemplateName === '__new_template__' ? newImportTemplateName : importTemplateName;
      
      // Process import - add category if it's new
      if (importCategory === '__new_category__' && finalCategory) {
        addCategory(finalCategory);
      }

      // Build complete template structure first (avoid React timing issues)
      const templateMap = new Map<string, {
        template: Template;
        fieldsMap: Map<string, FieldWithImportData>;
      }>();

      // Group data by template
      for (const row of parsedData) {
        const templateName = finalTemplateName || row.templateName;
        if (!templateName || !row.fieldName) continue;

        const templateKey = `${finalCategory}:${templateName}`;
        
        if (!templateMap.has(templateKey)) {
          // Create template structure for import (don't reference existing templates)
          const templateId = `import-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const templateStructure = {
            id: templateId,
            name: templateName,
            category: finalCategory,
            fields: []
          };
          
          templateMap.set(templateKey, {
            template: templateStructure,
            fieldsMap: new Map()
          });
        }

        const templateData = templateMap.get(templateKey)!;
        
        // Parse options from CSV
        const parsedOptions = parseOptionsFromCSV(row.options);

        // Add field if it doesn't exist, or update existing field
        if (!templateData.fieldsMap.has(row.fieldName)) {
          // Create new field with csvPrompts and order
          const fieldId = `import-field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newField: FieldWithImportData = {
            id: fieldId,
            name: row.fieldName,
            type: (row.fieldType as FieldType) || 'text',
            prompts: [],
            csvPrompts: [],
            csvOrder: row.fieldOrder,
            // Add options for dropdown/taxonomy fields
            options: parsedOptions.length > 0 ? parsedOptions : undefined,
            optionsPaste: parsedOptions.length > 0 ? parsedOptions.join('\n') : undefined
          };
          
          
          templateData.fieldsMap.set(row.fieldName, newField);
        } else {
          // Update existing field with options and type from CSV
          const existingField = templateData.fieldsMap.get(row.fieldName)!;
          existingField.type = (row.fieldType as FieldType) || existingField.type;
          existingField.options = parsedOptions.length > 0 ? parsedOptions : undefined;
          existingField.optionsPaste = parsedOptions.length > 0 ? parsedOptions.join('\n') : undefined;
          
        }

        // Add prompts to the field
        const fieldData = templateData.fieldsMap.get(row.fieldName)!;
        row.prompts.forEach((promptText: string) => {
          if (promptText && promptText.trim()) {
            fieldData.csvPrompts.push(promptText.trim());
          }
        });
      }

      // Convert parsed data to the format expected by batchImport
      const categoriesToImport: string[] = [];
      const templatesToImport: Template[] = [];

      for (const [templateKey, templateData] of templateMap) {
        const { template, fieldsMap } = templateData;
        
        // Collect categories
        if (!categoriesToImport.includes(template.category)) {
          categoriesToImport.push(template.category);
        }
        
        // Build template with fields and prompts
        const templateToImport: Template = {
          id: template.id, // Use the temporary import ID
          name: template.name,
          category: template.category,
          fields: []
        };
        
        // Process fields in CSV order
        const fieldsArray = Array.from(fieldsMap.entries());
        // Sort fields by their CSV order to preserve the order from the imported file
        fieldsArray.sort(([, fieldDataA], [, fieldDataB]) => {
          const orderA = fieldDataA.csvOrder ?? 999;
          const orderB = fieldDataB.csvOrder ?? 999;
          return orderA - orderB;
        });
        
        for (const [fieldName, fieldData] of fieldsArray) {
          const field: Field = {
            id: fieldData.id,
            name: fieldName,
            type: fieldData.type,
            prompts: fieldData.csvPrompts.map((promptText, index) => ({
              id: `temp-prompt-${index}`,
              text: promptText,
              up: 0,
              down: 0,
              createdAt: Date.now() - index
            })),
            // Include options in the final field
            options: fieldData.options,
            optionsPaste: fieldData.optionsPaste
          };
          
          
          templateToImport.fields.push(field);
        }
        
        templatesToImport.push(templateToImport);
      }

      // Deduplicate templates by name and category (safety check)
      const uniqueTemplates = templatesToImport.filter((template, index, array) => {
        return array.findIndex(t => t.name === template.name && t.category === template.category) === index;
      });

      if (uniqueTemplates.length !== templatesToImport.length) {
        console.warn(`🚨 CSV Import: Removed ${templatesToImport.length - uniqueTemplates.length} duplicate templates`);
      }

      // Use the batch import function
      batchImport({
        categories: categoriesToImport,
        templates: uniqueTemplates
      });

      // Reset form
      setImportDialogOpen(false);
      setCsvFile(null);
      setImportCategory('');
      setImportTemplateName('');
      setNewImportCategoryName('');
      setNewImportTemplateName('');

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'Failed to import templates. Please check the CSV format.',
        variant: 'destructive',
      });
    }
  };

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplatesForExport(prev => {
      if (templateId === 'all') {
        return prev.includes('all') ? [] : ['all'];
      } else {
        // If 'all' is selected, unselect it when individual templates are selected
        const filteredPrev = prev.filter(id => id !== 'all');
        
        if (filteredPrev.includes(templateId)) {
          return filteredPrev.filter(id => id !== templateId);
        } else {
          return [...filteredPrev, templateId];
        }
      }
    });
  };

  return (
    <>
      {/* Export Template Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={(open) => {
        setExportDialogOpen(open);
        if (!open) {
          setSelectedTemplatesForExport([]);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Template CSV</DialogTitle>
            <DialogDescription>
              Select templates to export as a CSV file for backup or sharing purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Templates to Export</Label>
              <div className="border rounded-md p-4 max-h-64 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="select-all"
                      checked={selectedTemplatesForExport.includes('all')}
                      onCheckedChange={() => toggleTemplateSelection('all')}
                    />
                    <Label htmlFor="select-all" className="font-medium text-sm">
                      Export All Templates
                    </Label>
                  </div>
                  {database.templates.map((template) => (
                    <div key={template.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={template.id}
                        checked={selectedTemplatesForExport.includes(template.id) || selectedTemplatesForExport.includes('all')}
                        onCheckedChange={() => toggleTemplateSelection(template.id)}
                        disabled={selectedTemplatesForExport.includes('all')}
                      />
                      <Label htmlFor={template.id} className="text-sm flex-1">
                        <span className="font-medium">{template.category}</span> → <span>{template.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setExportDialogOpen(false);
              setSelectedTemplatesForExport([]);
            }}>
              Cancel
            </Button>
            <Button onClick={handleExportTemplates}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Template Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setCsvFile(null);
          setImportCategory('');
          setImportTemplateName('');
          setNewImportCategoryName('');
          setNewImportTemplateName('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Template CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import templates. The file should have the format: Category, Template, Field, Type, Prompt 1, Prompt 2, Prompt 3
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-category">Category</Label>
              <Select value={importCategory} onValueChange={setImportCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {database.categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new_category__">
                    + Create New Category
                  </SelectItem>
                </SelectContent>
              </Select>
              {importCategory === '__new_category__' && (
                <Input
                  ref={newCategoryInputRef}
                  placeholder="Enter new category name"
                  value={newImportCategoryName}
                  onChange={(e) => setNewImportCategoryName(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-template-name">Template Name</Label>
              <Select value={importTemplateName} onValueChange={setImportTemplateName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or create template" />
                </SelectTrigger>
                <SelectContent>
                  {importCategory && importCategory !== '__new_category__' && 
                    database.templates
                      .filter(t => t.category === importCategory)
                      .map(template => (
                        <SelectItem key={template.id} value={template.name}>
                          {template.name}
                        </SelectItem>
                      ))
                  }
                  <SelectItem value="__new_template__">
                    + Create New Template
                  </SelectItem>
                </SelectContent>
              </Select>
              {importTemplateName === '__new_template__' && (
                <Input
                  ref={newTemplateInputRef}
                  placeholder="Enter new template name"
                  value={newImportTemplateName}
                  onChange={(e) => setNewImportTemplateName(e.target.value)}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportDialogOpen(false);
              setCsvFile(null);
              setImportCategory('');
              setImportTemplateName('');
              setNewImportCategoryName('');
              setNewImportTemplateName('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleImportTemplates}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 