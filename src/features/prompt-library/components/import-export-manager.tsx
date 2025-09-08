'use client';

import React, { useState } from 'react';
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
import { exportTemplatesToCSV, parseImportCSV, validateImportData, downloadCSV } from '../utils/csv-import-export';
import type { Database, Template, Field, Prompt, FieldType } from '../types';

interface ImportExportManagerProps {
  database: Database;
  addCategory: (categoryName: string) => void;
  addTemplate: (templateName: string, categoryName: string) => void;
  addField: (templateId: string, fieldName: string, fieldType: string) => void;
  addPrompt: (templateId: string, fieldId: string, promptText: string, createdAtOverride?: number) => void;
  exportDialogOpen: boolean;
  setExportDialogOpen: (open: boolean) => void;
  importDialogOpen: boolean;
  setImportDialogOpen: (open: boolean) => void;
}

interface FieldWithImportData extends Field {
  csvPrompts: string[];
}

export function ImportExportManager({
  database,
  addCategory,
  addTemplate,
  addField,
  addPrompt,
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
      const csvText = await csvFile.text();
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
          // Check if template already exists
          let existingTemplate = database.templates.find(t => 
            t.name === templateName && t.category === finalCategory
          );
          
          if (!existingTemplate) {
            // Create new template structure
            const templateId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            existingTemplate = {
              id: templateId,
              name: templateName,
              category: finalCategory,
              fields: []
            };
          }
          
          templateMap.set(templateKey, {
            template: existingTemplate,
            fieldsMap: new Map()
          });
        }

        const templateData = templateMap.get(templateKey)!;
        
        // Add field if it doesn't exist
        if (!templateData.fieldsMap.has(row.fieldName)) {
          // Check if field already exists in template
          let existingField = templateData.template.fields.find(f => f.name === row.fieldName);
          
          if (!existingField) {
            // Create new field with csvPrompts
            const fieldId = `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newField: FieldWithImportData = {
              id: fieldId,
              name: row.fieldName,
              type: (row.fieldType as FieldType) || 'text',
              prompts: [],
              csvPrompts: []
            };
            existingField = newField;
          } else {
            // Add csvPrompts property to existing field
            const extendedField: FieldWithImportData = {
              ...existingField,
              csvPrompts: []
            };
            existingField = extendedField;
          }
          
          templateData.fieldsMap.set(row.fieldName, existingField as FieldWithImportData);
        }

        // Add prompts to the field
        const fieldData = templateData.fieldsMap.get(row.fieldName)!;
        row.prompts.forEach((promptText: string) => {
          if (promptText && promptText.trim()) {
            fieldData.csvPrompts.push(promptText.trim());
          }
        });
      }

      // Now update the database with complete templates
      let templatesCreated = 0;
      let fieldsCreated = 0;
      let promptsCreated = 0;

      for (const [templateKey, templateData] of templateMap) {
        const { template, fieldsMap } = templateData;
        
        // Check if this is a new template
        const isNewTemplate = !database.templates.find(t => t.id === template.id);
        
        if (isNewTemplate) {
          templatesCreated++;
          // Build complete fields array with prompts
          const completeFields: Field[] = [];
          
          for (const [fieldName, fieldData] of fieldsMap) {
            const prompts: Prompt[] = [];
            
            // Add prompts to field
            fieldData.csvPrompts.forEach((promptText: string, index: number) => {
              const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`;
              prompts.push({
                id: promptId,
                text: promptText,
                up: 0,
                down: 0,
                createdAt: Date.now() - index // Slightly stagger timestamps
              });
              promptsCreated++;
            });

            completeFields.push({
              id: fieldData.id,
              name: fieldData.name,
              type: fieldData.type,
              prompts
            });
            
            fieldsCreated++;
          }

          // Add complete template using existing addTemplate function
          addTemplate(template.name, template.category);
          
          // Wait a moment then add fields and prompts
          setTimeout(() => {
            const newTemplate = database.templates.find(t => 
              t.name === template.name && t.category === template.category
            );
            
            if (newTemplate) {
              completeFields.forEach(fieldData => {
                addField(newTemplate.id, fieldData.name, fieldData.type);
                
                // Add prompts after field is created
                setTimeout(() => {
                  const updatedTemplate = database.templates.find(t => t.id === newTemplate.id);
                  const newField = updatedTemplate?.fields.find(f => f.name === fieldData.name);
                  
                  if (newField) {
                    fieldData.prompts.forEach(prompt => {
                      addPrompt(newTemplate.id, newField.id, prompt.text);
                    });
                  }
                }, 50);
              });
            }
          }, 100);
        } else {
          // Update existing template - handle both new and existing fields
          for (const [fieldName, fieldData] of fieldsMap) {
            const existingField = template.fields.find(f => f.name === fieldName);
            
            if (!existingField) {
              // Handle NEW fields
              const prompts: Prompt[] = [];
              
              fieldData.csvPrompts.forEach((promptText: string, index: number) => {
                const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`;
                prompts.push({
                  id: promptId,
                  text: promptText,
                  up: 0,
                  down: 0,
                  createdAt: Date.now() - index
                });
                promptsCreated++;
              });

              // Add field with prompts to existing template
              addField(template.id, fieldData.name, fieldData.type);
              
              // Wait a moment then add prompts
              setTimeout(() => {
                const updatedTemplate = database.templates.find(t => t.id === template.id);
                const newField = updatedTemplate?.fields.find(f => f.name === fieldData.name);
                
                if (newField) {
                  prompts.forEach(prompt => {
                    addPrompt(template.id, newField.id, prompt.text);
                  });
                }
              }, 100);
              
              fieldsCreated++;
            } else {
              // Handle EXISTING fields - add prompts from CSV
              if (fieldData.csvPrompts.length > 0) {
                fieldData.csvPrompts.forEach((promptText: string) => {
                  // Check if this prompt already exists to avoid duplicates
                  const promptExists = existingField.prompts.some(p => p.text.trim() === promptText.trim());
                  
                  if (!promptExists) {
                    setTimeout(() => {
                      addPrompt(template.id, existingField.id, promptText);
                    }, 150);
                    promptsCreated++;
                  }
                });
              }
            }
          }
        }
      }

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${templatesCreated} template(s), ${fieldsCreated} field(s), and ${promptsCreated} prompt(s).`,
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
                  placeholder="Enter new category name"
                  value={newImportCategoryName}
                  onChange={(e) => setNewImportCategoryName(e.target.value)}
                  autoFocus
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
                  placeholder="Enter new template name"
                  value={newImportTemplateName}
                  onChange={(e) => setNewImportTemplateName(e.target.value)}
                  autoFocus
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