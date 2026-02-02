'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getBoxTemplatesWithTaxonomyOptions } from '@/lib/actions/box';
import type { BoxTemplate } from '@/lib/types';
import { Loader2, Terminal } from 'lucide-react';
import { logger } from '@/lib/logger';

type NewTemplateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddTemplates: (templates: BoxTemplate[]) => void;
  existingTemplates: BoxTemplate[];
};

export default function NewTemplateDialog({
  isOpen,
  onClose,
  onAddTemplates,
  existingTemplates,
}: NewTemplateDialogProps) {
  const [allTemplates, setAllTemplates] = useState<BoxTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      setSelectedTemplateIds(new Set());
      getBoxTemplatesWithTaxonomyOptions()
        .then(setAllTemplates)
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'An unknown error occurred.');
          logger.error('Error', err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  const handleToggleSelection = (templateId: string) => {
    setSelectedTemplateIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };
  
  const handleAddClick = () => {
    const templatesToAdd = allTemplates.filter(t => selectedTemplateIds.has(t.id));
    onAddTemplates(templatesToAdd);
    onClose();
  };

  const availableTemplates = allTemplates.filter(t => !existingTemplates.some(et => et.id === t.id));

  const renderTemplateList = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
             <div key={i} className="flex items-center space-x-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          ))}
        </div>
      );
    }
    if (error) {
      return (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Fetching Templates</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    if(availableTemplates.length === 0) {
      return <p className="text-sm text-center text-muted-foreground py-8">All available templates have been configured.</p>
    }
    return (
      <div className="space-y-3">
        {availableTemplates.map(template => (
          <div key={template.id} className="flex items-center space-x-3">
            <Checkbox
              id={`template-${template.id}`}
              checked={selectedTemplateIds.has(template.id)}
              onCheckedChange={() => handleToggleSelection(template.id)}
            />
            <Label htmlFor={`template-${template.id}`} className="flex-1 cursor-pointer font-normal">
              {template.displayName}
            </Label>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Templates</DialogTitle>
          <DialogDescription>
            Select templates from your Box account to configure for extraction.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] pr-6 -mr-6">
          {renderTemplateList()}
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAddClick} disabled={selectedTemplateIds.size === 0 || isLoading}>
            Add {selectedTemplateIds.size > 0 ? `${selectedTemplateIds.size} Template(s)` : 'Templates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
