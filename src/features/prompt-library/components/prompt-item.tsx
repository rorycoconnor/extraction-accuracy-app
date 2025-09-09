'use client';

import React from 'react';
import { ThumbsUp, ThumbsDown, Copy, MoreHorizontal, Trash2, Pencil, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Prompt } from '../types';
import { usePromptLibrary } from '../hooks/use-prompt-library';
import { cn } from '@/lib/utils';
import { EditPromptDialog } from './edit-prompt-dialog';

interface PromptItemProps {
  prompt: Prompt;
  templateId: string;
  fieldId: string;
  rank: number;
  fieldName: string;
}

export function PromptItem({ prompt, templateId, fieldId, rank, fieldName }: PromptItemProps) {
  const { updatePromptRating, deletePrompt, copyToClipboard, editPrompt, togglePinPrompt } = usePromptLibrary();
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    if (rank === 2) return 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
  };

  const handleRating = (type: 'up' | 'down') => {
    updatePromptRating(templateId, fieldId, prompt.id, type);
  };

  const handleCopy = () => {
    copyToClipboard(prompt.text);
  };

  const handleDelete = () => {
    deletePrompt(templateId, fieldId, prompt.id);
    setIsDeleteDialogOpen(false);
  };

  const handleEdit = (newText: string) => {
    editPrompt(templateId, fieldId, prompt.id, newText);
  };

  const handleTogglePin = () => {
    togglePinPrompt(templateId, fieldId, prompt.id);
  };

  return (
    <>
      <div className="flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
        {/* Rank Badge */}
        <Badge variant="secondary" className={cn('text-xs font-semibold min-w-[2rem] justify-center', getRankColor(rank))}>
          {rank}
        </Badge>

        {/* Prompt Content */}
        <div className="flex-1">
          {/* First line with prompt text and inline actions */}
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed flex-1">
              {prompt.text}
            </p>

            {/* Inline Actions - voting and utility buttons */}
            <div className="flex items-center flex-shrink-0">
              {/* Rating Buttons Group */}
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRating('up')}
                  className="h-8 px-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {prompt.up}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRating('down')}
                  className="h-8 px-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  {prompt.down}
                </Button>
              </div>

              {/* Utility Actions - with consistent spacing */}
              <div className="flex items-center">
                <div className="px-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTogglePin}
                    className={cn(
                      "h-8 w-8 text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700",
                      prompt.isPinned && "text-blue-600 dark:text-blue-400"
                    )}
                  >
                    <Pin className={cn("h-3 w-3", prompt.isPinned && "fill-current")} />
                  </Button>
                </div>

                <div className="px-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8 w-8 text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                <div className="px-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => setIsEditDialogOpen(true)}
                        className="text-gray-700 dark:text-gray-300 focus:text-gray-900 dark:focus:text-gray-100"
                      >
                        <Pencil className="h-3 w-3 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="text-gray-700 dark:text-gray-300 focus:text-gray-900 dark:focus:text-gray-100"
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditPromptDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        initialText={prompt.text}
        onSave={handleEdit}
        fieldName={fieldName}
      />

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this prompt? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 