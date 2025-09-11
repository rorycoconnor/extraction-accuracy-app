'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { Trash2, Pencil, Plus, X, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Field, Template, FieldType } from '../types';
import { usePromptLibrary } from '../hooks/use-prompt-library';

type FieldDetailsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  field: Field | null;
  template: Template | null;
};

export function FieldDetailsSheet({
  isOpen,
  onClose,
  field,
  template,
}: FieldDetailsSheetProps) {
  const { renameField, deleteField, reorderFields, updateField } = usePromptLibrary();
  const { toast } = useToast();
  
  const [fieldName, setFieldName] = React.useState('');
  const [fieldType, setFieldType] = React.useState<FieldType>('text');
  const [allowMultipleSelections, setAllowMultipleSelections] = React.useState(false);
  const [optionsPaste, setOptionsPaste] = React.useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Initialize form when field changes
  React.useEffect(() => {
    if (field) {
      setFieldName(field.name);
      setFieldType(field.type);
      setAllowMultipleSelections(field.type === 'dropdown_multi' || field.type === 'taxonomy');
      // Load existing options
      if (field.optionsPaste) {
        setOptionsPaste(field.optionsPaste);
      } else if (field.options && field.options.length > 0) {
        setOptionsPaste(field.options.join('\n'));
      } else {
        setOptionsPaste('');
      }
    } else {
      // Reset form for new field
      setFieldName('');
      setFieldType('text');
      setAllowMultipleSelections(false);
      setOptionsPaste('');
    }
    setHasUnsavedChanges(false);
  }, [field]);

  // Track changes
  React.useEffect(() => {
    if (field) {
      const nameChanged = fieldName.trim() !== field.name;
      const typeChanged = fieldType !== field.type;
      const optionsChanged = optionsPaste !== (field.optionsPaste || field.options?.join('\n') || '');
      setHasUnsavedChanges(nameChanged || typeChanged || optionsChanged);
    }
  }, [fieldName, fieldType, optionsPaste, field]);

  // Update multiple selections when field type changes
  React.useEffect(() => {
    const isMultiType = fieldType === 'dropdown_multi' || fieldType === 'taxonomy';
    setAllowMultipleSelections(isMultiType);
  }, [fieldType]);

  const showDropdownOptions = fieldType === 'dropdown_single' || fieldType === 'dropdown_multi' || fieldType === 'taxonomy';
  
  // Get display value for field type select
  const getFieldTypeDisplayValue = () => {
    if (fieldType === 'dropdown_single' || fieldType === 'dropdown_multi') {
      return 'dropdown';
    }
    return fieldType;
  };

  const handleSave = () => {
    if (!field || !template || !fieldName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Field name is required.',
      });
      return;
    }

    try {
      if (hasUnsavedChanges) {
        // Parse options from textarea
        const parsedOptions = parseOptions(optionsPaste);
        
        // Build updates object
        const updates: Partial<Field> = {};
        
        if (fieldName.trim() !== field.name) {
          updates.name = fieldName.trim();
        }
        
        // Determine the correct field type based on dropdown toggle
        let actualFieldType = fieldType;
        if (fieldType === 'dropdown_single' || fieldType === 'dropdown_multi') {
          actualFieldType = allowMultipleSelections ? 'dropdown_multi' : 'dropdown_single';
        }
        // Taxonomy is always multi-select in Box API
        if (fieldType === 'taxonomy') {
          actualFieldType = 'taxonomy'; // Keep as taxonomy, transformer will handle Box mapping
        }
        
        if (actualFieldType !== field.type) {
          updates.type = actualFieldType;
        }
        
        // Update options for dropdown/taxonomy fields
        if (showDropdownOptions) {
          updates.options = parsedOptions;
          updates.optionsPaste = optionsPaste;
        }
        
        // Use the new updateField function to save all changes at once
        updateField(template.id, field.id, updates);
      }
      
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save field changes.',
      });
    }
  };

  const handleDeleteField = () => {
    if (!field || !template) return;
    
    deleteField(template.id, field.id);
    setIsDeleteDialogOpen(false);
    onClose();
    
    toast({
      title: 'Field Deleted',
      description: `Field "${field.name}" has been deleted successfully.`,
    });
  };

  const handleFieldTypeChange = (value: string) => {
    if (value === 'dropdown') {
      // Default to single select when dropdown is selected
      setFieldType(allowMultipleSelections ? 'dropdown_multi' : 'dropdown_single');
    } else {
      setFieldType(value as FieldType);
    }
  };

  if (!field || !template) return null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="!w-[1218px] max-w-[95vw] flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-xl">Field Details</SheetTitle>
            <SheetDescription className="text-base">
              {template.category} → {template.name}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 my-6">
            <div className="space-y-6 pr-4">
              {/* Field Name */}
              <div className="space-y-3">
                <Label htmlFor="field-name" className="text-sm font-medium text-gray-700">
                  Field Name
                </Label>
                  <Input
                    id="field-name"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="Enter field name"
                    className="h-11 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary focus:ring-0 bg-white dark:bg-gray-800"
                  />
              </div>
              
              {/* Field Type */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">Field Type</Label>
                <Select value={getFieldTypeDisplayValue()} onValueChange={handleFieldTypeChange}>
                  <SelectTrigger className="h-11 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Select field type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="dropdown">Dropdown</SelectItem>
                    <SelectItem value="taxonomy">Taxonomy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Allow Multiple Selections Toggle */}
              {showDropdownOptions && (
                <div className="flex items-center space-x-3 py-1">
                  <Switch
                    id="multiple-selections"
                    checked={allowMultipleSelections}
                    onCheckedChange={(checked) => {
                      setAllowMultipleSelections(checked);
                      // Update the actual field type based on the toggle
                      if (fieldType === 'dropdown_single' || fieldType === 'dropdown_multi') {
                        setFieldType(checked ? 'dropdown_multi' : 'dropdown_single');
                      }
                      // Taxonomy is always multi-select, so don't change it
                    }}
                    disabled={fieldType === 'taxonomy'} // Taxonomy is always multi-select
                  />
                  <Label htmlFor="multiple-selections" className="text-sm font-medium text-gray-700">
                    Allow Multiple Selections
                    {fieldType === 'taxonomy' && (
                      <span className="text-xs text-gray-500 ml-2">(Always enabled for taxonomy)</span>
                    )}
                  </Label>
                </div>
              )}

              {/* Values Section for Dropdown Fields */}
              {showDropdownOptions && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Values</Label>
                  <div className="space-y-3">
                    <Textarea
                      value={optionsPaste}
                      onChange={(e) => setOptionsPaste(e.target.value)}
                      placeholder={`Enter values (one per line or comma-separated):\n\nExample:\nPending\nApproved\nPaid\n\nOr: Pending, Approved, Paid`}
                      className="min-h-[182px] resize-y focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary focus:ring-0 bg-white dark:bg-gray-800"
                      rows={9}
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="flex-shrink-0 flex justify-between items-center mt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-9"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem 
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Field
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="flex gap-3">
              <SheetClose asChild>
                <Button variant="outline" size="sm" className="h-9">
                  Cancel
                </Button>
              </SheetClose>
              <Button 
                onClick={handleSave}
                size="sm"
                className="h-9"
                disabled={!fieldName.trim()}
              >
                {hasUnsavedChanges ? 'Save Changes' : 'Save'}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the field "{field?.name}"? This will permanently remove the field and all {field?.prompts.length} prompt{field?.prompts.length !== 1 ? 's' : ''} associated with it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteField}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Field
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Helper function to parse options from textarea
function parseOptions(input: string): string[] {
  if (!input.trim()) return [];
  
  // First try splitting by newlines
  let options = input.split('\n')
    .map(line => line.trim())
    .filter(line => line);
  
  // If we only got one line, try splitting by commas
  if (options.length === 1 && options[0].includes(',')) {
    options = options[0].split(',')
      .map(item => item.trim())
      .filter(item => item);
  }
  
  // Remove duplicates while preserving order
  const seen = new Set<string>();
  return options.filter(option => {
    if (seen.has(option)) return false;
    seen.add(option);
    return true;
  });
} 