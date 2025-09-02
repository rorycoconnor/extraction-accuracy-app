'use client';

import React, { useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Field, Template } from '../types';
import { usePromptLibrary } from '../hooks/use-prompt-library';
import { PromptItem } from './prompt-item';
import { FieldDetailsSheet } from './field-details-sheet';

interface FieldCardProps {
  field: Field;
  template: Template;
}

export function FieldCard({ field, template }: FieldCardProps) {
  const { addPrompt } = usePromptLibrary();
  const [newPromptText, setNewPromptText] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFieldDetailsOpen, setIsFieldDetailsOpen] = useState(false);

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

  const handleAddPrompt = () => {
    if (newPromptText.trim()) {
      addPrompt(template.id, field.id, newPromptText);
      setNewPromptText('');
      setIsDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAddPrompt();
    }
  };



  // Sort prompts: pinned first, then by rating (up - down)
  const sortedPrompts = React.useMemo(() => {
    return [...field.prompts].sort((a, b) => {
      // First sort by pin status
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // Then sort by rating
      const aRating = a.up - a.down;
      const bRating = b.up - b.down;
      if (aRating !== bRating) return bRating - aRating;
      
      // Finally sort by creation date
      return b.createdAt - a.createdAt;
    });
  }, [field.prompts]);

  return (
    <Card className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader className={field.prompts.length === 0 ? "pb-5" : "pb-3"}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {field.name}
              </h3>
              <Badge className={`${getFieldTypeColor(field.type)} border-transparent`}>
                {field.type}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {template.category} → {template.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Plus className="h-3 w-3" />
                  Add Prompt
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Prompt</DialogTitle>
                <DialogDescription>
                  Add a new prompt for "{field.name}" in {template.category} → {template.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt Text</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Enter your prompt text..."
                    value={newPromptText}
                    onChange={(e) => setNewPromptText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[120px] resize-none font-mono text-sm"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to save quickly
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPrompt} disabled={!newPromptText.trim()}>
                  Add Prompt
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

            <Button 
              variant="outline" 
              size="sm" 
              className="px-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => setIsFieldDetailsOpen(true)}
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {field.prompts.length > 0 && (
        <CardContent className="space-y-3 pb-5">
          {sortedPrompts.map((prompt, index) => (
            <PromptItem
              key={prompt.id}
              prompt={prompt}
              templateId={template.id}
              fieldId={field.id}
              rank={index + 1}
              fieldName={field.name}
            />
          ))}
        </CardContent>
      )}

      {/* Field Details Sheet */}
      <FieldDetailsSheet
        isOpen={isFieldDetailsOpen}
        onClose={() => setIsFieldDetailsOpen(false)}
        field={field}
        template={template}
      />
    </Card>
  );
} 