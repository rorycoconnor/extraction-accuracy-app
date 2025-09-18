import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AccuracyData, AccuracyField } from '@/lib/types';
import { cn, formatModelName, NOT_PRESENT_VALUE } from '@/lib/utils';
import { compareValues, type ComparisonResult } from '@/lib/metrics';
import { MousePointer2, Play, RotateCcw, Clock } from 'lucide-react';
import { calculateModelSummaries, assignRanks } from '@/lib/model-ranking-utils';

type ExtractionTableProps = {
  data: AccuracyData;
  shownColumns: Record<string, boolean>;
  showMetrics: boolean;
  onOpenPromptStudio: (field: AccuracyField) => void;
  onOpenInlineEditor?: (fileId: string, fieldKey: string) => void;
  onRunSingleField?: (field: AccuracyField) => void;
  onRunSingleFieldForFile?: (field: AccuracyField, fileId: string) => void;
  recentlyChangedPrompts?: Set<string>; // Track which field prompts were recently changed
  isExtracting?: boolean;
  extractingFields?: Set<string>; // Track which fields are currently being extracted
};

export default function ExtractionTable({ 
  data, 
  shownColumns, 
  showMetrics, 
  onOpenPromptStudio, 
  onOpenInlineEditor,
  onRunSingleField,
  onRunSingleFieldForFile,
  recentlyChangedPrompts = new Set(),
  isExtracting = false,
  extractingFields = new Set()
}: ExtractionTableProps) {
  const { fields, results, averages } = data;
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  
  // State for tracking expanded cells
  const [expandedCells, setExpandedCells] = React.useState<Set<string>>(new Set());
  
  // Function to toggle cell expansion
  const toggleCellExpansion = (cellId: string) => {
    setExpandedCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cellId)) {
        newSet.delete(cellId);
      } else {
        newSet.add(cellId);
      }
      return newSet;
    });
  };

  // Function to truncate text and determine if it should be expandable
  const getTruncatedText = (text: string, cellId: string, maxLength: number = 150) => {
    if (!text || text.length <= maxLength) {
      return { displayText: text, canExpand: false };
    }
    
    const isExpanded = expandedCells.has(cellId);
    const displayText = isExpanded ? text : text.substring(0, maxLength) + '...';
    
    return { displayText, canExpand: true, isExpanded };
  };
  
  // Conditional wrapper classes
  const wrapperClassName = isHomePage 
    ? "flex flex-col h-full w-full"
    : "flex flex-col h-full w-full rounded-b-lg border";

  const orderedColumnKeys = React.useMemo(() => {
    if (!results?.[0]?.fields || !fields?.[0]) return [];
    
    const firstResultField = results[0].fields[fields[0].key];
    if (!firstResultField) return [];

    const allModelsInData = Object.keys(firstResultField);
    const models = allModelsInData.filter(key => key !== 'Ground Truth');
    
    // Sort models by performance if we have averages data
    let sortedModels = models;
    if (averages && fields.length > 0) {
      try {
        // Check if we have ground truth data
        const hasGroundTruthData = results.some(result => 
          Object.values(result.fields).some(field => 
            field['Ground Truth'] && field['Ground Truth'].trim() !== ''
          )
        );
        
        if (hasGroundTruthData) {
          // Calculate model summaries and rank them
          const modelSummaries = calculateModelSummaries(models, fields, averages, data.fieldSettings);
          assignRanks(modelSummaries);
          
          // Extract the model names in order of performance (best first)
          sortedModels = modelSummaries.map(summary => summary.modelName);
        } else {
          // Fallback to alphabetical if no ground truth
          sortedModels = models.sort();
        }
      } catch (error) {
        console.warn('Failed to sort models by performance, using alphabetical order:', error);
        sortedModels = models.sort();
      }
    } else {
      // Fallback to alphabetical sorting if no performance data
      sortedModels = models.sort();
    }

    // Always put Ground Truth first
    return ['Ground Truth', ...sortedModels];
  }, [results, fields, averages]);
  
  const visibleColumns = orderedColumnKeys.filter(key => shownColumns[key]);

  const getComparisonResult = (modelValue: string, groundTruth: string): ComparisonResult => {
    return compareValues(modelValue, groundTruth);
  };

  const getCellBackgroundClass = (comparison: ComparisonResult, colName: string, groundTruth: string, modelValue: string, isPending: boolean, isError: boolean, isNotPresent: boolean) => {
    // Don't apply background for Ground Truth column
    if (colName === 'Ground Truth') return '';
    
    // Don't apply background for pending or error states
    if (isPending || isError) return '';
    
    // Handle "Not Present" cases
    if (isNotPresent) {
      // If there's ground truth but model returned "Not Present", it's a mismatch
      if (groundTruth && groundTruth.trim() !== '' && groundTruth !== NOT_PRESENT_VALUE) {
        return 'bg-red-50 dark:bg-red-950/20 text-destructive'; // Red for mismatches
      }
      // If no ground truth or ground truth is also "Not Present", no special background
      return '';
    }
    
    // For regular values, check if we have both ground truth and model value
    if (!groundTruth || !modelValue) return '';
    
    if (comparison.isMatch) {
      switch (comparison.matchType) {
        case 'exact':
        case 'normalized':
          return ''; // No special background for exact matches
        case 'date_format':
          return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'; // Yellow for date format differences
        case 'partial':
          return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'; // Blue for partial matches
        default:
          return '';
      }
    } else {
      return 'bg-red-50 dark:bg-red-950/20 text-destructive'; // Red for mismatches
    }
  };



  const renderFieldRunButton = (field: AccuracyField) => {
    const isRecentlyChanged = recentlyChangedPrompts.has(field.key);
    const isExtracting = extractingFields.has(field.key);
    const showButton = onRunSingleField && (isRecentlyChanged || true); // Show always for now, can be made conditional

    if (!showButton) return null;

    const buttonContent = isExtracting ? (
      <RotateCcw className="h-3 w-3 animate-spin" />
    ) : (
      <Play className="h-3 w-3" />
    );

    const tooltipContent = isRecentlyChanged 
      ? "Prompt recently changed - click to test this field across all files"
      : "Run AI extraction for this field across all files";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0 ml-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity",
                isRecentlyChanged && "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 animate-pulse opacity-100",
                isExtracting && "cursor-not-allowed opacity-100"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (!isExtracting && onRunSingleField) {
                  onRunSingleField(field);
                }
              }}
              disabled={isExtracting}
            >
              {buttonContent}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{tooltipContent}</p>
            {isRecentlyChanged && (
              <p className="text-xs text-orange-500 font-medium">✨ Prompt updated!</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderSingleFileRunButton = (field: AccuracyField, fileId: string) => {
    const isExtracting = extractingFields.has(`${field.key}-${fileId}`);
    
    if (!onRunSingleFieldForFile) return null;

    const buttonContent = isExtracting ? (
      <RotateCcw className="h-2 w-2 animate-spin" />
    ) : (
      <Play className="h-2 w-2" />
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-4 w-4 p-0 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity absolute top-1 right-1",
                isExtracting && "cursor-not-allowed opacity-100"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (!isExtracting) {
                  onRunSingleFieldForFile(field, fileId);
                }
              }}
              disabled={isExtracting}
            >
              {buttonContent}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Test this field for this file only</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className={wrapperClassName}>
      <div className="flex-1 min-h-0 overflow-auto">
        <Table 
          className="border-collapse extraction-table" 
          style={{
            borderSpacing: 0,
          }}
        >
          {/* Force borders with explicit header row targeting */}
          <style dangerouslySetInnerHTML={{
            __html: `
              .extraction-table {
                border-collapse: collapse;
              }
              .extraction-table th,
              .extraction-table td {
                border-right: 1px solid hsl(var(--border));
                border-bottom: 1px solid hsl(var(--border));
              }
              /* Force borders on header rows with maximum specificity */
              .extraction-table thead tr:nth-child(1) {
                border-bottom: 1px solid hsl(var(--border)) !important;
              }
              .extraction-table thead tr:nth-child(2) {
                border-bottom: 1px solid hsl(var(--border)) !important;
              }
              .extraction-table thead tr:nth-child(1) th,
              .extraction-table thead tr:nth-child(2) th,
              .extraction-table thead tr:nth-child(3) th {
                border-bottom: 1px solid hsl(var(--border)) !important;
              }
              .extraction-table .thick-border-right {
                border-right: 2px solid hsl(var(--foreground) / 0.2);
              }
              .extraction-table .thick-border-bottom {
                border-bottom: 2px solid hsl(var(--foreground) / 0.2);
              }
            `
          }} />
          <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
            {/* Row 1: Field Names */}
            <TableRow>
              <TableHead 
                rowSpan={3} 
                className="sticky left-0 top-0 z-30 min-w-[140px] w-[140px] thick-border-right bg-muted align-middle"
              >
                <div className="p-2 font-semibold text-foreground">File Name</div>
              </TableHead>
              {fields.map((field, index) => (
                <TableHead
                  key={field.key}
                  colSpan={visibleColumns.length || 1}
                  className={cn(
                    'p-2 text-center align-middle font-semibold text-foreground whitespace-normal break-words relative group',
                     index % 2 === 1 ? 'bg-muted' : 'bg-card',
                     index < fields.length - 1 ? 'thick-border-right' : ''
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>{field.name}</span>
                    {recentlyChangedPrompts.has(field.key) && (
                      <Clock className="h-3 w-3 text-orange-500 animate-pulse" />
                    )}
                    {renderFieldRunButton(field)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
            
            {/* Row 2: Prompts */}
            <TableRow>
              {fields.map((field, index) => (
                <TableHead
                  key={`${field.key}-prompt`}
                  colSpan={visibleColumns.length || 1}
                  className={cn(
                    'p-2 align-top text-xs font-normal text-muted-foreground whitespace-normal text-left',
                     index % 2 === 1 ? 'bg-muted' : 'bg-card',
                     index < fields.length - 1 ? 'thick-border-right' : ''
                  )}
                >
                  <div 
                    className="group/prompt flex cursor-pointer items-start justify-start gap-2 hover:text-primary"
                    onClick={() => onOpenPromptStudio(field)}
                  >
                    <MousePointer2 className="h-3 w-3 shrink-0 mt-0.5 opacity-50 group-hover/prompt:opacity-100" />
                    <span 
                      className="min-w-0 break-words text-xs leading-tight" 
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {field.prompt || (
                        <span className="italic text-muted-foreground/70">
                          Only if required add prompt to improve results (optional)
                        </span>
                      )}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
            
            {/* Row 3: Model Names - Added consistent border-bottom */}
            <TableRow>
              {fields.map((field, fieldIndex) => (
                <React.Fragment key={`${field.key}-sub`}>
                  {visibleColumns.map((colName, colIndex) => (
                    <TableHead
                      key={colName}
                      className={cn(
                          'min-w-[140px] w-[140px]',
                          'text-center h-10 p-2 text-sm font-normal',
                          fieldIndex % 2 === 1 ? 'bg-muted' : 'bg-card',
                          colIndex === visibleColumns.length - 1 && fieldIndex < fields.length - 1 ? 'thick-border-right' : ''
                      )}
                      >
                      <div className="flex items-center justify-center gap-1">
                        {formatModelName(colName)}
                        {colName === 'Ground Truth' && onOpenInlineEditor && (
                          <MousePointer2 className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableHead>
                  ))}
                  {visibleColumns.length === 0 && (
                       <TableHead className={cn(
                         'text-center h-10', 
                         fieldIndex % 2 === 1 ? 'bg-muted' : 'bg-card',
                         fieldIndex < fields.length - 1 ? 'thick-border-right' : ''
                       )}></TableHead>
                  )}
                </React.Fragment>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {results.map((result) => (
              <TableRow key={result.id} className="hover:bg-muted/20">
                <TableCell className="sticky left-0 z-10 min-w-[140px] w-[140px] thick-border-right bg-background align-top font-medium">
                  <div>{result.fileName.replace(/\.pdf$|\.docx$|\.jpg$/, '')}</div>
                  <Badge variant="outline" className="mt-1 font-normal">{result.fileType}</Badge>
                </TableCell>
                {fields.map((field, fieldIndex) => {
                   const groundTruth = result.fields[field.key]?.['Ground Truth'] ?? '';
                  return (
                    <React.Fragment key={`${result.id}-${field.key}`}>
                      {visibleColumns.map((colName, colIndex) => {
                        const fieldKey = field.key;
                        const fieldObject = result.fields[fieldKey];
                        const modelValue = fieldObject?.[colName] ?? '';
                        const isPending = modelValue.startsWith('Pending');
                        const isError = modelValue.startsWith('Error:');
                        const isNotPresent = modelValue === NOT_PRESENT_VALUE;
                        const comparison = getComparisonResult(modelValue, groundTruth);
                        const isLastColumnInGroup = colIndex === visibleColumns.length - 1;
                        const cellId = `${result.id}-${fieldKey}-${colName}`;
                        const { displayText, canExpand, isExpanded } = getTruncatedText(modelValue, cellId);

                        return (
                           <TableCell
                            key={colName}
                            className={cn(
                              'min-w-[140px] w-[140px] relative group',
                              fieldIndex % 2 === 1 ? 'bg-muted/50' : '',
                              isLastColumnInGroup && fieldIndex < fields.length - 1 ? 'thick-border-right' : '',
                              getCellBackgroundClass(comparison, colName, groundTruth, modelValue, isPending, isError, isNotPresent)
                            )}
                            onClick={(e) => {
                              // Check if clicking on the "..." span for expansion
                              const target = e.target as HTMLElement;
                              if (target.closest('span') && target.textContent === '...') {
                                toggleCellExpansion(cellId);
                                return;
                              }
                              
                              // Handle ground truth editing - works for both expandable and non-expandable cells
                              if (colName === 'Ground Truth' && onOpenInlineEditor) {
                                onOpenInlineEditor(result.id, field.key);
                              }
                            }}
                          >
                            <div className="p-2 min-h-[2.5rem] flex items-center justify-center text-center relative">
                              {isPending ? (
                                <div className="text-muted-foreground text-xs">Pending...</div>
                              ) : isError ? (
                                <div className="text-destructive text-xs">Error</div>
                              ) : (
                                <span className="break-words">
                                  {displayText}
                                  {canExpand && !isExpanded && (
                                    <span
                                      className="text-blue-600 hover:text-blue-800 cursor-pointer ml-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCellExpansion(cellId);
                                      }}
                                    >
                                      ...
                                    </span>
                                  )}
                                </span>
                              )}

                              {colName !== 'Ground Truth' && onRunSingleFieldForFile && (
                                renderSingleFileRunButton(field, result.id)
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      {visibleColumns.length === 0 && (
                          <TableCell className={cn(
                            'relative group', 
                            fieldIndex % 2 === 1 ? 'bg-muted/50' : '',
                            fieldIndex < fields.length - 1 ? 'thick-border-right' : ''
                          )}>
                            {renderSingleFileRunButton(field, result.id)}
                          </TableCell>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableRow>
            ))}
            {showMetrics && (
              <TableRow className="sticky bottom-0 z-20">
                <TableCell className="sticky left-0 z-10 thick-border-right bg-muted font-bold">Field Averages</TableCell>
                {fields.map((field, fieldIndex) => (
                  <React.Fragment key={`${field.key}-avg`}>
                    {visibleColumns.map((colName, colIndex) => {
                      const isLastColumnInGroup = colIndex === visibleColumns.length - 1;
                      if (colName === 'Ground Truth') {
                        return (
                          <TableCell
                            key={`${colName}-avg`}
                            className={cn(
                              'min-w-[140px] w-[140px]',
                               fieldIndex % 2 === 1 ? 'bg-muted' : 'bg-card',
                              isLastColumnInGroup && fieldIndex < fields.length - 1 ? 'thick-border-right' : ''
                            )}
                          />
                        );
                      }

                      const metrics = averages[field.key]?.[colName] ?? { accuracy: 0, precision: 0, recall: 0, f1: 0 };
                      const accuracy = metrics.accuracy;

                      return (
                        <TableCell
                          key={`${colName}-avg`}
                          className={cn(
                            'min-w-[140px] w-[140px] text-center h-12 py-2',
                            fieldIndex % 2 === 1 ? 'bg-muted' : 'bg-card',
                            isLastColumnInGroup && fieldIndex < fields.length - 1 ? 'thick-border-right' : ''
                          )}
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs font-bold',
                              accuracy < 1.0
                                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                                : 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                            )}
                          >
                            {(accuracy * 100).toFixed(1)}% Accuracy
                          </Badge>
                        </TableCell>
                      );
                    })}
                     {visibleColumns.length === 0 && (
                          <TableCell className={cn(
                            'align-top', 
                            fieldIndex % 2 === 1 ? 'bg-muted' : 'bg-card',
                            fieldIndex < fields.length - 1 ? 'thick-border-right' : ''
                          )}></TableCell>
                      )}
                  </React.Fragment>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
