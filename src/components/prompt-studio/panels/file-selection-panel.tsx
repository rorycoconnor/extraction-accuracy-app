'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FlaskConical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileSelectionPanelProps } from '../types';

export const FileSelectionPanel: React.FC<FileSelectionPanelProps> = ({
  categorizedFiles,
  accuracyData,
  selectedTestFiles,
  setSelectedTestFiles,
  onRunTest,
  onClose,
}) => {
  const handleToggleFile = (fileId: string, checked: boolean) => {
    const newSelected = new Set(selectedTestFiles);
    if (checked) {
      newSelected.add(fileId);
    } else {
      newSelected.delete(fileId);
    }
    setSelectedTestFiles(newSelected);
  };

  const renderFileList = (
    files: typeof categorizedFiles.mismatches,
    label: string,
    colorClass: { text: string; selectedBg: string; selectedBorder: string }
  ) => {
    if (files.length === 0) return null;

    return (
      <div>
        <div className={`text-xs font-medium ${colorClass.text} mb-1 px-2`}>
          {label} ({files.length})
        </div>
        {files.map(file => {
          const isSelected = selectedTestFiles.has(file.id);
          const isDisabled = !isSelected && selectedTestFiles.size >= 3;
          return (
            <label
              key={file.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors",
                isSelected && `${colorClass.selectedBg} ${colorClass.selectedBorder}`,
                !isSelected && !isDisabled && "hover:bg-muted/50 border-border",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={(e) => handleToggleFile(file.id, e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm flex-1">{file.fileName}</span>
            </label>
          );
        })}
      </div>
    );
  };

  const hasNoCategories = 
    categorizedFiles.mismatches.length === 0 && 
    categorizedFiles.partialMatches.length === 0 && 
    categorizedFiles.differentFormats.length === 0 && 
    categorizedFiles.matches.length === 0;

  return (
    <div className="flex flex-col transition-all duration-500 ease-in-out" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      <div className="shrink-0 flex items-center justify-between mb-4 h-8">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold">Select Files to Test</h3>
          <span className="text-xs text-muted-foreground">
            ({selectedTestFiles.size} / 3 selected)
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1 p-4" style={{ scrollbarGutter: 'stable' }}>
          <div className="space-y-2">
            {renderFileList(
              categorizedFiles.mismatches,
              'Mismatches',
              { 
                text: 'text-red-600 dark:text-red-400', 
                selectedBg: 'bg-red-50 dark:bg-red-950/20', 
                selectedBorder: 'border-red-300 dark:border-red-800' 
              }
            )}

            {renderFileList(
              categorizedFiles.partialMatches,
              'Partial Matches',
              { 
                text: 'text-blue-600 dark:text-blue-400', 
                selectedBg: 'bg-blue-50 dark:bg-blue-950/20', 
                selectedBorder: 'border-blue-300 dark:border-blue-800' 
              }
            )}

            {renderFileList(
              categorizedFiles.differentFormats,
              'Different Formats',
              { 
                text: 'text-yellow-600 dark:text-yellow-400', 
                selectedBg: 'bg-yellow-50 dark:bg-yellow-950/20', 
                selectedBorder: 'border-yellow-300 dark:border-yellow-800' 
              }
            )}

            {renderFileList(
              categorizedFiles.matches,
              'Matches',
              { 
                text: 'text-green-600 dark:text-green-400', 
                selectedBg: 'bg-green-50 dark:bg-green-950/20', 
                selectedBorder: 'border-green-300 dark:border-green-800' 
              }
            )}

            {/* Show all files if no comparison was run */}
            {hasNoCategories && accuracyData && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1 px-2">
                  All Files ({accuracyData.results.length})
                </div>
                {accuracyData.results.map(file => {
                  const isSelected = selectedTestFiles.has(file.id);
                  const isDisabled = !isSelected && selectedTestFiles.size >= 3;
                  return (
                    <label
                      key={file.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors",
                        isSelected && "bg-primary/10 border-primary",
                        !isSelected && !isDisabled && "hover:bg-muted/50 border-border",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={(e) => handleToggleFile(file.id, e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm flex-1">{file.fileName}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {/* Run Test Button */}
        <div className="shrink-0 p-4 border-t bg-muted/20">
          <Button
            onClick={onRunTest}
            disabled={selectedTestFiles.size === 0}
            className="w-full"
          >
            <FlaskConical className="mr-2 h-4 w-4" />
            Run Test ({selectedTestFiles.size} file{selectedTestFiles.size !== 1 ? 's' : ''})
          </Button>
        </div>
      </div>
    </div>
  );
};
