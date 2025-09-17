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
import { ImageThumbnailHover } from '@/components/image-thumbnail-hover';

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
  onToggleFieldMetrics?: (fieldKey: string, include: boolean) => void;
};

// Custom header components
const FileNameHeader = () => (
  <div className="p-2 font-semibold text-foreground">File Name</div>
);

const FieldHeaderGroup = ({ 
  field, 
  recentlyChangedPrompts = new Set(), 
  onOpenPromptStudio,
  onRunSingleField,
  includeInMetrics = true,
  onToggleMetrics
}: { 
  field: AccuracyField;
  recentlyChangedPrompts?: Set<string>;
  onOpenPromptStudio: (field: AccuracyField) => void;
  onRunSingleField?: (field: AccuracyField) => void;
  includeInMetrics?: boolean;
  onToggleMetrics?: (include: boolean) => void;
}) => {
  
  return (
    <div className="relative px-4 py-2">
      {/* Centered label with equal side padding = toggle width (44px) + gap */}
      <div className="flex justify-center">
        <div className="px-14 text-center whitespace-normal break-words hyphens-auto">
          <div className="flex items-center justify-center gap-2 font-semibold">
            {field.name}
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
        </div>
      </div>

      {/* Toggle fixed to the right, vertically centered */}
      {onToggleMetrics && (
        <button
          type="button"
          onClick={() => onToggleMetrics(!includeInMetrics)}
          className={`absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer ${
            includeInMetrics ? 'bg-blue-600' : 'bg-gray-200'
          }`}
          aria-label={`Toggle ${field.name} metrics ${includeInMetrics ? 'off' : 'on'}`}
        >
          <span 
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
              includeInMetrics ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      )}
    </div>
  );
};

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
    <ImageThumbnailHover fileName={row.fileName} fileId={row.id}>
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
      <Badge variant="outline" className="mt-1 font-normal text-xs w-fit">
        {row.fileType}
      </Badge>
    </ImageThumbnailHover>
  </div>
);

// Function to get background color for a cell based on its data
const getCellBackgroundColor = (cellData: CellData): string => {
  const { value, groundTruth, modelName } = cellData;
  const isPending = value.startsWith('Pending');
  const isError = value.startsWith('Error:');
  const isNotPresent = value === NOT_PRESENT_VALUE;
  
  // No background for Ground Truth cells
  if (modelName === 'Ground Truth') {
    return '';
  }
  
  // No background for pending states
  if (isPending) {
    return '';
  }
  
  // Error state background
  if (isError) {
    return 'bg-red-100/60 dark:bg-red-900/30';
  }
  
  // Handle "Not Present" cases
  if (isNotPresent) {
    // If there's ground truth but model returned "Not Present", it's a mismatch
    if (groundTruth && groundTruth.trim() !== '' && groundTruth !== NOT_PRESENT_VALUE) {
      return 'bg-red-100/80 dark:bg-red-900/30'; // Red for mismatches
    }
    // If no ground truth or ground truth is also "Not Present", no special background
    return '';
  }
  
  // Comparison-based background colors
  const comparison = compareValues(value, groundTruth);
  
  // If there's no Ground Truth to compare against, don't apply any coloring
  if (!groundTruth || groundTruth.trim() === '' || groundTruth === '-') {
    return '';
  }
  
  if (!comparison.isMatch) {
    // Don't show red for empty values
    if (!value || value.trim() === '' || value === '-') {
      return '';
    }
    return 'bg-red-100/80 dark:bg-red-900/30';
  }
  
  switch (comparison.matchType) {
    case 'exact':
    case 'normalized':
      return 'bg-green-100/80 dark:bg-green-900/30';
    case 'partial':
      return 'bg-blue-100/80 dark:bg-blue-900/30';
    case 'date_format':
      return 'bg-yellow-100/80 dark:bg-yellow-900/30';
    default:
      return '';
  }
};

// Cell component for model values
const ModelValueCell = ({ 
  cellData,
  fileId,
  onOpenInlineEditor,
  onRunSingleFieldForFile,
  field
}: {
  cellData: CellData;
  fileId: string;
  onOpenInlineEditor?: (fileId: string, fieldKey: string) => void;
  onRunSingleFieldForFile?: (field: AccuracyField, fileId: string) => void;
  field?: AccuracyField;
}) => {
  const { value, groundTruth, fieldKey, modelName } = cellData;
  const isPending = value.startsWith('Pending');
  const isError = value.startsWith('Error:');
  const isNotPresent = value === NOT_PRESENT_VALUE;
  const comparison = compareValues(value, groundTruth);
  
  const getComparisonClasses = (comparison: ComparisonResult) => {
    // Never apply styling to Ground Truth cells
    if (modelName === 'Ground Truth') {
      return '';
    }
    
    // Handle "Not Present" cases first
    if (isNotPresent) {
      // If there's ground truth but model returned "Not Present", it's a mismatch
      if (groundTruth && groundTruth.trim() !== '' && groundTruth !== NOT_PRESENT_VALUE) {
        return 'bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      }
      // If no ground truth or ground truth is also "Not Present", no special styling
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

  // Simple centering wrapper without background colors (background now on td)
  const wrapperClasses = cn(
    "grid place-items-center w-full h-full px-2 py-3",
    isPending && "text-muted-foreground italic",
    isError && "text-red-700 dark:text-red-400",
    isNotPresent && "text-muted-foreground italic"
  );

  const handleCellClick = (e: React.MouseEvent) => {
    // Handle ground truth editing - open inline editor for preview
    if (modelName === 'Ground Truth' && onOpenInlineEditor) {
      onOpenInlineEditor(fileId, fieldKey);
    }
  };

  return (
    <div 
      className={wrapperClasses}
      onClick={handleCellClick}
    >
      <div 
        className="text-sm text-center leading-snug whitespace-pre-wrap break-words max-w-full cursor-pointer" 
        title={value} // Show full text on hover
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 7,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.4,
          wordBreak: 'break-word'
        }}
      >
        {value || '-'}
      </div>
    </div>
  );
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
  extractingFields = new Set(),
  onToggleFieldMetrics
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
            includeInMetrics={data.fieldSettings?.[field.key]?.includeInMetrics ?? true}
            onToggleMetrics={(include) => onToggleFieldMetrics?.(field.key, include)}
          />
        ),
        columns: fieldColumns,
        meta: { fieldIndex, groupIndex: groupIdx, field }
      };

      dynamicColumns.push(fieldGroup);
    });

    return dynamicColumns;
  }, [fields, visibleColumns, recentlyChangedPrompts, onOpenPromptStudio, onRunSingleField, onOpenInlineEditor, onRunSingleFieldForFile]);

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
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 1px 0 rgba(0, 0, 0, 0.02);
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
            table-layout: auto;
            width: max-content;
            min-width: 100%;
          }
          .extraction-table tbody tr:last-child td {
            border-bottom: none;
          }
          .extraction-table tbody td {
            vertical-align: middle;
          }
          .sticky-header {
            position: sticky;
            top: 0;
            z-index: 20;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
          }
          .sticky-column {
            position: sticky;
            left: 0;
            z-index: 10;
            box-shadow: 1px 0 2px 0 rgba(0, 0, 0, 0.02);
            width: 200px;
            min-width: 200px;
            max-width: 200px;
          }
          .sticky-header-column {
            position: sticky;
            left: 0;
            top: 0;
            z-index: 30;
            box-shadow: 1px 1px 2px 0 rgba(0, 0, 0, 0.04);
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
            height: auto !important;
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
            height: auto !important;
            vertical-align: middle;
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
                        fieldIndex < fields.length - 1 ? 'border-r' : ''
                      )}
                    >
                      <FieldHeaderGroup
                        field={field}
                        recentlyChangedPrompts={recentlyChangedPrompts}
                        onOpenPromptStudio={onOpenPromptStudio}
                        onRunSingleField={onRunSingleField}
                        includeInMetrics={data.fieldSettings?.[field.key]?.includeInMetrics ?? true}
                        onToggleMetrics={(include) => onToggleFieldMetrics?.(field.key, include)}
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
                        fieldIndex < fields.length - 1 ? 'border-r' : ''
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
                              colIndex === visibleColumns.length - 1 && fieldIndex < fields.length - 1 ? 'border-r' : ''
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
                    
                    // Get cell background color for comparison results
                    let cellBgColor = '';
                    if (!isFirstColumn) {
                      // Get the cell data from row.original using the column id
                      const cellData = row.original[cell.column.id] as CellData;
                      if (cellData) {
                        cellBgColor = getCellBackgroundColor(cellData);
                      }
                    }
                    
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          isFirstColumn ? "sticky-column file-name-cell bg-white" : "result-cell",
                          !isFirstColumn && isGroupRightEdge && "border-r",
                          // Apply comparison background colors or alternating field colors
                          !isFirstColumn && (
                            cellBgColor || 
                            (groupIdx >= 0 && (groupIdx % 2 === 0 ? "bg-white" : "bg-slate-50"))
                          )
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
                <tr className="border-t sticky bottom-0 z-50">
                  <td className="sticky-column file-name-cell field-averages-cell bg-white font-bold border-t">
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
                                'result-cell border-t sticky bottom-0 z-30',
                                groupIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                                isLastColumnInGroup && fieldIndex < fields.length - 1 ? 'border-r' : ''
                              )}
                              />
                            );
                          }

                        // Check if field is included in metrics calculation
                        const isFieldIncluded = data.fieldSettings?.[field.key]?.includeInMetrics !== false;
                        
                        const metrics = averages[field.key]?.[modelName] ?? { accuracy: 0, precision: 0, recall: 0, f1: 0 };
                        const accuracy = metrics.accuracy;
                        
                        // Check if there's any ground truth data for this field across all files
                        const hasGroundTruth = results.some(result => {
                          const groundTruthValue = result.fields[field.key]?.['Ground Truth'];
                          return groundTruthValue && groundTruthValue.trim() !== '' && groundTruthValue !== '-';
                        });

                        // Check if there are actual model extraction results (not just Ground Truth)
                        // This indicates that "Run Comparison" has been executed
                        const hasModelResults = results.some(result => {
                          const modelValue = result.fields[field.key]?.[modelName];
                          return modelValue && 
                                 modelValue.trim() !== '' && 
                                 modelValue !== '-' && 
                                 !modelValue.startsWith('Pending') &&
                                 !modelValue.startsWith('Error:');
                        });

                          return (
                            <td
                              key={`${modelName}-avg`}
                              className={cn(
                                'result-cell border-t text-center font-semibold sticky bottom-0 z-30',
                                groupIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50',
                                isLastColumnInGroup && fieldIndex < fields.length - 1 ? 'border-r' : ''
                              )}
                            >
                              <div className="relative w-full h-full flex items-center justify-center">
                                {!isFieldIncluded ? (
                                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    not included
                                  </div>
                                ) : !hasGroundTruth || !hasModelResults ? (
                                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                    TBD
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold",
                                    accuracy >= 0.9 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                                    accuracy >= 0.7 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  )}>
                                    Accuracy {accuracy > 0 ? `${(accuracy * 100).toFixed(0)}%` : '0%'}
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