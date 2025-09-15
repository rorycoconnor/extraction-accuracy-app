import React from 'react';
import { Star, ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Prompt } from '../types';
import { usePromptFinder } from '../hooks/use-prompt-finder';
import { cn } from '@/lib/utils';

interface PromptPickerDialogProps {
  fieldName: string;
  onSelectPrompt: (text: string) => void;
  triggerButtonContent?: React.ReactNode;
}

export function PromptPickerDialog({ fieldName, onSelectPrompt, triggerButtonContent }: PromptPickerDialogProps) {
  const { findMatchingPrompts } = usePromptFinder();
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  
  const matchingPrompts = findMatchingPrompts(fieldName);

  if (!matchingPrompts.hasPrompts || !matchingPrompts.prompts) {
    return null;
  }

  // Sort prompts by rating (up - down) to show best rated first
  const sortedPrompts = [...matchingPrompts.prompts].sort((a, b) => 
    (b.up - b.down) - (a.up - a.down)
  );

  const currentPrompt = sortedPrompts[currentIndex];
  const hasMultiplePrompts = sortedPrompts.length > 1;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % sortedPrompts.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + sortedPrompts.length) % sortedPrompts.length);
  };

  const handleSelect = () => {
    onSelectPrompt(currentPrompt.text);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          title="Use prompt from library"
        >
          {triggerButtonContent || (
            <>
              <Star className="h-4 w-4" />
              Prompt
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Library Prompts</DialogTitle>
          <DialogDescription>
            Browse prompts for "{fieldName}" from {matchingPrompts.categoryName} → {matchingPrompts.templateName}
          </DialogDescription>
        </DialogHeader>

        <div className="relative py-4">
          {/* Navigation Buttons */}
          {hasMultiplePrompts && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
                onClick={handlePrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
                onClick={handleNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Prompt Display */}
          <div className="px-8">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm whitespace-pre-wrap break-words">
                {currentPrompt.text}
              </p>
              <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                {/* Show blue pin icon if prompt is pinned */}
                {currentPrompt.isPinned && (
                  <Pin className="h-4 w-4 text-blue-600 fill-current" />
                )}
                <span>👍 {currentPrompt.up}</span>
                <span>👎 {currentPrompt.down}</span>
              </div>
            </div>

            {hasMultiplePrompts && (
              <div className="flex justify-center gap-1 mt-4">
                {sortedPrompts.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      idx === currentIndex
                        ? "bg-primary"
                        : "bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect}>
            Select Prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 