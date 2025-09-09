'use client';

import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
  Header,
  ColumnMeta,
} from '@tanstack/react-table';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AccuracyData, AccuracyField } from '@/lib/types';
import { cn, formatModelName, NOT_PRESENT_VALUE } from '@/lib/utils';
import { compareValues, type ComparisonResult } from '@/lib/metrics';
import { MousePointer2, Play, RotateCcw, Clock } from 'lucide-react';
import { calculateModelSummaries, assignRanks } from '@/lib/model-ranking-utils';

// Extend TanStack's ColumnMeta to include our custom properties
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    fieldIndex?: number;
    groupIndex?: number;
    isGroupRightEdge?: boolean;
    modelName?: string;
    field?: AccuracyField;
  }
}

// Types for processed data
interface CellData {
  value: string;
  groundTruth: string;
  fieldKey: string;
  modelName: string;
}

interface ProcessedRowData {
  id: string;
  fileName: string;
  fileType: string;
  [key: string]: string | CellData; // Dynamic field-model combinations
}

type TanStackExtractionTableProps = {
  data: AccuracyData;
  shownColumns: Record<string, boolean>;
  showMetrics: boolean;
  onOpenPromptStudio: (field: AccuracyField) => void;
  onOpenInlineEditor?: (fileId: string, fieldKey: string) => void;
  onRunSingleField?: (field: AccuracyField) => void;
  onRunSingleFieldForFile?: (field: AccuracyField, fileId: string) => void;
  recentlyChangedPrompts?: Set<string>;
  isExtracting?: boolean;
  extractingFields?: Set<string>;
};

// Custom header components
const FileNameHeader = () => (
  <div className="p-2 font-semibold text-foreground">File Name</div>
);

const FieldHeaderGroup = ({ 
  field, 
  recentlyChangedPrompts = new Set(), 
  onOpenPromptStudio,
  onRunSingleField
}: { 
  field: AccuracyField;
  recentlyChangedPrompts?: Set<string>;
  onOpenPromptStudio: (field: AccuracyField) => void;
  onRunSingleField?: (field: AccuracyField) => void;
}) => (
  <div className="flex items-center justify-center gap-2">
    <span>{field.name}</span>
    {recentlyChangedPrompts.has(field.key) && (
      <Clock className="h-3 w-3 text-orange-500 animate-pulse" />
    )}
    {onRunSingleField && (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onRunSingleField(field);
            }}
          >
            <Play className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Run extraction for {field.name}</TooltipContent>
      </Tooltip>
    )}
  </div>
);

const PromptHeader = ({ 
  field, 
  onOpenPromptStudio 
}: { 
  field: AccuracyField;
  onOpenPromptStudio: (field: AccuracyField) => void;
}) => (
  <div 
    className="group/prompt flex cursor-pointer items-start justify-start hover:text-primary"
    onClick={() => onOpenPromptStudio(field)}
  >
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
);

const ModelHeader = ({ 
  modelName, 
  onOpenInlineEditor 
}: { 
  modelName: string;
  onOpenInlineEditor?: boolean;
}) => {
  // Split model name to allow wrapping of (no prompt)
  const fullName = formatModelName(modelName);
  const hasNoPrompt = fullName.includes('(no prompt)');
  const mainName = hasNoPrompt ? fullName.replace(' (no prompt)', '') : fullName;
  
  return (
    <div className="flex flex-col items-center justify-center px-2 py-2 text-center h-full">
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">
        {mainName}
      </span>
      {hasNoPrompt && (
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400 leading-tight mt-1">
          (no prompt)
        </span>
      )}

    </div>
  );
};

// Cell component for file names - optimized for 200px width with text wrapping
const FileNameCell = ({ row }: { row: ProcessedRowData }) => (
  <div className="font-medium text-left p-3 h-full flex flex-col justify-center">
    <div 
      className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight break-words hyphens-auto"
      title={row.fileName}
      style={{
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        lineHeight: '1.2'
      }}
    >
      {row.fileName.replace(/\.pdf$|\.docx$|\.jpg$/, '')}
    </div>
    <Badge variant="outline" className="mt-1 font-normal text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 w-fit">
      {row.fileType}
    </Badge>
  </div>
);

// Cell component for model values
const ModelValueCell = ({ 
  cellData,
  fileId,
  onOpenInlineEditor,
  onRunSingleFieldForFile,
  field,
  expandedCells,
  toggleCellExpansion
}: {
  cellData: CellData;
  fileId: string;
  onOpenInlineEditor?: (fileId: string, fieldKey: string) => void;
  onRunSingleFieldForFile?: (field: AccuracyField, fileId: string) => void;
  field?: AccuracyField;
  expandedCells: Set<string>;
  toggleCellExpansion: (cellId: string) => void;
}) => {
  const { value, groundTruth, fieldKey, modelName } = cellData;
  const isPending = value.startsWith('Pending');
  const isError = value.startsWith('Error:');
  const isNotPresent = value === NOT_PRESENT_VALUE;
  const comparison = compareValues(value, groundTruth);
  
  // Generate unique cell ID for expansion tracking
  const cellId = `${fieldKey}-${modelName}`;
  const { displayText, canExpand, isExpanded } = getTruncatedText(value, cellId, 150, expandedCells);

    const getComparisonClasses = (comparison: ComparisonResult) => {
    // Never apply styling to Ground Truth cells
    if (modelName === 'Ground Truth') {
      return '';
    }
    
    // If there's no Ground Truth to compare against, don't apply any coloring
    if (!groundTruth || groundTruth.trim() === '' || groundTruth === '-') {
      return '';
    }
    
    if (!comparison.isMatch) {
      // Don't show red for empty values
      if (!value || value.trim() === '' || value === '-') {
        return '';
      }
      return 'bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
    
    switch (comparison.matchType) {
      case 'exact':
      case 'normalized':
        return 'bg-green-100/80 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'partial':
        return 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'date_format':
        return 'bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return '';
    }
  };

    // Create cell classes for full background coverage - simplified single row
  const cellClasses = cn(
    "absolute inset-0 flex items-center justify-center text-center px-2 rounded-sm",
    isPending && "text-muted-foreground italic",
    isError && "text-red-700 dark:text-red-400 bg-red-100/60 dark:bg-red-900/30",
    isNotPresent && "text-muted-foreground italic",
    !isPending && !isError && !isNotPresent && getComparisonClasses(comparison)
  );

  // Better display for 250px columns - can show more content
  const displayContent = displayText || '-';

  const handleCellClick = (e: React.MouseEvent) => {
    // Check if clicking on expansion indicator
    const target = e.target as HTMLElement;
    if (target.closest('span') && target.textContent === '...') {
      toggleCellExpansion(cellId);
      return;
    }
    
    // Handle ground truth editing - open inline editor for preview
    if (modelName === 'Ground Truth' && onOpenInlineEditor) {
      onOpenInlineEditor(fileId, fieldKey);
    }
  };

  return (
    <div 
      className="relative w-full h-full cursor-pointer" 
      onClick={handleCellClick}
    >
      <div className={cellClasses}>
        <span 
          className="text-sm leading-tight" 
          title={value} // Show full text on hover
          style={{
            display: '-webkit-box',
            WebkitLineClamp: canExpand && isExpanded ? 'unset' : '2',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {displayContent}
        </span>
      </div>
    </div>
  );
};

// Helper function for text truncation
const getTruncatedText = (text: string, cellId: string, maxLength: number, expandedCells: Set<string>) => {
  if (!text || text.length <= maxLength) {
    return { displayText: text, canExpand: false };
  }
  
  const isExpanded = expandedCells.has(cellId);
  const displayText = isExpanded ? text : text.substring(0, maxLength) + '...';
  
  return { displayText, canExpand: true, isExpanded };
};

export default function TanStackExtractionTable({
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
}: TanStackExtractionTableProps) {
  const { fields, results, averages } = data;
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  
  // Add a force refresh counter to trigger re-renders when Ground Truth changes
  const [refreshCounter, setRefreshCounter] = React.useState(0);
  
  // Force refresh when data.results changes (which includes Ground Truth updates)
  React.useEffect(() => {
    console.log('🔄 TanStack Table: Data changed, refreshing...', results.length);
    setRefreshCounter(prev => prev + 1);
  }, [results]);
  
  // Create a hash of Ground Truth data to detect changes
  const groundTruthHash = React.useMemo(() => {
    const groundTruthValues = results.map(result => 
      fields.map(field => 
        `${result.id}-${field.key}-${result.fields[field.key]?.['Ground Truth'] || ''}`
      ).join('|')
    ).join('||');
    console.log('🔍 TanStack Table: Ground Truth hash:', groundTruthValues.slice(0, 100) + '...');
    return groundTruthValues;
  }, [results, fields]);
  
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



  // Get visible columns (models) based on shownColumns prop
  const visibleColumns = React.useMemo(() => {
    return Object.keys(shownColumns).filter(col => shownColumns[col] !== false);
  }, [shownColumns]);

  // Transform data for TanStack Table
  const processedData = React.useMemo<ProcessedRowData[]>(() => {
    console.log('🔄 TanStack Table: Processing data with results:', results.length);
    
    return results.map(result => {
      const row: ProcessedRowData = {
        id: result.id,
        fileName: result.fileName,
        fileType: result.fileType,
      };
      
      // Add flattened field-model data
      fields.forEach(field => {
        visibleColumns.forEach(modelName => {
          const key = `${field.key}-${modelName}`;
          const groundTruthValue = result.fields[field.key]?.['Ground Truth'] || '';
          
          row[key] = {
            value: result.fields[field.key]?.[modelName] || '',
            groundTruth: groundTruthValue,
            fieldKey: field.key,
            modelName
          };
          
          // Debug Ground Truth values
          if (modelName === 'Ground Truth' && groundTruthValue) {
            console.log(`📝 TanStack Table: Ground Truth for ${result.fileName} - ${field.key}:`, groundTruthValue);
          }
        });
      });
      
      return row;
    });
  }, [results, fields, visibleColumns, refreshCounter, groundTruthHash]);

  // Define columns for TanStack Table
  const columns = React.useMemo<ColumnDef<ProcessedRowData>[]>(() => {
    const dynamicColumns: ColumnDef<ProcessedRowData>[] = [];
    
    // File name column (sticky left)
    dynamicColumns.push({
      id: 'fileName',
      header: FileNameHeader,
      cell: ({ row }) => <FileNameCell row={row.original} />,
      size: 200,
      minSize: 200,
      maxSize: 200,
      enableResizing: false,
    });

    // Create column groups for each field
    fields.forEach((field, fieldIndex) => {
      const groupIdx = fieldIndex; // Group index for this field group
      
      // Create individual model columns for this field
      const fieldColumns: ColumnDef<ProcessedRowData>[] = visibleColumns.map((modelName, colIndex) => ({
        id: `${field.key}-${modelName}`,
        header: () => <ModelHeader modelName={modelName} onOpenInlineEditor={!!onOpenInlineEditor} />,
        cell: ({ row }) => {
          const cellData = row.original[`${field.key}-${modelName}`] as CellData;
          return (
            <ModelValueCell
              cellData={cellData}
              fileId={row.original.id}
              onOpenInlineEditor={onOpenInlineEditor}
              onRunSingleFieldForFile={onRunSingleFieldForFile}
              field={field}
              expandedCells={expandedCells}
              toggleCellExpansion={toggleCellExpansion}
            />
          );
        },
        size: 250,
        minSize: 250,
        maxSize: 250,
        meta: { 
          fieldIndex, 
          groupIndex: groupIdx, 
          isGroupRightEdge: colIndex === visibleColumns.length - 1,
          modelName, 
          field 
        }
      }));

      // Create the field group column
      const fieldGroup: ColumnDef<ProcessedRowData> = {
        id: field.key,
        header: () => (
          <FieldHeaderGroup
            field={field}
            recentlyChangedPrompts={recentlyChangedPrompts}
            onOpenPromptStudio={onOpenPromptStudio}
            onRunSingleField={onRunSingleField}
          />
        ),
        columns: fieldColumns,
        meta: { fieldIndex, groupIndex: groupIdx, field }
      };

      dynamicColumns.push(fieldGroup);
    });

    return dynamicColumns;
  }, [fields, visibleColumns, recentlyChangedPrompts, onOpenPromptStudio, onRunSingleField, onOpenInlineEditor, onRunSingleFieldForFile, expandedCells, toggleCellExpansion]);

  // Create table instance
  const table = useReactTable({
    data: processedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  // Conditional wrapper classes - add consistent padding like other pages
  const wrapperClassName = isHomePage 
    ? "flex flex-col h-full w-full px-4 md:px-8"
    : "flex flex-col h-full w-full rounded-b-lg border px-4 md:px-8";

  return (
    <TooltipProvider>
      <div className={wrapperClassName}>
        {/* Custom styles for borders and sticky positioning */}
        <style jsx>{`

          .table-container {
            position: relative;
            overflow: hidden;
            height: fit-content;
            max-height: 100%;
            border: 1px solid hsl(var(--border));
            border-radius: 12px;
            max-width: 100%;
            background: hsl(var(--background));
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          }
          .table-scroll-area {
            overflow-x: auto;
            overflow-y: auto;
            max-height: 100%;
            margin: -1px;
            padding: 1px;
            position: relative;
          }

          .extraction-table {
            border-collapse: separate;
            border-spacing: 0;
            table-layout: fixed;
            width: max-content;
            min-width: 100%;
          }
          .extraction-table tbody tr:last-child td {
            border-bottom: none;
          }
          .sticky-header {
            position: sticky;
            top: 0;
            z-index: 20;
            box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
          }
          .sticky-column {
            position: sticky;
            left: 0;
            z-index: 10;
            box-shadow: 2px 0 4px 0 rgba(0, 0, 0, 0.05);
            width: 200px;
            min-width: 200px;
            max-width: 200px;
          }
          .sticky-header-column {
            position: sticky;
            left: 0;
            top: 0;
            z-index: 30;
            box-shadow: 2px 2px 4px 0 rgba(0, 0, 0, 0.1);
            width: 200px;
            min-width: 200px;
            max-width: 200px;
          }
          .cell-border {
            border-right: 1px solid hsl(var(--border));
            border-bottom: 1px solid hsl(var(--border));
          }
          .header-cell {
            border-right: 1px solid hsl(var(--border));
            border-bottom: 1px solid hsl(var(--border));
            transition: background-color 0.2s ease;
            width: 250px;
            min-width: 250px;
            max-width: 250px;
          }
          .result-cell {
            border-right: 1px solid hsl(var(--border));
            border-bottom: 1px solid hsl(var(--border));
            text-align: center;
            vertical-align: middle;
            padding: 0 !important;
            height: 48px;
            min-height: 48px;
            width: 250px;
            min-width: 250px;
            max-width: 250px;
            position: relative;
          }
          .file-name-cell {
            border-right: 2px solid hsl(var(--border));
            border-bottom: 1px solid hsl(var(--border));
            padding: 0;
            width: 200px;
            min-width: 200px;
            max-width: 200px;
            position: sticky;
            left: 0;
            z-index: 10;
            height: 48px;
            min-height: 48px;
          }
          .sticky-header .file-name-cell {
            z-index: 30;
          }
          .field-averages-cell {
            position: sticky !important;
            left: 0 !important;
            z-index: 70 !important;
            background: white !important;
          }
          .field-averages-text {
            position: relative !important;
            z-index: 80 !important;
          }
        `}</style>

        <div className="table-container bg-white dark:bg-gray-900">
          <div className="table-scroll-area">
            <table 
              key={`table-${groundTruthHash.slice(0, 20)}`}
              className="extraction-table caption-bottom text-sm"
            >
            <thead className="sticky-header">
              {/* Row 1: File Name + Field Names */}
              <tr>
                <th 
                  rowSpan={3}
                  className="sticky-header-column file-name-cell text-center font-semibold text-foreground bg-white"
                >
                  <div className="flex items-center justify-center h-full">
                    File Name
                  </div>
                </th>
                {fields.map((field, fieldIndex) => {
                  const groupIdx = fieldIndex;
                  return (
                    <th
                      key={`${field.key}-name`}
                      colSpan={visibleColumns.length || 1}
                      className={cn(
                        'header-cell text-center align-middle font-semibold text-foreground px-2 py-3',
                        groupIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                        fieldIndex < fields.length - 1 ? 'border-r-2 border-gray-200' : ''
                      )}
                    >
                      <FieldHeaderGroup
                        field={field}
                        recentlyChangedPrompts={recentlyChangedPrompts}
                        onOpenPromptStudio={onOpenPromptStudio}
                        onRunSingleField={onRunSingleField}
                      />
                    </th>
                  );
                })}
              </tr>

              {/* Row 2: Prompts */}
              <tr>
                {fields.map((field, fieldIndex) => {
                  const groupIdx = fieldIndex;
                  return (
                    <th
                      key={`${field.key}-prompt`}
                      colSpan={visibleColumns.length || 1}
                      className={cn(
                        'header-cell align-top text-xs font-normal text-muted-foreground whitespace-normal text-left px-2 py-2',
                        groupIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                        fieldIndex < fields.length - 1 ? 'border-r-2 border-gray-200' : ''
                      )}
                    >
                      <PromptHeader field={field} onOpenPromptStudio={onOpenPromptStudio} />
                    </th>
                  );
                })}
              </tr>

              {/* Row 3: Model Names */}
              <tr>
                {fields.map((field, fieldIndex) => {
                  const groupIdx = fieldIndex;
                  return (
                    <React.Fragment key={`${field.key}-models`}>
                      {visibleColumns.map((modelName, colIndex) => (
                        <th
                          key={`${field.key}-${modelName}`}
                                                      className={cn(
                              'header-cell text-center align-middle font-medium text-muted-foreground px-1 py-2',
                              groupIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                              colIndex === visibleColumns.length - 1 && fieldIndex < fields.length - 1 ? 'border-r-2 border-gray-200' : ''
                            )}
                        >
                          <ModelHeader modelName={modelName} onOpenInlineEditor={!!onOpenInlineEditor} />
                        </th>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>

                        <tbody>
              {table.getRowModel().rows.map((row, index) => (
                <tr key={row.id} className={cn(
                  "transition-colors hover:bg-muted/50 group",
                  index < table.getRowModel().rows.length - 1 ? "border-b" : ""
                )}>
                  {row.getVisibleCells().map((cell) => {
                    const isFirstColumn = cell.column.id === 'fileName';
                    const groupIdx = cell.column.columnDef.meta?.groupIndex ?? -1;
                    const isGroupRightEdge = cell.column.columnDef.meta?.isGroupRightEdge ?? false;
                    
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          isFirstColumn ? "sticky-column file-name-cell bg-white" : "result-cell",
                          !isFirstColumn && isGroupRightEdge && "border-r-2 border-gray-200",
                          // Alternating field colors by metadata field group
                          !isFirstColumn && groupIdx >= 0 && (groupIdx % 2 === 0 ? "bg-white" : "bg-slate-50")
                        )}
                        style={{
                          width: cell.column.getSize(),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
              
              {/* Field Averages Row - only show when metrics are available */}
              {showMetrics && (
                <tr className="border-t-2 border-t-gray-300 sticky bottom-0 z-50">
                  <td className="sticky-column file-name-cell field-averages-cell bg-white font-bold border-t-2 border-t-gray-300">
                    <div className="p-3 text-center font-semibold field-averages-text">Field Averages</div>
                  </td>
                  {fields.map((field, fieldIndex) => {
                    const groupIdx = fieldIndex;
                    return (
                      <React.Fragment key={`${field.key}-avg`}>
                        {visibleColumns.map((modelName, colIndex) => {
                          const isLastColumnInGroup = colIndex === visibleColumns.length - 1;
                          
                          if (modelName === 'Ground Truth') {
                            return (
                              <td
                                key={`${modelName}-avg`}
                                                              className={cn(
                                'result-cell border-t-2 border-t-gray-300 sticky bottom-0 z-30',
                                groupIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                                isLastColumnInGroup && fieldIndex < fields.length - 1 ? 'border-r-2 border-gray-200' : ''
                              )}
                              />
                            );
                          }

                        const metrics = averages[field.key]?.[modelName] ?? { accuracy: 0, precision: 0, recall: 0, f1: 0 };
                        const f1 = metrics.f1;
                        
                        // Check if there's any ground truth data for this field across all files
                        const hasGroundTruth = results.some(result => {
                          const groundTruthValue = result.fields[field.key]?.['Ground Truth'];
                          return groundTruthValue && groundTruthValue.trim() !== '' && groundTruthValue !== '-';
                        });

                          return (
                            <td
                              key={`${modelName}-avg`}
                              className={cn(
                                'result-cell border-t-2 border-t-gray-300 text-center font-semibold sticky bottom-0 z-30',
                                groupIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                                isLastColumnInGroup && fieldIndex < fields.length - 1 ? 'border-r-2 border-gray-200' : ''
                              )}
                            >
                              <div className="relative w-full h-full flex items-center justify-center">
                                {!hasGroundTruth ? (
                                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                    TBD
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold",
                                    f1 >= 0.9 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                                    f1 >= 0.7 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  )}>
                                    F1 {f1 > 0 ? `${(f1 * 100).toFixed(0)}%` : '0%'}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
} 