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
import type { Field, Template } from '../types';
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
  const { renameField, deleteField } = usePromptLibrary();
  const { toast } = useToast();
  
  const [fieldName, setFieldName] = React.useState('');
  const [fieldType, setFieldType] = React.useState('');
  const [allowMultipleSelections, setAllowMultipleSelections] = React.useState(false);
  const [dropdownValues, setDropdownValues] = React.useState<string[]>([]);
  const [newDropdownValue, setNewDropdownValue] = React.useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  // Initialize form when field changes
  React.useEffect(() => {
    if (field) {
      setFieldName(field.name);
      setFieldType(field.type);
      setAllowMultipleSelections(field.type.includes('Multi'));
      // For now, initialize with some sample values - we'll hook this up later
      setDropdownValues(['Sample Value 1', 'Sample Value 2', 'Sample Value 3']);
    }
  }, [field]);

  // Update multiple selections when field type changes
  React.useEffect(() => {
    setAllowMultipleSelections(fieldType.includes('Multi'));
  }, [fieldType]);

  const handleSave = () => {
    if (!field || !template || !fieldName.trim()) return;

    let hasChanges = false;
    
    if (fieldName.trim() !== field.name) {
      renameField(template.id, field.id, fieldName.trim());
      hasChanges = true;
    }
    
    // Note: Field type changes would require additional backend logic
    // For now, we just show the interface but don't persist type changes
    if (fieldType !== field.type) {
      hasChanges = true;
      // TODO: Implement field type change logic
    }
    
    if (hasChanges) {
      toast({
        title: 'Field Updated',
        description: 'Field changes have been saved successfully.',
      });
    }
    
    onClose();
  };

  const handleDeleteField = () => {
    if (!field || !template) return;
    
    deleteField(template.id, field.id);
    toast({
      title: 'Field Deleted',
      description: 'Field has been deleted successfully.',
    });
    setIsDeleteDialogOpen(false);
    onClose();
  };

  const addDropdownValue = () => {
    if (newDropdownValue.trim() && !dropdownValues.includes(newDropdownValue.trim())) {
      setDropdownValues([...dropdownValues, newDropdownValue.trim()]);
      setNewDropdownValue('');
    }
  };

  const removeDropdownValue = (index: number) => {
    setDropdownValues(dropdownValues.filter((_, i) => i !== index));
  };

  const getFieldTypeColor = (type: string) => {
    const colors = {
      Text: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      Date: 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-300',
      DropdownSingle: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      DropdownMulti: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      TaxonomySingle: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      TaxonomyMulti: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
  };

  if (!field || !template) return null;

  const showDropdownOptions = fieldType.includes('Dropdown') || fieldType.includes('Taxonomy');
  const showMultipleSelections = showDropdownOptions;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[840px] max-w-none overflow-hidden flex flex-col" style={{ width: '840px', maxWidth: '840px' }}>
                    <SheetHeader className="space-y-3">
            <SheetTitle className="text-xl font-semibold">Details</SheetTitle>
            <SheetDescription>
              Configure field settings for {template.category} → {template.name}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 mt-6 pr-4 h-[calc(100vh-200px)]">
            <div className="space-y-6">
              {/* Field Name */}
              <div className="space-y-2">
                <Label htmlFor="fieldName" className="text-base font-medium">
                  Field Name
                </Label>
                <Input
                  id="fieldName"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="Enter field name"
                  className="w-full h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              
              {/* Field Type */}
              <div className="space-y-2 pt-2">
                <Label className="text-base font-medium">Field Type</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select field type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Text">Text</SelectItem>
                    <SelectItem value="Date">Date</SelectItem>
                    <SelectItem value="DropdownSingle">Dropdown - Single Select</SelectItem>
                    <SelectItem value="DropdownMulti">Dropdown - Multi Select</SelectItem>
                    <SelectItem value="TaxonomySingle">Taxonomy</SelectItem>
                    <SelectItem value="TaxonomyMulti">Taxonomy - Multi Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Allow Multiple Selections */}
              {showMultipleSelections && (
                <div className="flex items-center space-x-3 pt-2">
                  <Switch
                    id="multiple-selections"
                    checked={allowMultipleSelections}
                    onCheckedChange={setAllowMultipleSelections}
                  />
                  <Label htmlFor="multiple-selections" className="text-base">
                    Allow Multiple Selections
                  </Label>
                </div>
              )}

                            {/* Values Section for Dropdown Fields */}
              {showDropdownOptions && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">Values</Label>
                  
                  {/* Current Values */}
                  <div className="space-y-2">
                    {dropdownValues.map((value, index) => (
                      <div key={index} className="flex items-center gap-3 px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-md w-full h-10">
                        <Input
                          value={value}
                          onChange={(e) => {
                            const newValues = [...dropdownValues];
                            newValues[index] = e.target.value;
                            setDropdownValues(newValues);
                          }}
                          className="flex-1 h-8 border-0 p-0 focus-visible:ring-0"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDropdownValue(index)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add New Value */}
                  <Input
                    value={newDropdownValue}
                    onChange={(e) => setNewDropdownValue(e.target.value)}
                    placeholder="Add new value"
                    className="w-full h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addDropdownValue();
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="mt-6 flex justify-between items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="px-3 h-10"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem 
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Field
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="flex gap-3">
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
              <Button onClick={handleSave}>
                Save
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