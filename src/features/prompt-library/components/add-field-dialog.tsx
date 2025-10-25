'use client';

import React, { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import type { Template } from '../types';

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTemplates: Template[];
  addField: (templateId: string, fieldName: string, fieldType: string) => void;
}

export function AddFieldDialog({
  open,
  onOpenChange,
  availableTemplates,
  addField
}: AddFieldDialogProps) {
  const { toast } = useToast();
  const [newFieldName, setNewFieldName] = useState('');
  const [selectedTemplateForField, setSelectedTemplateForField] = useState('');
  const [selectedFieldType, setSelectedFieldType] = useState('');

  const fieldTypes = ['text', 'number', 'date', 'dropdown_single', 'dropdown_multi', 'taxonomy'];

  const handleAddField = () => {
    if (!newFieldName.trim()) {
      toast({
        title: 'Field Name Required',
        description: 'Please enter a valid field name.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedTemplateForField) {
      toast({
        title: 'Template Required',
        description: 'Please select a template for the field.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFieldType) {
      toast({
        title: 'Field Type Required',
        description: 'Please select a field type.',
        variant: 'destructive',
      });
      return;
    }

    addField(selectedTemplateForField, newFieldName.trim(), selectedFieldType);
    
    const selectedTemplate = availableTemplates.find(t => t.id === selectedTemplateForField);
    toast({
      title: 'Field Added',
      description: `Successfully added field "${newFieldName}" to template "${selectedTemplate?.name}".`,
      duration: 3000,
    });

    // Reset and close
    setNewFieldName('');
    setSelectedTemplateForField('');
    setSelectedFieldType('');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddField();
    }
  };

  const handleClose = () => {
    setNewFieldName('');
    setSelectedTemplateForField('');
    setSelectedFieldType('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              className="bg-white dark:bg-gray-800"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fieldTemplate">Template</Label>
            <Select 
              value={selectedTemplateForField} 
              onValueChange={setSelectedTemplateForField}
            >
              <SelectTrigger className="bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800">
                {availableTemplates.map((template) => (
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
              <SelectTrigger className="bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select field type" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800">
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
          <Button variant="outline" onClick={handleClose}>
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
  );
} 