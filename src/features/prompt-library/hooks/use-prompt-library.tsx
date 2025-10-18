'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { Database, Template, Field, Prompt, SearchFilters, FieldType } from '../types';
import { ALL_CATEGORIES, ALL_TEMPLATES } from '../types';
import { PromptLibraryStorage } from '../utils/storage';
import { useToast } from '@/hooks/use-toast';

// Module-level variable to prevent double-firing of pin toggles
let pinToggleInProgress: Record<string, boolean> = {};

interface PromptLibraryContextType {
  // Data
  database: Database;
  filteredTemplates: Template[];
  filteredFields: { template: Template; field: Field }[];
  
  // Filters & Search
  searchFilters: SearchFilters;
  setSearchTerm: (term: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedTemplate: (template: string | null) => void;
  
  // CRUD Operations
  addPrompt: (templateId: string, fieldId: string, promptText: string, createdAtOverride?: number) => void;
  updatePromptRating: (templateId: string, fieldId: string, promptId: string, type: 'up' | 'down') => void;
  deletePrompt: (templateId: string, fieldId: string, promptId: string) => void;
  addCategory: (categoryName: string) => void;
  addTemplate: (templateName: string, categoryName: string) => void;
  deleteTemplate: (templateId: string) => void;
  renameTemplate: (templateId: string, newName: string) => void;
  addField: (templateId: string, fieldName: string, fieldType: string) => void;
  editPrompt: (templateId: string, fieldId: string, promptId: string, newText: string) => void;
  reorderFields: (templateId: string, fieldOrder: string[]) => void;
  togglePinPrompt: (templateId: string, fieldId: string, promptId: string) => void;
  deleteField: (templateId: string, fieldId: string) => void;
  renameField: (templateId: string, fieldId: string, newName: string) => void;
  updateField: (templateId: string, fieldId: string, updates: Partial<Field>) => void;
  batchImport: (importData: { categories: string[], templates: Template[] }) => void;
  
  // Utility
  copyToClipboard: (text: string) => void;
  
  // State
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const PromptLibraryContext = createContext<PromptLibraryContextType | undefined>(undefined);

export function PromptLibraryProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<Database>({ categories: [], templates: [] });
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    category: ALL_CATEGORIES,
    template: ALL_TEMPLATES,
    searchTerm: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Load data on mount (client-side only)
  useEffect(() => {
    // Extra SSR guard - only run on client
    if (typeof window === 'undefined') {
      console.log('⚠️ PromptLibraryProvider: Still on server, skipping load');
      return;
    }

    setIsLoading(true);
    try {
      const data = PromptLibraryStorage.load();
      setDatabase(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load prompt library data:', err);
      setError('Failed to load prompt library data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save data whenever database changes (but skip initial load)
  useEffect(() => {
    // Only save if this isn't the initial empty state
    if (database.categories.length > 0 || database.templates.length > 0) {
      PromptLibraryStorage.save(database);
    }
  }, [database]);

  // Search and filtering logic
  const filteredTemplates = useMemo(() => {
    let templates = database.templates;

    // Filter by category
    if (searchFilters.category && searchFilters.category !== ALL_CATEGORIES) {
      templates = templates.filter(t => t.category === searchFilters.category);
    }

    // Filter by search term
    if (searchFilters.searchTerm) {
      const term = searchFilters.searchTerm.toLowerCase();
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(term) ||
        template.category.toLowerCase().includes(term) ||
        template.fields.some(field => 
          field.name.toLowerCase().includes(term) ||
          field.prompts.some(prompt => prompt.text.toLowerCase().includes(term))
        )
      );
    }

    return templates;
  }, [database.templates, searchFilters]);

  const filteredFields = useMemo(() => {
    const fields: { template: Template; field: Field }[] = [];
    
    filteredTemplates.forEach(template => {
      let templateFields = template.fields;

      // Filter by template
      if (searchFilters.template && searchFilters.template !== ALL_TEMPLATES) {
        if (template.id !== searchFilters.template) return;
      }

      // Filter by search term for fields
      if (searchFilters.searchTerm) {
        const term = searchFilters.searchTerm.toLowerCase();
        templateFields = templateFields.filter(field =>
          field.name.toLowerCase().includes(term) ||
          field.prompts.some(prompt => prompt.text.toLowerCase().includes(term))
        );
      }

      templateFields.forEach(field => {
        fields.push({ template, field });
      });
    });

    return fields;
  }, [filteredTemplates, searchFilters]);

  // Filter actions
  const setSearchTerm = useCallback((term: string) => {
    setSearchFilters(prev => ({ ...prev, searchTerm: term }));
  }, []);

  const setSelectedCategory = useCallback((category: string | null) => {
    setSearchFilters(prev => ({ 
      ...prev, 
      category: category || ALL_CATEGORIES,
      template: ALL_TEMPLATES // Reset template when category changes
    }));
  }, []);

  const setSelectedTemplate = useCallback((template: string | null) => {
    setSearchFilters(prev => ({ ...prev, template: template || ALL_TEMPLATES }));
  }, []);

  // CRUD Operations
  // Function to generate unique IDs
  const generateUniqueId = useCallback(() => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const random2 = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}-${random2}`;
  }, []);

  const addPrompt = useCallback((templateId: string, fieldId: string, promptText: string, createdAtOverride?: number) => {
    const uniqueId = generateUniqueId();
    const timestamp = createdAtOverride || Date.now();
    const newPrompt: Prompt = {
      id: `prompt-${uniqueId}`,
      text: promptText.trim(),
      up: 0,
      down: 0,
      createdAt: timestamp
    };

    let wasAdded = false;

    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          return {
            ...template,
            fields: template.fields.map(field => {
              if (field.id === fieldId) {
                wasAdded = true;
                return {
                  ...field,
                  prompts: [newPrompt, ...field.prompts] // Add to the top
                };
              }
              return field;
            })
          };
        }
        return template;
      })
    }));

    if (wasAdded) {
      setTimeout(() => {
        toast({
          title: 'Prompt Added',
          description: 'New prompt has been added successfully.',
        });
      }, 0);
    }
  }, [generateUniqueId, toast]);

  const updatePromptRating = useCallback((templateId: string, fieldId: string, promptId: string, type: 'up' | 'down') => {
    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          return {
            ...template,
            fields: template.fields.map(field => {
              if (field.id === fieldId) {
                return {
                  ...field,
                  prompts: field.prompts.map(prompt => {
                    if (prompt.id === promptId) {
                      return {
                        ...prompt,
                        [type]: prompt[type] + 1
                      };
                    }
                    return prompt;
                  })
                };
              }
              return field;
            })
          };
        }
        return template;
      })
    }));
  }, []);

  const deletePrompt = useCallback((templateId: string, fieldId: string, promptId: string) => {
    let wasDeleted = false;

    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          return {
            ...template,
            fields: template.fields.map(field => {
              if (field.id === fieldId) {
                const newPrompts = field.prompts.filter(prompt => prompt.id !== promptId);
                if (newPrompts.length < field.prompts.length) {
                  wasDeleted = true;
                }
                return {
                  ...field,
                  prompts: newPrompts
                };
              }
              return field;
            })
          };
        }
        return template;
      })
    }));

    if (wasDeleted) {
      setTimeout(() => {
        toast({
          title: 'Prompt Deleted',
          description: 'Prompt has been removed successfully.',
        });
      }, 0);
    }
  }, [toast]);

  const editPrompt = useCallback((templateId: string, fieldId: string, promptId: string, newText: string) => {
    let wasUpdated = false;
    
    setDatabase(prev => {
      const newTemplates = prev.templates.map(template => {
        if (template.id !== templateId) return template;
        
        const newFields = template.fields.map(field => {
          if (field.id !== fieldId) return field;
          
          const newPrompts = field.prompts.map(prompt => {
            if (prompt.id !== promptId) return prompt;
            wasUpdated = true;
            return { ...prompt, text: newText };
          });
          
          return { ...field, prompts: newPrompts };
        });
        
        return { ...template, fields: newFields };
      });

      return { ...prev, templates: newTemplates };
    });

    // Show toast after state update
    if (wasUpdated) {
      setTimeout(() => {
        toast({
          title: "Prompt updated",
          description: "The prompt has been successfully updated.",
        });
      }, 0);
    }
  }, [toast]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Prompt text copied to clipboard.',
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy text to clipboard.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const addCategory = useCallback((categoryName: string) => {
    const trimmedName = categoryName.trim();
    if (!trimmedName) return;

    // Check if category already exists
    if (database.categories.includes(trimmedName)) {
      toast({
        title: 'Category Exists',
        description: 'A category with this name already exists.',
        variant: 'destructive',
      });
      return;
    }

    setDatabase(prev => ({
      ...prev,
      categories: [...prev.categories, trimmedName]
    }));

    toast({
      title: 'Category Added',
      description: `Category "${trimmedName}" has been created successfully.`,
    });
  }, [database.categories, toast]);

  const addTemplate = useCallback((templateName: string, categoryName: string) => {
    const trimmedTemplateName = templateName.trim();
    const trimmedCategoryName = categoryName.trim();
    
    if (!trimmedTemplateName || !trimmedCategoryName) return;

    // Generate unique ID using the same robust approach as prompts
    const uniqueId = generateUniqueId();
    const templateId = `template-${uniqueId}`;

    // Create new template with basic structure
    const newTemplate: Template = {
      id: templateId,
      name: trimmedTemplateName,
      category: trimmedCategoryName,
      fields: []
    };

    setDatabase(prev => ({
      ...prev,
      templates: [...prev.templates, newTemplate]
    }));

    toast({
      title: 'Template Added',
      description: `Template "${trimmedTemplateName}" has been created in the "${trimmedCategoryName}" category.`,
    });
  }, [generateUniqueId, toast]);

  const deleteTemplate = useCallback((templateId: string) => {
    if (!templateId) return;

    const templateToDelete = database.templates.find(t => t.id === templateId);
    if (!templateToDelete) return;

    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.filter(t => t.id !== templateId)
    }));

    toast({
      title: 'Template Deleted',
      description: `Template "${templateToDelete.name}" has been deleted.`,
    });
  }, [database.templates, toast]);

  const renameTemplate = useCallback((templateId: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (!templateId || !trimmedNewName) return;

    const templateToRename = database.templates.find(t => t.id === templateId);
    if (!templateToRename) return;

    const oldName = templateToRename.name;

    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => 
        template.id === templateId 
          ? { ...template, name: trimmedNewName }
          : template
      )
    }));

    toast({
      title: 'Template Renamed',
      description: `Template renamed from "${oldName}" to "${trimmedNewName}".`,
    });
  }, [database.templates, toast]);

  const addField = useCallback((templateId: string, fieldName: string, fieldType: string) => {
    const trimmedFieldName = fieldName.trim();
    
    if (!trimmedFieldName || !fieldType || !templateId) return;

    // Generate unique ID using the same robust approach as prompts
    const uniqueId = generateUniqueId();
    const fieldId = `field-${uniqueId}`;

    // Create new field
    const newField: Field = {
      id: fieldId,
      name: trimmedFieldName,
      type: fieldType as FieldType,
      prompts: []
    };

    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          return {
            ...template,
            fields: [...template.fields, newField]
          };
        }
        return template;
      })
    }));

    const template = database.templates.find(t => t.id === templateId);
    const templateName = template?.name || 'template';

    toast({
      title: 'Field Added',
      description: `Field "${trimmedFieldName}" has been added to "${templateName}".`,
    });
  }, [database.templates, generateUniqueId, toast]);

  const reorderFields = useCallback((templateId: string, fieldOrder: string[]) => {
    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          // Create a map of fields by name for quick lookup
          const fieldMap = new Map(template.fields.map(field => [field.name, field]));
          
          // Create new array of fields in the specified order
          const orderedFields = fieldOrder
            .map(fieldName => fieldMap.get(fieldName))
            .filter((field): field is Field => field !== undefined);
          
          // Add any remaining fields that weren't in the order array
          template.fields.forEach(field => {
            if (!fieldOrder.includes(field.name)) {
              orderedFields.push(field);
            }
          });
          
          return {
            ...template,
            fields: orderedFields
          };
        }
        return template;
      })
    }));
  }, []);

  const togglePinPrompt = useCallback((templateId: string, fieldId: string, promptId: string) => {
    let wasToggled = false;
    let isPinning = false;
    let targetPromptText = '';
    
    // Prevent double-firing by checking if we're already processing this action
    const actionKey = `${templateId}-${fieldId}-${promptId}`;
    if (pinToggleInProgress[actionKey]) {
      return;
    }
    
    // Mark this action as in progress
    pinToggleInProgress[actionKey] = true;
    
    // Clear the flag after a short delay
    setTimeout(() => {
      delete pinToggleInProgress[actionKey];
    }, 100);
    
    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          return {
            ...template,
            fields: template.fields.map(field => {
              if (field.id === fieldId) {
                // First pass: check if we're pinning or unpinning the target prompt
                const targetPrompt = field.prompts.find(p => p.id === promptId);
                if (targetPrompt) {
                  isPinning = !targetPrompt.isPinned;
                  targetPromptText = targetPrompt.text;
                }
                
                return {
                  ...field,
                  prompts: field.prompts.map(prompt => {
                    if (prompt.id === promptId) {
                      // Toggle the target prompt
                      wasToggled = true;
                      return {
                        ...prompt,
                        isPinned: !prompt.isPinned
                      };
                    } else if (isPinning && prompt.isPinned) {
                      // If we're pinning the target prompt, unpin any other pinned prompts in this field
                      return {
                        ...prompt,
                        isPinned: false
                      };
                    }
                    return prompt;
                  })
                };
              }
              return field;
            })
          };
        }
        return template;
      })
    }));

    if (wasToggled) {
      setTimeout(() => {
        toast({
          title: "Prompt Updated",
          description: isPinning 
            ? "Prompt pinned. Other pins in this field have been removed."
            : "Prompt unpinned.",
        });
      }, 0);
    }
  }, [toast]);

  const deleteField = useCallback((templateId: string, fieldId: string) => {
    let wasDeleted = false;
    let fieldName = '';
    let templateName = '';

    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          templateName = template.name;
          const fieldToDelete = template.fields.find(f => f.id === fieldId);
          if (fieldToDelete) {
            fieldName = fieldToDelete.name;
            wasDeleted = true;
          }
          
          return {
            ...template,
            fields: template.fields.filter(field => field.id !== fieldId)
          };
        }
        return template;
      })
    }));

    if (wasDeleted) {
      setTimeout(() => {
        toast({
          title: "Field Deleted",
          description: `Field "${fieldName}" has been removed from "${templateName}".`,
        });
      }, 0);
    }
  }, [toast]);

  const renameField = useCallback((templateId: string, fieldId: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    let wasRenamed = false;
    let templateName = '';

    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          templateName = template.name;
          
          return {
            ...template,
            fields: template.fields.map(field => {
              if (field.id === fieldId) {
                wasRenamed = true;
                return {
                  ...field,
                  name: trimmedName
                };
              }
              return field;
            })
          };
        }
        return template;
      })
    }));

    if (wasRenamed) {
      setTimeout(() => {
        toast({
          title: "Field Renamed",
          description: `Field has been renamed to "${trimmedName}" in "${templateName}".`,
        });
      }, 0);
    }
  }, [toast]);

  const updateField = useCallback((templateId: string, fieldId: string, updates: Partial<Field>) => {
    let wasUpdated = false;
    let templateName = '';

    setDatabase(prev => ({
      ...prev,
      templates: prev.templates.map(template => {
        if (template.id === templateId) {
          templateName = template.name;
          
          return {
            ...template,
            fields: template.fields.map(field => {
              if (field.id === fieldId) {
                wasUpdated = true;
                return {
                  ...field,
                  ...updates
                };
              }
              return field;
            })
          };
        }
        return template;
      })
    }));

    if (wasUpdated) {
      setTimeout(() => {
        toast({
          title: "Field Updated",
          description: `Field has been updated in "${templateName}".`,
        });
      }, 0);
    }
  }, [toast]);

  const batchImport = useCallback((importData: { categories: string[], templates: Template[] }) => {
    // Count templates and fields from import data directly (user-friendly counting)
    const templatesProcessed = importData.templates.length;
    const fieldsProcessed = importData.templates.reduce((total, template) => total + template.fields.length, 0);
    const promptsProcessed = importData.templates.reduce((total, template) => 
      total + template.fields.reduce((fieldTotal, field) => fieldTotal + field.prompts.length, 0), 0
    );

    setDatabase(prev => {
      const newCategories = [...prev.categories];
      const newTemplates = [...prev.templates];

      // Add new categories
      importData.categories.forEach(category => {
        if (!newCategories.includes(category)) {
          newCategories.push(category);
        }
      });

      // Process templates
      importData.templates.forEach(importTemplate => {
        // Check if template already exists
        const existingTemplateIndex = newTemplates.findIndex(t => 
          t.name === importTemplate.name && t.category === importTemplate.category
        );

        if (existingTemplateIndex === -1) {
          // Create new template
          const templateId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const newTemplate: Template = {
            id: templateId,
            name: importTemplate.name,
            category: importTemplate.category,
            fields: []
          };

          // Process fields
          importTemplate.fields.forEach((importField, fieldIndex) => {
            const fieldId = `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const newField: Field = {
              id: fieldId,
              name: importField.name,
              type: importField.type,
              prompts: [],
              options: importField.options,
              optionsPaste: importField.optionsPaste
            };

            // Process prompts
            importField.prompts.forEach((importPrompt, promptIndex) => {
              const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${promptIndex}`;
              
              newField.prompts.push({
                id: promptId,
                text: importPrompt.text,
                up: 0,
                down: 0,
                createdAt: Date.now() - promptIndex
              });
            });

            newTemplate.fields.push(newField);
          });

          newTemplates.push(newTemplate);
        } else {
          // Update existing template - preserve field order from import
          const existingTemplate = newTemplates[existingTemplateIndex];
          
          // Build new fields array in the order from the import
          const newFieldsArray: Field[] = [];
          
          importTemplate.fields.forEach(importField => {
            const existingField = existingTemplate.fields.find(f => f.name === importField.name);
            
            if (!existingField) {
              // Add new field to existing template
              const fieldId = `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
              const newField: Field = {
                id: fieldId,
                name: importField.name,
                type: importField.type,
                prompts: [],
                options: importField.options,
                optionsPaste: importField.optionsPaste
              };

              // Process prompts
              importField.prompts.forEach((importPrompt, promptIndex) => {
                const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${promptIndex}`;
                
                newField.prompts.push({
                  id: promptId,
                  text: importPrompt.text,
                  up: 0,
                  down: 0,
                  createdAt: Date.now() - promptIndex
                });
              });

              newFieldsArray.push(newField);
            } else {
              // Update existing field and preserve its ID and existing prompts
              const updatedField: Field = {
                id: existingField.id, // Keep original ID
                name: importField.name,
                type: importField.type,
                prompts: [...existingField.prompts], // Start with existing prompts
                options: importField.options,
                optionsPaste: importField.optionsPaste
              };
              
              // Add new prompts from import
              importField.prompts.forEach((importPrompt, promptIndex) => {
                // Check if prompt already exists
                const promptExists = updatedField.prompts.some(p => p.text.trim() === importPrompt.text.trim());
                
                if (!promptExists) {
                  const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${promptIndex}`;
                  
                  updatedField.prompts.unshift({
                    id: promptId,
                    text: importPrompt.text,
                    up: 0,
                    down: 0,
                    createdAt: Date.now() - promptIndex
                  });
                }
              });
              
              newFieldsArray.push(updatedField);
            }
          });
          
          // Replace the entire fields array to preserve the import order
          existingTemplate.fields = newFieldsArray;
        }
      });

      return {
        categories: newCategories,
        templates: newTemplates
      };
    });

    // Show success toast
    setTimeout(() => {
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${templatesProcessed} template(s), ${fieldsProcessed} field(s), and ${promptsProcessed} prompt(s).`,
      });
    }, 100);
  }, [toast]);

  const value: PromptLibraryContextType = {
    database,
    filteredTemplates,
    filteredFields,
    searchFilters,
    setSearchTerm,
    setSelectedCategory,
    setSelectedTemplate,
    addPrompt,
    updatePromptRating,
    deletePrompt,
    addCategory,
    addTemplate,
    deleteTemplate,
    renameTemplate,
    addField,
    copyToClipboard,
    isLoading,
    error,
    clearError,
    editPrompt,
    reorderFields,
    togglePinPrompt,
    deleteField,
    renameField,
    updateField,
    batchImport
  };

  return (
    <PromptLibraryContext.Provider value={value}>
      {children}
    </PromptLibraryContext.Provider>
  );
}

export function usePromptLibrary() {
  const context = useContext(PromptLibraryContext);
  if (context === undefined) {
    throw new Error('usePromptLibrary must be used within a PromptLibraryProvider');
  }
  return context;
} 