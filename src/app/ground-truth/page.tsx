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
import { Checkbox } from '@/components/ui/checkbox';
import { getBoxFilesInFolder, getBoxFolderContents } from '@/lib/actions/box';
import {
  getConfiguredTemplates,
  saveGroundTruthForFile,
  getFileMetadataStore,
  getGroundTruthData,
} from '@/lib/mock-data';
import type { BoxFile, BoxFolder, BoxTemplate, FileMetadataStore } from '@/lib/types';
import { Database, Pencil, Terminal, Folder, ChevronRight, Home, Download, Upload, Wand2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useGroundTruth } from '@/hooks/use-ground-truth';

type GroundTruthFile = BoxFile & {
  template: BoxTemplate | null;
  status: {
    completed: number;
    total: number;
  };
};

type BreadcrumbItem = {
  id: string;
  name: string;
};

export default function GroundTruthPage() {
  const [filesWithStatus, setFilesWithStatus] = useState<GroundTruthFile[]>([]);
  const [folders, setFolders] = useState<BoxFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GroundTruthFile | null>(null);
  
  // Multi-select state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  
  // CSV Export/Import state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedTemplateForExport, setSelectedTemplateForExport] = useState<string>('');
  const [selectedFolderForExport, setSelectedFolderForExport] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string>("329136417488");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "329136417488", name: "Documents" }
  ]);

  const { toast } = useToast();
  const { saveGroundTruth, getGroundTruth, refreshGroundTruth } = useGroundTruth();
  
  // Load configured templates for CSV operations
  const [configuredTemplates, setConfiguredTemplates] = useState<BoxTemplate[]>([]);
  
  useEffect(() => {
    const templates = getConfiguredTemplates();
    setConfiguredTemplates(templates);
  }, []);

  // Multi-select handlers
  const handleSelectFile = (fileId: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedFileIds);
    if (checked) {
      newSelectedIds.add(fileId);
    } else {
      newSelectedIds.delete(fileId);
    }
    setSelectedFileIds(newSelectedIds);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFileIds = new Set(filesWithStatus.map(file => file.id));
      setSelectedFileIds(allFileIds);
    } else {
      setSelectedFileIds(new Set());
    }
  };

  const isAllSelected = filesWithStatus.length > 0 && selectedFileIds.size === filesWithStatus.length;
  const isIndeterminate = selectedFileIds.size > 0 && selectedFileIds.size < filesWithStatus.length;

  // Generate Metadata Values handler
  const handleGenerateMetadataValues = () => {
    const selectedFiles = filesWithStatus.filter(file => selectedFileIds.has(file.id));
    toast({
      title: 'Generate Metadata Values',
      description: `Starting metadata generation for ${selectedFiles.length} selected files.`,
    });
    console.log('Generating metadata for files:', selectedFiles);
    // TODO: Implement metadata generation logic
  };

  // Load folder contents
  const loadFolderContents = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [contents, templates, fileMetadataStore] = await Promise.all([
        getBoxFolderContents(folderId),
        Promise.resolve(getConfiguredTemplates()),
        Promise.resolve(getFileMetadataStore()),
      ]);

      setFolders(contents.folders);
      console.log(`📁 Folder ${folderId} - Folders found:`, contents.folders);
      console.log(`📄 Folder ${folderId} - Files found:`, contents.files);

      const filesWithStatusData = contents.files.map(file => {
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
          const groundTruth = getGroundTruth(file.id);
          console.log(`📊 Status calculation for file ${file.id}:`, {
            template: associatedTemplate.templateKey,
            activeFieldsCount: activeFields.length,
            groundTruthData: groundTruth,
            activeFields: activeFields.map(f => f.key)
          });
          completed = activeFields.filter(f => {
            const value = groundTruth[f.key];
            const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
            console.log(`  📝 Field ${f.key}: "${value}" → ${hasValue ? 'completed' : 'incomplete'}`);
            return hasValue;
          }).length;
        }

        return {
          ...file,
          template: associatedTemplate,
          status: { completed, total },
        };
      });

      setFilesWithStatus(filesWithStatusData);
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while fetching data.';
      if (err instanceof Error && (err.message.includes('Not Found') || err.message.includes('404'))) {
        errorMessage = 'Not Found: The application does not have access to the specified folder. Please ensure you have invited the application\'s Service Account as a collaborator on the folder in your Box account.';
      }
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [getGroundTruth]);

  // Navigate to a folder
  const navigateToFolder = (folder: BoxFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFileIds(new Set()); // Clear selections when navigating
    loadFolderContents(folder.id);
  };

  // Navigate to a breadcrumb (go back)
  const navigateToBreadcrumb = (targetBreadcrumb: BreadcrumbItem) => {
    const targetIndex = breadcrumbs.findIndex(b => b.id === targetBreadcrumb.id);
    if (targetIndex !== -1) {
      setCurrentFolderId(targetBreadcrumb.id);
      setBreadcrumbs(breadcrumbs.slice(0, targetIndex + 1));
      setSelectedFileIds(new Set()); // Clear selections when navigating
      loadFolderContents(targetBreadcrumb.id);
    }
  };

  useEffect(() => {
    // Load initial folder contents
    loadFolderContents(currentFolderId);
  }, [loadFolderContents, currentFolderId]);

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
    console.log('🚀 Ground Truth Page handleSaveGroundTruth called:', {
      fileId,
      data,
      selectedFile: selectedFile?.name,
      template: selectedFile?.template?.templateKey
    });
    
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
      
      // Refresh the unified ground truth system to pick up the changes
      // This ensures the home page will see the changes immediately
      refreshGroundTruth();
      console.log('🔄 Refreshed unified ground truth system');
      
      console.log('🎉 All ground truth saves successful, closing editor and refreshing folder contents...');
      // Close the editor FIRST to prevent form reset from prop changes
      setIsEditorOpen(false);
      
      // Then refresh the folder contents to update status
      // Add a small delay to ensure the unified ground truth system has processed all changes
      setTimeout(() => {
        loadFolderContents(currentFolderId); // Refresh the current folder to update status
      }, 100);
      
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

  // Recursive function to collect all files from folder hierarchy
  const collectAllFilesFromFolder = async (folderId: string, folderPath: string = ''): Promise<Array<{file: BoxFile, path: string, folderId: string}>> => {
    const allFiles: Array<{file: BoxFile, path: string, folderId: string}> = [];
    
    try {
      const contents = await getBoxFolderContents(folderId);
      
      // Add all files from current folder
      contents.files.forEach(file => {
        allFiles.push({
          file,
          path: folderPath,
          folderId
        });
      });
      
      // Recursively process subfolders
      for (const folder of contents.folders) {
        const subFolderPath = folderPath ? `${folderPath}/${folder.name}` : folder.name;
        const subFolderFiles = await collectAllFilesFromFolder(folder.id, subFolderPath);
        allFiles.push(...subFolderFiles);
      }
      
    } catch (error) {
      console.warn(`Failed to access folder ${folderId}:`, error);
      // Continue with other folders
    }
    
    return allFiles;
  };

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

    if (!selectedFolderForExport) {
      toast({
        title: 'Folder Required',
        description: 'Please select a folder to export from.',
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

      // Find the selected folder info for path building
      const selectedFolder = selectedFolderForExport === currentFolderId 
        ? { name: breadcrumbs[breadcrumbs.length - 1].name }
        : folders.find(f => f.id === selectedFolderForExport);
      
      if (!selectedFolder) {
        throw new Error('Selected folder not found');
      }

      // Collect all files from selected folder and its subfolders
      toast({
        title: 'Scanning Folders',
        description: `Collecting files from ${selectedFolder.name} and subfolders...`,
      });
      
      const baseFolderPath = selectedFolderForExport === currentFolderId 
        ? breadcrumbs.map(b => b.name).join('/')
        : `${breadcrumbs.map(b => b.name).join('/')}/${selectedFolder.name}`;
      const allFiles = await collectAllFilesFromFolder(selectedFolderForExport, baseFolderPath);
      
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
        'folder_path',
        'folder_id',
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
            `"${fileInfo.path}"`,
            `="${fileInfo.folderId}"`, // Force as string
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
        link.setAttribute('download', `ground-truth-${selectedTemplateForExport}-${selectedFolder.name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`);
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
        description: `Exported ${filesForExport.length} files from "${selectedFolder.name}" to CSV (${filesWithData.length} with existing data, ${filesForExport.length - filesWithData.length} empty).`,
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
      const metadataColumns = ['box_file_id', 'file_name', 'folder_path', 'folder_id', 'template_key'];
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

      console.log('🐛 DEBUG: Import processing completed.');
      console.log('🐛 DEBUG: Final counts - updated:', updatedCount, 'skipped:', skippedCount, 'errors:', errors.length);
      
      // Refresh ground truth system
      console.log('🐛 DEBUG: Refreshing ground truth system...');
      refreshGroundTruth();
      
      // Refresh current folder to update UI
      console.log('🐛 DEBUG: Refreshing folder contents...');
      loadFolderContents(currentFolderId);

      toast({
        title: 'Import Completed',
        description: `Updated ${updatedCount} files, skipped ${skippedCount} files.${errors.length > 0 ? ` ${errors.length} errors occurred.` : ''}`,
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
            <Skeleton className="h-4 w-4" />
          </TableCell>
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
          <TableCell colSpan={5}>
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Fetching Data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </TableCell>
        </TableRow>
      );
    }

    // Show folders first
    const folderRows = folders.map(folder => (
      <TableRow key={`folder-${folder.id}`} className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20" onClick={() => navigateToFolder(folder)}>
        <TableCell>
          {/* Empty cell for checkbox column - folders aren't selectable */}
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-blue-600" />
            {folder.name}
            <span className="text-xs text-muted-foreground">(folder)</span>
          </div>
        </TableCell>
        <TableCell>-</TableCell>
        <TableCell className="text-left">
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
            Folder
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          {/* Empty cell for actions column - folders don't have actions */}
        </TableCell>
      </TableRow>
    ));

    // Show files
    const fileRows = filesWithStatus.map(file => {
      const isComplete =
        file.status.completed === file.status.total && file.status.total > 0;
      return (
        <TableRow key={file.id}>
          <TableCell>
            <Checkbox
              checked={selectedFileIds.has(file.id)}
              onCheckedChange={(checked) => handleSelectFile(file.id, checked as boolean)}
              aria-label={`Select ${file.name}`}
            />
          </TableCell>
          <TableCell className="font-medium">{file.name}</TableCell>
          <TableCell>{file.template?.displayName || 'N/A'}</TableCell>
          <TableCell className="text-left">
            <Badge
              variant="outline"
              className={cn(
                !file.template
                  ? 'border-gray-300 bg-gray-50 text-gray-500'
                  : isComplete
                    ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                    : 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
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

    if (folders.length === 0 && filesWithStatus.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={5}
            className="h-24 text-center text-muted-foreground"
          >
            No files or folders found in this location.
          </TableCell>
        </TableRow>
      );
    }

    return [...folderRows, ...fileRows];
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
              <div>
                <CardTitle>Ground Truth Files</CardTitle>
                <CardDescription>
                  Navigate through folders to find your files, then select <span className="font-semibold text-foreground">Edit</span> to manage ground truth data.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedFileIds.size > 0 && (
                  <Button variant="default" size="sm" onClick={handleGenerateMetadataValues}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Metadata Values ({selectedFileIds.size})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExportClick}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleImportClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              <Home className="h-4 w-4" />
              {breadcrumbs.map((breadcrumb, index) => (
                <div key={breadcrumb.id} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3 w-3" />}
                  <button
                    onClick={() => navigateToBreadcrumb(breadcrumb)}
                    className={cn(
                      "hover:text-foreground transition-colors",
                      index === breadcrumbs.length - 1 
                        ? "text-foreground font-medium" 
                        : "hover:underline"
                    )}
                    disabled={index === breadcrumbs.length - 1}
                  >
                    {breadcrumb.name}
                  </button>
                </div>
              ))}
            </div>

            {/* Files and Folders Table */}
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all files"
                        className={isIndeterminate ? "data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}
                      />
                    </TableHead>
                    <TableHead className="w-[35%] text-left">Name</TableHead>
                    <TableHead className="w-[25%] text-left">Template</TableHead>
                    <TableHead className="w-[20%] text-left">Status</TableHead>
                    <TableHead className="w-[20%] text-right pr-8">Actions</TableHead>
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
              Select a template and folder to export ground truth data from the chosen folder and its subfolders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-select">Template</Label>
              <Select value={selectedTemplateForExport} onValueChange={setSelectedTemplateForExport}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {configuredTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.templateKey}>
                      {template.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-select">Folder</Label>
              <Select value={selectedFolderForExport} onValueChange={setSelectedFolderForExport}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {/* Current folder option */}
                  <SelectItem value={currentFolderId}>
                    📁 {breadcrumbs[breadcrumbs.length - 1].name} (current folder)
                  </SelectItem>
                  {/* Subfolder options */}
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      📁 {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </>
  );
} 