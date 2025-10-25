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

interface AddTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  addTemplate: (templateName: string, categoryName: string) => void;
}

export function AddTemplateDialog({
  open,
  onOpenChange,
  categories,
  addTemplate
}: AddTemplateDialogProps) {
  const { toast } = useToast();
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedCategoryForTemplate, setSelectedCategoryForTemplate] = useState('');

  const handleAddTemplate = () => {
    if (!newTemplateName.trim()) {
      toast({
        title: 'Template Name Required',
        description: 'Please enter a valid template name.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedCategoryForTemplate) {
      toast({
        title: 'Category Required',
        description: 'Please select a category for the template.',
        variant: 'destructive',
      });
      return;
    }

    addTemplate(newTemplateName.trim(), selectedCategoryForTemplate);
    
    toast({
      title: 'Template Added',
      description: `Successfully created template "${newTemplateName}" in category "${selectedCategoryForTemplate}".`,
      duration: 3000,
    });

    // Reset and close
    setNewTemplateName('');
    setSelectedCategoryForTemplate('');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTemplate();
    }
  };

  const handleClose = () => {
    setNewTemplateName('');
    setSelectedCategoryForTemplate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              className="bg-white dark:bg-gray-800"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="templateCategory">Category</Label>
            <Select 
              value={selectedCategoryForTemplate} 
              onValueChange={setSelectedCategoryForTemplate}
            >
              <SelectTrigger className="bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800">
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
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
            onClick={handleAddTemplate} 
            disabled={!newTemplateName.trim() || !selectedCategoryForTemplate}
          >
            Add Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 