'use client';

import React, { useState } from 'react';
import { AlertCircle, BookOpen, Plus, ChevronDown, MoreHorizontal, Download, Upload } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { usePromptLibrary } from '../hooks/use-prompt-library';
import { ALL_CATEGORIES, ALL_TEMPLATES } from '../types';
import { SearchBar } from './search-bar';
import { FieldCard } from './field-card';
import { exportTemplatesToCSV, parseImportCSV, validateImportData, downloadCSV } from '../utils/csv-import-export';
import type { ExportableTemplate } from '../utils/csv-import-export';
import type { Field, FieldType, Template } from '../types';
import { useToast } from '@/hooks/use-toast';

export function PromptLibraryMain() {
  const { filteredFields, isLoading, error, database, searchFilters, addCategory, addTemplate, addField, addPrompt, deletePrompt, reorderFields } = usePromptLibrary();
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
  
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedCategoryForTemplate, setSelectedCategoryForTemplate] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [selectedTemplateForField, setSelectedTemplateForField] = useState('');
  const [selectedFieldType, setSelectedFieldType] = useState('');
  
  // Import/Export state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedTemplatesForExport, setSelectedTemplatesForExport] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importCategory, setImportCategory] = useState('');
  const [importTemplateName, setImportTemplateName] = useState('');
  const [newImportCategoryName, setNewImportCategoryName] = useState('');
  const [newImportTemplateName, setNewImportTemplateName] = useState('');

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

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName);
      setNewCategoryName('');
      setCategoryDialogOpen(false);
    }
  };

  const handleAddTemplate = () => {
    if (newTemplateName.trim() && selectedCategoryForTemplate) {
      addTemplate(newTemplateName, selectedCategoryForTemplate);
      setNewTemplateName('');
      setSelectedCategoryForTemplate('');
      setTemplateDialogOpen(false);
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCategory();
    }
  };

  const handleTemplateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTemplate();
    }
  };

  const handleAddField = () => {
    if (newFieldName.trim() && selectedTemplateForField && selectedFieldType) {
      addField(selectedTemplateForField, newFieldName, selectedFieldType);
      setNewFieldName('');
      setSelectedTemplateForField('');
      setSelectedFieldType('');
      setFieldDialogOpen(false);
    }
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddField();
    }
  };

  const handleOpenFieldDialog = () => {
    // Pre-populate template if filters are set to a specific template
    if (searchFilters.template && searchFilters.template !== ALL_TEMPLATES) {
      setSelectedTemplateForField(searchFilters.template);
    }
    setFieldDialogOpen(true);
  };

  // Get available templates based on current category filter
  const availableTemplatesForField = React.useMemo(() => {
    if (searchFilters.category && searchFilters.category !== ALL_CATEGORIES) {
      return database.templates.filter(t => t.category === searchFilters.category);
    }
    return database.templates;
  }, [database.templates, searchFilters.category]);

  const fieldTypes = ['Text', 'Date', 'DropdownSingle', 'DropdownMulti', 'TaxonomySingle', 'TaxonomyMulti'];

  // Export/Import handlers
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
        title: 'Export Successful',
        description: `Templates exported to ${filename}`,
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
    if (!csvFile || !importCategory || !importTemplateName) {
      toast({
        title: 'Missing Information',
        description: 'Please select a CSV file, category, and template.',
        variant: 'destructive',
      });
      return;
    }
    
    // Add the category if it's new
    const finalCategory = importCategory === '__new_category__' ? newImportCategoryName : importCategory;
    if (!database.categories.includes(finalCategory)) {
      addCategory(finalCategory);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
      const csvText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(csvFile);
      });

      const templates = parseImportCSV(csvText);
      const validation = validateImportData(templates);
      
      if (!validation.valid) {
        toast({
          title: 'Import Failed',
          description: `CSV validation failed: ${validation.errors[0]}`,
          variant: 'destructive',
        });
        return;
      }

      // Group templates by name and maintain field order
      const templateGroups = new Map<string, ExportableTemplate[]>();
      templates.forEach(t => {
        const finalTemplateName = importTemplateName === '__new_template__' ? newImportTemplateName : importTemplateName;
        if (!templateGroups.has(finalTemplateName)) {
          templateGroups.set(finalTemplateName, []);
        }
        templateGroups.get(finalTemplateName)!.push({
          ...t,
          category: finalCategory,
          templateName: finalTemplateName
        });
      });

      let templatesCreated = 0;
      let fieldsCreated = 0;
      let fieldsUpdated = 0;
      let promptsCreated = 0;

      // Process each template sequentially to avoid race conditions
      for (const [templateName, templateFields] of templateGroups) {
        // Sort fields by their order in CSV to maintain user's intended order
        const sortedFields = templateFields.sort((a, b) => (a.fieldOrder || 0) - (b.fieldOrder || 0));
        
        // Find or create template
        let currentTemplate = database.templates.find(t => t.name === templateName && t.category === finalCategory);
        
        if (!currentTemplate) {
          addTemplate(templateName, finalCategory);
          templatesCreated++;
          // Wait a bit for the template to be created
          await new Promise(resolve => setTimeout(resolve, 50));
          currentTemplate = database.templates.find(t => t.name === templateName && t.category === finalCategory);
        }
        
        if (!currentTemplate) {
          console.warn(`Could not find or create template: ${templateName}`);
          continue;
        }

        // Create a map of existing fields by name for quick lookup
        const existingFieldsMap = new Map(
          currentTemplate.fields.map(field => [field.name, field])
        );

        // First pass: Create/update fields and their prompts
        for (const templateField of sortedFields) {
          const existingField = existingFieldsMap.get(templateField.fieldName);
          
          if (!existingField) {
            // Add new field
            addField(currentTemplate.id, templateField.fieldName, templateField.fieldType);
            fieldsCreated++;
            // Wait for field creation
            await new Promise(resolve => setTimeout(resolve, 50));
          } else {
            // Delete existing prompts
            for (const prompt of existingField.prompts) {
              deletePrompt(currentTemplate.id, existingField.id, prompt.id);
            }
            fieldsUpdated++;
          }

          // Get the latest field reference
          const updatedTemplate = database.templates.find(t => t.id === currentTemplate.id);
          if (!updatedTemplate) continue;
          
          const fieldToUpdate = updatedTemplate.fields.find(f => f.name === templateField.fieldName);
          if (!fieldToUpdate) continue;

          // Add new prompts in order based on column position
          const baseTimestamp = Date.now();
          for (let i = 0; i < templateField.prompts.length; i++) {
            const promptText = templateField.prompts[i];
            if (promptText.trim()) {
              // Use decreasing timestamps to maintain column order (earlier columns appear first)
              const columnOrderTimestamp = baseTimestamp - (i * 1000);
              addPrompt(currentTemplate.id, fieldToUpdate.id, promptText.trim(), columnOrderTimestamp);
              promptsCreated++;
              await new Promise(resolve => setTimeout(resolve, 1));
            }
          }
        }

        // Second pass: Reorder fields according to CSV order
        const fieldOrder = sortedFields.map(field => field.fieldName);
        reorderFields(currentTemplate.id, fieldOrder);
        
        // Wait for reordering to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        // Wait for all updates to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast({
        title: 'Import Successful',
        description: `Created ${templatesCreated} templates, ${fieldsCreated} new fields, updated ${fieldsUpdated} existing fields, and ${promptsCreated} prompts.`,
      });

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
        description: 'Failed to import templates. Please check your CSV format.',
        variant: 'destructive',
      });
    }
  };

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplatesForExport(prev => {
      if (templateId === 'all') {
        return prev.includes('all') ? [] : ['all'];
      }
      
      const newSelection = prev.filter(id => id !== 'all');
      return newSelection.includes(templateId) 
        ? newSelection.filter(id => id !== templateId)
        : [...newSelection, templateId];
    });
  };

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
              Curate, rate, and manage prompt variants
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
                <DropdownMenuItem onClick={handleOpenFieldDialog}>
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        <SearchBar />

        {/* Dynamic Title */}
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
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

      {/* Add Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category to organize your templates and prompts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category Name</Label>
              <Input
                id="categoryName"
                placeholder="Enter category name (e.g., Legal, Finance, Marketing)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={handleCategoryKeyDown}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddCategory} 
              disabled={!newCategoryName.trim()}
            >
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Template</DialogTitle>
            <DialogDescription>
              Create a new template within a category. Fields can be added later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                placeholder="Enter template name (e.g., Contracts, Invoices, Resumes)"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={handleTemplateKeyDown}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateCategory">Category</Label>
              <Select 
                value={selectedCategoryForTemplate} 
                onValueChange={setSelectedCategoryForTemplate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {database.categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddTemplate} 
              disabled={!newTemplateName.trim() || !selectedCategoryForTemplate}
            >
              Add Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Field Dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Field</DialogTitle>
            <DialogDescription>
              Add a new field to an existing template. You can add prompts to this field later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fieldName">Field Name</Label>
              <Input
                id="fieldName"
                placeholder="Enter field name (e.g., Counter Party Name, Invoice Amount)"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyDown={handleFieldKeyDown}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fieldTemplate">Template</Label>
              <Select 
                value={selectedTemplateForField} 
                onValueChange={setSelectedTemplateForField}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplatesForField.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.category} → {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fieldType">Field Type</Label>
              <Select 
                value={selectedFieldType} 
                onValueChange={setSelectedFieldType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field type" />
                </SelectTrigger>
                <SelectContent>
                  {fieldTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddField} 
              disabled={!newFieldName.trim() || !selectedTemplateForField || !selectedFieldType}
            >
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
} 