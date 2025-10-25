'use client';

import React, { useState } from 'react';
import { Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { transformToBoxTemplate, validateBoxTemplate } from '../utils/box-transformer';
import { createMetadataTemplate, checkTemplateExists } from '@/services/box';
import type { Template } from '../types';

interface CreateBoxTemplateDialogProps {
  selectedTemplate: Template | null;
}

export function CreateBoxTemplateDialog({ selectedTemplate }: CreateBoxTemplateDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateTemplate = async () => {
    if (!selectedTemplate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No template selected.',
      });
      return;
    }

    setIsCreating(true);

    try {
      // First check if template already exists in Box
      const exists = await checkTemplateExists(selectedTemplate.name);
      
      if (exists) {
        toast({
          variant: 'destructive',
          title: 'Template Already Exists',
          description: `A template named "${selectedTemplate.name}" already exists in Box. Please rename your template or use a different name.`,
        });
        setIsCreating(false);
        setIsDialogOpen(false);
        return;
      }

      // Transform the template to Box API format
      const boxTemplate = transformToBoxTemplate(selectedTemplate);

      // Validate the template
      if (!validateBoxTemplate(boxTemplate)) {
        const errors = boxTemplate._validation?.errors || [];
        toast({
          variant: 'destructive',
          title: 'Template Validation Failed',
          description: `Template has validation errors: ${errors.join(', ')}`,
        });
        setIsCreating(false);
        setIsDialogOpen(false);
        return;
      }

      // Create the template in Box
      const createdTemplate = await createMetadataTemplate(boxTemplate);

      toast({
        title: 'Template Created Successfully',
        description: `Template "${selectedTemplate.name}" has been created in Box with key "${createdTemplate.templateKey}".`,
        duration: 4000,
      });

      console.log('✅ Box template created:', createdTemplate);
      
    } catch (error) {
      console.error('❌ Failed to create Box template:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Create Template',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while creating the template in Box.',
      });
    } finally {
      setIsCreating(false);
      setIsDialogOpen(false);
    }
  };

  // Don't render anything if no template is selected
  if (!selectedTemplate) {
    return null;
  }

  return (
    <>
      {/* Trigger Button */}
      <Button 
        variant="outline"
        onClick={() => setIsDialogOpen(true)}
        className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
      >
        <Box className="mr-1.5 h-4 w-4" />
        Create Template in Box
      </Button>

      {/* Confirmation Dialog */}
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Template in Box</AlertDialogTitle>
          </AlertDialogHeader>
          
          {/* Content area - no nested p elements */}
          <div className="space-y-4 py-2">
            <div className="text-sm text-gray-700">
              Are you sure you want to create the template <strong>"{selectedTemplate.name}"</strong> in Box?
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">This will:</div>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
                <li>Create a new metadata template in your Box enterprise</li>
                <li>Include all {selectedTemplate.fields.length} fields with their prompts</li>
                <li>Store prompts in field descriptions (not visible to users)</li>
                <li>Convert field types to Box-compatible formats</li>
              </ul>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCreating}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCreateTemplate}
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? 'Creating...' : 'Create Template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 