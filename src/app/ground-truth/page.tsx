'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
// Removed unused Box folder navigation imports
import {
  getConfiguredTemplates,
  saveGroundTruthForFile,
  getFileMetadataStore,
  getGroundTruthData,
  getGroundTruthForFile,
} from '@/lib/mock-data';
import type { BoxFile, BoxFolder, BoxTemplate, FileMetadataStore } from '@/lib/types';
import { Database, Pencil, Terminal, Folder, Download, Upload, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import GroundTruthEditor from '@/components/ground-truth-editor';
import ExtractionModal from '@/components/extraction-modal';
import { useToast } from '@/hooks/use-toast';
import { useGroundTruth } from '@/hooks/use-ground-truth';

type GroundTruthFile = BoxFile & {
  template: BoxTemplate | null;
  status: {
    completed: number;
    total: number;
  };
};

// Removed BreadcrumbItem type - no longer using folder navigation

export default function GroundTruthPage() {
  const [filesWithStatus, setFilesWithStatus] = useState<GroundTruthFile[]>([]);
  const [folders, setFolders] = useState<BoxFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GroundTruthFile | null>(null);
  
  
  // CSV Export/Import state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedTemplateForExport, setSelectedTemplateForExport] = useState<string>('');
  const [selectedFolderForExport, setSelectedFolderForExport] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // File selection modal state
  const [isFileSelectionModalOpen, setIsFileSelectionModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<BoxFile[]>([]);
  
  // Remove folder navigation - we'll only show selected files
  // const [currentFolderId, setCurrentFolderId] = useState<string>("0");
  // const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  const { toast } = useToast();
  const { saveGroundTruth, getGroundTruth, refreshGroundTruth } = useGroundTruth();
  
  // Load configured templates for CSV operations
  const [configuredTemplates, setConfiguredTemplates] = useState<BoxTemplate[]>([]);
  
  useEffect(() => {
    const templates = getConfiguredTemplates();
    setConfiguredTemplates(templates);
  }, []);


  // File selection modal handlers
  const handleSelectFilesClick = () => {
    setIsFileSelectionModalOpen(true);
  };

  const handleFileSelectionComplete = async (template: BoxTemplate, files: BoxFile[]) => {
    setSelectedFiles(files);
    setIsFileSelectionModalOpen(false);
    
    if (files.length > 0) {
      // Load the selected files into the main table
      await loadSelectedFiles(files);
      
      toast({
        title: 'Files Selected',
        description: `Added ${files.length} files to ground truth editing.`,
      });
    }
  };

  // Load selected files into the main table
  const loadSelectedFiles = async (files: BoxFile[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [templates, fileMetadataStore] = await Promise.all([
        Promise.resolve(getConfiguredTemplates()),
        Promise.resolve(getFileMetadataStore()),
      ]);

      const filesWithStatusData = files.map(file => {
        const fileMetadata = fileMetadataStore[file.id];
        const associatedTemplate = fileMetadata
          ? templates.find(t => t.templateKey === fileMetadata.templateKey) ||
            null
          : null;

        let completed = 0;
        let total = 0;

        if (associatedTemplate) {
          const activeFields = associatedTemplate.fields.filter(f => f.isActive);
          total = activeFields.length;
          
          // 🔧 FIX: Read directly from localStorage instead of React state for accurate status
          const groundTruth = getGroundTruthForFile(file.id);
          
          completed = activeFields.filter(f => {
            const value = groundTruth[f.key];
            return value !== undefined && 
                   value !== null && 
                   String(value).trim() !== '';
          }).length;
        }

        return {
          ...file,
          template: associatedTemplate,
          status: { completed, total },
        };
      });

      setFilesWithStatus(filesWithStatusData);
      setFolders([]); // No folders to show
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while processing selected files.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize with empty state - no files loaded by default
  useEffect(() => {
    setFilesWithStatus([]);
    setFolders([]);
    setIsLoading(false);
  }, []);

  const handleEditClick = (file: GroundTruthFile) => {
    if (!file.template) {
      toast({
        variant: 'destructive',
        title: 'No Template Associated',
        description:
          'Run a comparison for this file on the Home page to associate a template.',
      });
      return;
    }
    setSelectedFile(file);
    setIsEditorOpen(true);
  };

  const handleSaveGroundTruth = async (
    fileId: string,
    data: Record<string, string>
  ) => {
    
    if (!selectedFile || !selectedFile.template) {
      console.error('❌ No selected file or template');
      return;
    }

    // Save all fields at once to avoid race conditions
    const templateKey = selectedFile.template.templateKey;
    console.log('💾 Saving all fields for template:', templateKey, Object.keys(data));
    
    try {
      // Use direct save to avoid race conditions from multiple simultaneous saves
      saveGroundTruthForFile(fileId, templateKey, data);
      console.log('✅ All ground truth saved successfully');
      
      // Refresh the unified ground truth system for other pages (like home page)
      refreshGroundTruth();
      
      // Close the editor FIRST to prevent form reset from prop changes
      setIsEditorOpen(false);
      
      // Refresh files to update status
      if (selectedFiles.length > 0) {
        await loadSelectedFiles(selectedFiles);
      } else if (filesWithStatus.length > 0) {
        // Fallback: Use current displayed files if selectedFiles is empty
        const currentFiles: BoxFile[] = filesWithStatus.map(f => ({
          id: f.id,
          name: f.name,
          type: 'file' as const
        }));
        await loadSelectedFiles(currentFiles);
      }
      
      toast({
        title: 'Ground Truth Saved',
        description: 'Your changes have been saved successfully.',
      });
    } catch (error) {
      console.error('❌ Ground truth save failed:', error);
      toast({
        title: 'Save Failed',
        description: 'Some changes could not be saved. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Removed collectAllFilesFromFolder function - no longer doing folder scanning

  // CSV Export/Import handlers
  const handleExportClick = () => {
    // Reset selections when opening dialog
    setSelectedTemplateForExport('');
    setSelectedFolderForExport('');
    setIsExportDialogOpen(true);
  };

  const handleImportClick = () => {
    setIsImportDialogOpen(true);
  };

  const handleExportCSV = async () => {
    if (!selectedTemplateForExport) {
      toast({
        title: 'Template Required',
        description: 'Please select a template to export.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({
        title: 'No Files Selected',
        description: 'Please select files first using the "Select Files" button.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Find the selected template
      const template = configuredTemplates.find(t => t.templateKey === selectedTemplateForExport);
      if (!template) {
        throw new Error('Template not found');
      }

      // Use selected files instead of folder scanning
      if (selectedFiles.length === 0) {
        throw new Error('No files selected for export. Please select files first.');
      }

      toast({
        title: 'Preparing Export',
        description: `Exporting ${selectedFiles.length} selected files...`,
      });
      
      // Use selected files directly
      const allFiles = selectedFiles.map(file => ({
        file
      }));
      
      // Get ground truth data
      const groundTruthData = getGroundTruthData();
      const fileMetadataStore = getFileMetadataStore();
      
      // Include ALL files - we'll use the selected template structure for all
      const filesForExport = allFiles;

      if (filesForExport.length === 0) {
        toast({
          title: 'No Files Found',
          description: `No files found in this folder hierarchy.`,
          variant: 'destructive',
        });
        setIsExportDialogOpen(false);
        return;
      }

      // Get active fields for the template
      const activeFields = template.fields.filter(f => f.isActive);
      
      // Build CSV content
      const headers = [
        'box_file_id',
        'file_name', 
        'template_key',
        ...activeFields.map(f => f.key)
      ];

      const csvRows = [headers.join(',')];

      // Process each file with its Box metadata
      for (const fileInfo of filesForExport) {
        try {
          const groundTruthEntry = groundTruthData[fileInfo.file.id];
          
          const row = [
            `="${fileInfo.file.id}"`, // Force as string
            `"${fileInfo.file.name}"`, // Quote file name to handle commas
            selectedTemplateForExport,
            ...activeFields.map(field => {
              // Handle files that might not have ground truth data yet
              const value = groundTruthEntry?.groundTruth?.[field.key] || '';
              // Quote values that contain commas or quotes
              return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
            })
          ];
          
          csvRows.push(row.join(','));
        } catch (error) {
          console.warn(`Failed to process file ${fileInfo.file.id}:`, error);
          // Continue with other files
        }
      }

      // Create and download CSV file
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `ground-truth-${selectedTemplateForExport}-selected-files-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Count files that have existing data vs empty files
      const filesWithData = filesForExport.filter(fileInfo => {
        const groundTruthEntry = groundTruthData[fileInfo.file.id];
        return groundTruthEntry && Object.keys(groundTruthEntry.groundTruth || {}).length > 0;
      });

      toast({
        title: 'Export Successful',
        description: `Exported ${filesForExport.length} selected files to CSV (${filesWithData.length} with existing data, ${filesForExport.length - filesWithData.length} empty).`,
      });
      
      setIsExportDialogOpen(false);
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export CSV. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const parseCSV = (csvText: string): Array<Record<string, string>> => {
    console.log('🐛 DEBUG: parseCSV called with text length:', csvText.length);
    const lines = csvText.trim().split('\n');
    console.log('🐛 DEBUG: CSV split into', lines.length, 'lines');
    console.log('🐛 DEBUG: First line (headers):', lines[0]);
    if (lines.length >= 2) {
      console.log('🐛 DEBUG: Second line (first data):', lines[1]);
    }
    
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    console.log('🐛 DEBUG: Parsed headers:', headers);
    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles quoted fields)
      const values: string[] = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          if (insideQuotes && line[j + 1] === '"') {
            // Escaped quote
            currentValue += '"';
            j++; // Skip next quote
          } else {
            // Toggle quote state
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          // End of field
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // Add the last value
      values.push(currentValue.trim());

      // Create row object
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      rows.push(row);
    }

    console.log('🐛 DEBUG: parseCSV completed with', rows.length, 'data rows');
    console.log('🐛 DEBUG: Sample parsed row:', rows[0]);
    return rows;
  };

  const validateCSVData = (rows: Array<Record<string, string>>, templateKey: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const requiredColumns = ['box_file_id', 'file_name', 'template_key'];
    
    if (rows.length === 0) {
      errors.push('CSV file contains no data rows');
      return { valid: false, errors };
    }

    // Check required columns
    const firstRow = rows[0];
    const columns = Object.keys(firstRow);
    
    for (const required of requiredColumns) {
      if (!columns.includes(required)) {
        errors.push(`Missing required column: ${required}`);
      }
    }

    // Check template consistency
    const templateMismatches = rows.filter(row => row.template_key !== templateKey);
    if (templateMismatches.length > 0) {
      errors.push(`${templateMismatches.length} rows have template_key mismatch (expected: ${templateKey})`);
    }

    // Check for missing file IDs
    const missingIds = rows.filter(row => !row.box_file_id);
    if (missingIds.length > 0) {
      errors.push(`${missingIds.length} rows have missing box_file_id`);
    }

    return { valid: errors.length === 0, errors };
  };

  const handleImportCSV = async () => {
    if (!csvFile) {
      toast({
        title: 'File Required',
        description: 'Please select a CSV file to import.',
        variant: 'destructive',
      });
      return;
    }

    console.log('🐛 DEBUG: Starting CSV import process');
    console.log('🐛 DEBUG: CSV file selected:', csvFile.name, csvFile.size, 'bytes');

    try {
      setIsLoading(true);
      
      // Read CSV file
      console.log('🐛 DEBUG: Reading CSV file...');
      const csvText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(csvFile);
      });
      console.log('🐛 DEBUG: CSV text read, length:', csvText.length);
      console.log('🐛 DEBUG: CSV preview:', csvText.substring(0, 300) + '...');

      // Parse CSV
      console.log('🐛 DEBUG: Parsing CSV...');
      const rows = parseCSV(csvText);
      console.log('🐛 DEBUG: CSV parsed successfully, rows:', rows.length);
      console.log('🐛 DEBUG: First row data:', rows[0]);
      console.log('🐛 DEBUG: CSV columns:', Object.keys(rows[0] || {}));
      
      // Detect template from CSV data
      const templateKeys = [...new Set(rows.map(row => row.template_key).filter(Boolean))];
      console.log('🐛 DEBUG: Template keys found in CSV:', templateKeys);
      if (templateKeys.length === 0) {
        throw new Error('No template_key found in CSV data');
      }
      if (templateKeys.length > 1) {
        throw new Error(`Multiple templates found in CSV: ${templateKeys.join(', ')}`);
      }
      
      const csvTemplateKey = templateKeys[0];
      console.log('🐛 DEBUG: CSV template key:', csvTemplateKey);
      
      // Find the template
      const template = configuredTemplates.find(t => t.templateKey === csvTemplateKey);
      console.log('🐛 DEBUG: Configured templates:', configuredTemplates.map(t => t.templateKey));
      console.log('🐛 DEBUG: Found template:', template ? template.displayName : 'NOT FOUND');
      if (!template) {
        throw new Error(`Template "${csvTemplateKey}" not found in configured templates`);
      }

      // Validate CSV structure
      const validation = validateCSVData(rows, csvTemplateKey);
      if (!validation.valid) {
        throw new Error(`CSV validation failed:\n${validation.errors.join('\n')}`);
      }

      // Get field columns (excluding metadata columns)
      const metadataColumns = ['box_file_id', 'file_name', 'template_key'];
      const fieldColumns = Object.keys(rows[0]).filter(col => !metadataColumns.includes(col));
      console.log('🐛 DEBUG: Metadata columns:', metadataColumns);
      console.log('🐛 DEBUG: Field columns:', fieldColumns);
      
      // Process imports
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      console.log('🐛 DEBUG: Starting to process', rows.length, 'rows');
      for (const row of rows) {
        try {
          const fileId = row.box_file_id;
          console.log('🐛 DEBUG: Processing row for fileId:', fileId, 'fileName:', row.file_name);
          if (!fileId) continue;

          // Get current ground truth
          const currentGroundTruth = getGroundTruth(fileId);
          console.log('🐛 DEBUG: Current ground truth for file:', currentGroundTruth);
          
          // Prepare new ground truth data
          const newGroundTruth: Record<string, string> = { ...currentGroundTruth };
          let hasChanges = false;

          for (const fieldColumn of fieldColumns) {
            const newValue = row[fieldColumn] || '';
            const currentValue = currentGroundTruth[fieldColumn] || '';
            
            // Only add data to empty fields
            if (!currentValue && newValue) {
              newGroundTruth[fieldColumn] = newValue;
              hasChanges = true;
              console.log(`🐛 DEBUG: Field "${fieldColumn}" will be updated from empty to "${newValue}"`);
            } else if (currentValue) {
              console.log(`🐛 DEBUG: Field "${fieldColumn}" skipped (already has value: "${currentValue}")`);
            }
          }

          if (hasChanges) {
            // Save ground truth data and ensure template is assigned
            console.log('🐛 DEBUG: Saving ground truth for file:', fileId, 'with data:', newGroundTruth);
            saveGroundTruthForFile(fileId, csvTemplateKey, newGroundTruth);
            updatedCount++;
          } else {
            console.log('🐛 DEBUG: No changes for file:', fileId, '- skipping');
            skippedCount++;
          }

        } catch (error) {
          errors.push(`File ${row.file_name || row.box_file_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      
      // Refresh ground truth system for other pages
      refreshGroundTruth();
      
      // Refresh current files to update status
      if (selectedFiles.length > 0) {
        await loadSelectedFiles(selectedFiles);
      } else if (filesWithStatus.length > 0) {
        // Fallback: Use current displayed files if selectedFiles is empty
        const currentFiles: BoxFile[] = filesWithStatus.map(f => ({
          id: f.id,
          name: f.name,
          type: 'file' as const
        }));
        await loadSelectedFiles(currentFiles);
      }

      toast({
        title: 'Import Completed',
        description: `Updated ${updatedCount} files, skipped ${skippedCount} files. Status updated.${errors.length > 0 ? ` ${errors.length} errors occurred.` : ''}`,
        variant: errors.length > 0 ? 'destructive' : 'default',
      });

      if (errors.length > 0) {
        console.warn('Import errors:', errors);
      }
      
      console.log('🐛 DEBUG: CSV import completed successfully');
      setIsImportDialogOpen(false);
      setCsvFile(null);
      
    } catch (error) {
      console.error('CSV import error:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import CSV. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderTableContent = () => {
    if (isLoading) {
      return [...Array(3)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-28 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-10 w-24" />
          </TableCell>
        </TableRow>
      ));
    }

    if (error) {
      return (
        <TableRow>
          <TableCell colSpan={4}>
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Fetching Data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </TableCell>
        </TableRow>
      );
    }

    // Show files only
    const fileRows = filesWithStatus.map(file => {
      const isComplete =
        file.status.completed === file.status.total && file.status.total > 0;
      return (
        <TableRow key={file.id}>
          <TableCell className="font-medium">{file.name}</TableCell>
          <TableCell>{file.template?.displayName || 'N/A'}</TableCell>
          <TableCell className="text-left">
            <Badge
              variant="outline"
              className={cn(
                !file.template
                  ? 'border-muted bg-muted text-muted-foreground'
                  : isComplete
                    ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                    : 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
              )}
            >
              {!file.template
                ? 'Not Run'
                : isComplete
                  ? `Complete (${file.status.completed}/${file.status.total})`
                  : `Pending (${file.status.completed}/${file.status.total})`}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditClick(file)}
            >
              <Pencil className="mr-2 h-3 w-3" />
              Edit
            </Button>
          </TableCell>
        </TableRow>
      );
    });

    if (filesWithStatus.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={5}
            className="h-32 text-center text-muted-foreground"
          >
            <div className="flex flex-col items-center gap-2">
              <Folder className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-lg font-medium">No files selected</div>
              <div className="text-sm">
                Use the "Select Files" button above to choose files from multiple box folder in order to edit ground truth or export, import csv tiles.
              </div>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    return fileRows;
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Ground Truth Data
          </h1>
          <p className="text-muted-foreground">
            Manage and confirm ground truth data for your documents.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="default" onClick={handleSelectFilesClick}>
                  <Folder className="mr-2 h-4 w-4" />
                  Select Files
                </Button>
                <Button variant="outline" onClick={handleExportClick}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={handleImportClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Files Status */}
            {selectedFiles.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected for ground truth editing
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFiles([]);
                      setFilesWithStatus([]);
                    }}
                    className="ml-auto h-6 px-2 text-blue-600 hover:text-blue-800"
                  >
                    Clear All
                  </Button>
                </div>
                <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  These files are ready for ground truth editing. Use "Select Files" to add more files.
                </div>
              </div>
            )}

            {/* Files and Folders Table */}
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%] text-left">Name</TableHead>
                    <TableHead className="w-[25%] text-left">Template</TableHead>
                    <TableHead className="w-[20%] text-left">Status</TableHead>
                    <TableHead className="w-[15%] text-right pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderTableContent()}</TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedFile && selectedFile.template && (
        <GroundTruthEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          file={selectedFile}
          template={selectedFile.template}
          groundTruth={getGroundTruth(selectedFile.id)}
          onSave={handleSaveGroundTruth}
        />
      )}

      {/* CSV Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Ground Truth CSV</DialogTitle>
            <DialogDescription>
              Select a template to export ground truth data from your selected files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-select">Template</Label>
              <Select value={selectedTemplateForExport} onValueChange={setSelectedTemplateForExport}>
                <SelectTrigger className="bg-white dark:bg-gray-800">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800">
                  {configuredTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.templateKey}>
                      {template.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="files-info">Selected Files</Label>
              <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                {selectedFiles.length > 0 
                  ? `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} selected for export`
                  : 'No files selected. Please use "Select Files" to choose files first.'
                }
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Ground Truth CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to add ground truth data to empty fields. Existing data will be preserved. Templates will be automatically assigned based on the CSV data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              ✅ This will only update empty fields, preserving all existing data
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportCSV}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Selection Modal */}
      <ExtractionModal
        isOpen={isFileSelectionModalOpen}
        onClose={() => setIsFileSelectionModalOpen(false)}
        templates={configuredTemplates}
        onRunExtraction={handleFileSelectionComplete}
      />
    </>
  );
} 