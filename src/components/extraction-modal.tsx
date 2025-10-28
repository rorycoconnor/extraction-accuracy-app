'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getBoxFilesInFolder, getBoxFolderContents } from '@/lib/actions/box';
import type { BoxTemplate, BoxFile, BoxFolder } from '@/lib/types';
import { Loader2, FileText, Terminal, Folder, ChevronRight, Home, CheckCircle, Circle, ArrowUp, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

type ExtractionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  templates: BoxTemplate[];
  onRunExtraction: (template: BoxTemplate, files: BoxFile[]) => void;
};

type BreadcrumbItem = {
  id: string;
  name: string;
};

// Global file selection state across all folders
type GlobalFileSelection = {
  [fileId: string]: {
    file: BoxFile;
    folderPath: string;
    folderName?: string;
  };
};

export default function ExtractionModal({ isOpen, onClose, templates, onRunExtraction }: ExtractionModalProps) {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');
  
  const [files, setFiles] = useState<BoxFile[]>([]);
  const [folders, setFolders] = useState<BoxFolder[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [errorFiles, setErrorFiles] = useState<string | null>(null);
  
  // Global file selection state - tracks files from all folders
  const [globalFileSelection, setGlobalFileSelection] = useState<GlobalFileSelection>({});
  
  // Navigation state - start from root (ID: 0)
  const [currentFolderId, setCurrentFolderId] = useState<string>("0");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "0", name: "All Files" }
  ]);

  // Search functionality
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);

  const { toast } = useToast();

  // Load folder contents
  const loadFolderContents = (folderId: string) => {
    setIsLoadingFiles(true);
    setErrorFiles(null);
    getBoxFolderContents(folderId)
      .then((contents) => {
        setFiles(contents.files);
        setFolders(contents.folders);
        logger.debug('Folder contents', { folderId, folderCount: contents.folders.length });
        logger.debug('Folder files', { folderId, fileCount: contents.files.length });
      })
      .catch((err) => {
          let errorMessage = err instanceof Error ? err.message : "An unknown error occurred while fetching files from Box.";
          
          // Handle specific error cases
          if (err instanceof Error) {
            if (err.message.includes('Not Found') || err.message.includes('404')) {
              if (folderId === "0") {
                errorMessage = 'Root folder access denied. This usually means the Box app needs to be granted access to specific folders. Try navigating to a specific folder you have access to.';
              } else {
                errorMessage = 'Folder not found: The application does not have access to this folder. Please ensure you have invited the application\'s Service Account as a collaborator on the folder in your Box account.';
              }
            } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
              errorMessage = 'Access denied: You do not have permission to view this folder. Please check your Box permissions or try a different folder.';
            } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
              errorMessage = 'Authentication failed: Please check your Box OAuth connection or credentials.';
            }
          }
          
          setErrorFiles(errorMessage);
          logger.error('Error', err);
      })
      .finally(() => setIsLoadingFiles(false));
  };

  // Navigate to a folder
  const navigateToFolder = (folder: BoxFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    loadFolderContents(folder.id);
  };

  // Navigate to a breadcrumb (go back)
  const navigateToBreadcrumb = (targetBreadcrumb: BreadcrumbItem) => {
    const targetIndex = breadcrumbs.findIndex(b => b.id === targetBreadcrumb.id);
    if (targetIndex !== -1) {
      setCurrentFolderId(targetBreadcrumb.id);
      setBreadcrumbs(breadcrumbs.slice(0, targetIndex + 1));
      loadFolderContents(targetBreadcrumb.id);
    }
  };

  // Navigate to parent folder
  const navigateToParent = () => {
    if (breadcrumbs.length > 1) {
      const parentBreadcrumb = breadcrumbs[breadcrumbs.length - 2];
      navigateToBreadcrumb(parentBreadcrumb);
    }
  };

  // Navigate to root
  const navigateToRoot = () => {
    setCurrentFolderId("0");
    setBreadcrumbs([{ id: "0", name: "All Files" }]);
    loadFolderContents("0");
  };

  // Handle file selection (adds to global selection)
  const handleToggleFileSelection = (file: BoxFile) => {
    setGlobalFileSelection(prev => {
      const newSelection = { ...prev };
      const fileId = file.id;
      
      if (newSelection[fileId]) {
        // Remove from selection
        delete newSelection[fileId];
      } else {
        // Add to selection with folder path info
        const folderPath = breadcrumbs.map(b => b.name).join(' > ');
        const folderName = breadcrumbs[breadcrumbs.length - 1]?.name || 'Unknown';
        newSelection[fileId] = {
          file,
          folderPath,
          folderName
        };
      }
      
      return newSelection;
    });
  };

  // Handle folder selection (select all files in current folder)
  const handleSelectAllInFolder = (checked: boolean) => {
    if (checked) {
      // Add all files in current folder to global selection
      const newSelection = { ...globalFileSelection };
      const folderPath = breadcrumbs.map(b => b.name).join(' > ');
      const folderName = breadcrumbs[breadcrumbs.length - 1]?.name || 'Unknown';
      
      files.forEach(file => {
        newSelection[file.id] = {
          file,
          folderPath,
          folderName
        };
      });
      
      setGlobalFileSelection(newSelection);
    } else {
      // Remove all files in current folder from global selection
      const newSelection = { ...globalFileSelection };
      files.forEach(file => {
        delete newSelection[file.id];
      });
      setGlobalFileSelection(newSelection);
    }
  };

  // Clear all selections
  const handleClearAllSelections = () => {
    setGlobalFileSelection({});
  };

  // Get selected files from global selection
  const getSelectedFiles = (): BoxFile[] => {
    return Object.values(globalFileSelection).map(item => item.file);
  };

  // Check if all files in current folder are selected
  const allFilesInFolderSelected = files.length > 0 && files.every(file => globalFileSelection[file.id]);
  
  // Check if some files in current folder are selected
  const someFilesInFolderSelected = files.some(file => globalFileSelection[file.id]) && !allFilesInFolderSelected;

  // Get total selected count
  const totalSelectedCount = Object.keys(globalFileSelection).length;

  useEffect(() => {
    if (isOpen) {
      // Reset to root folder when modal opens
      setCurrentFolderId("0");
      setBreadcrumbs([{ id: "0", name: "All Files" }]);
      setGlobalFileSelection({}); // Clear any previous selections
      setSearchQuery('');
      loadFolderContents("0");
    }
  }, [isOpen]);

  const handleClose = () => {
    try {
      // Clear any pending state before closing
      setGlobalFileSelection({});
      setSearchQuery('');
      
      // Call the parent close handler
      onClose();
    } catch (error) {
      logger.error('Error closing extraction modal', error);
      // Force close even if there's an error
      onClose();
    }
  };

  const handleRunExtraction = () => {
    const selectedTemplate = templates.find(t => t.templateKey === selectedTemplateKey);
    const selectedFiles = getSelectedFiles();

    // Debug logging
    logger.debug('Submit Debug', {
      selectedTemplateKey,
      selectedTemplate: !!selectedTemplate,
      selectedFileIds: selectedFiles.map(f => f.id),
      availableFiles: files.map(f => ({ id: f.id, name: f.name })),
      selectedFiles: selectedFiles.map(f => ({ id: f.id, name: f.name })),
      currentFolder: currentFolderId,
      breadcrumbs,
      globalSelection: globalFileSelection
    });

    if (!selectedTemplate) {
      toast({
        variant: 'destructive',
        title: 'No Template Selected',
        description: 'Please select a template first.',
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Files Selected',
        description: 'Please select at least one file from any folder.',
      });
      return;
    }
    
    onRunExtraction(selectedTemplate, selectedFiles);

    toast({
        title: 'Files Loaded',
        description: `${selectedFiles.length} file(s) loaded from ${new Set(Object.values(globalFileSelection).map(item => item.folderPath)).size} folder(s). Next Step: Select "Run Comparison"`,
    });
    handleClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-[1320px] max-h-[90vh]">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-semibold">Batch Document Processing</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Step 1: Template Selection */}
          <div className="space-y-3 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-primary text-primary-foreground">
                1
              </div>
              <div className="flex items-center gap-2">
                {selectedTemplateKey ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <Label className="text-base font-medium">Choose Template</Label>
                <span className="text-sm text-muted-foreground">(Required)</span>
              </div>
            </div>
            <div className="ml-11">
              <Select onValueChange={setSelectedTemplateKey} value={selectedTemplateKey} disabled={templates.length === 0}>
                <SelectTrigger className="h-12 bg-background rounded-full">
                                    <SelectValue placeholder={
                      <div className="flex items-center gap-2 text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{templates.length === 0 ? "No templates configured" : "Choose a template to get started..."}</span>
                      </div>
                  } />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.templateKey}>
                         <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{template.displayName}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Step 2: File Selection */}
          <div className={cn(
            "space-y-3 p-4 rounded-lg border bg-card",
            !selectedTemplateKey && "opacity-60"
          )}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-primary text-primary-foreground">
                2
              </div>
              <div className="flex items-center gap-2">
                {totalSelectedCount > 0 ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <Label className="text-base font-medium">Select Documents</Label>
                {totalSelectedCount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({totalSelectedCount} selected from {new Set(Object.values(globalFileSelection).map(item => item.folderPath)).size} folder(s))
                  </span>
                )}
              </div>
            </div>
            <div className="ml-11">
              <p className="text-sm text-muted-foreground mb-3">
                {!selectedTemplateKey 
                  ? "Complete step 1 first to enable file selection." 
                  : "Choose documents from any folder. You can navigate through folders and select files from multiple locations."
                }
              </p>
            
            {/* Header Row: Breadcrumb Navigation | Selected Files Title */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-center mb-3">
            {/* Breadcrumb Navigation */}
              <div className="lg:col-span-6">
                <div className="flex items-center gap-1 text-sm text-muted-foreground px-1 py-2">
              <button
                onClick={navigateToRoot}
                className="hover:text-foreground transition-colors hover:underline"
                title="Go to root folder"
              >
                <Home className="h-4 w-4" />
              </button>
              {breadcrumbs.length > 1 && (
                <button
                  onClick={navigateToParent}
                  className="hover:text-foreground transition-colors hover:underline ml-1"
                  title="Go to parent folder"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
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
              </div>
              
              {/* Selected Files Title */}
              <div className="lg:col-span-4">
                <div className="flex items-center justify-between px-1 py-2">
                  <h4 className="text-sm font-medium text-foreground">Selected Files</h4>
                  {totalSelectedCount > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearAllSelections}
                      className="h-6 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Two-column layout: Navigation (60%) | Selected Files (40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
              {/* Left Column: File/Folder Navigation */}
              <div className="lg:col-span-6">
                
                                                  {/* File/Folder Browser */}
                 <div className="border rounded-md bg-card h-[320px] flex flex-col">
                {isLoadingFiles ? (
                       <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : errorFiles ? (
                    <div className="p-4">
                        <Alert variant="destructive">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Error Fetching Files</AlertTitle>
                        <AlertDescription>{errorFiles}</AlertDescription>
                        </Alert>
                        
                        {/* Helpful navigation options when root folder fails */}
                        {currentFolderId === "0" && (
                          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                              💡 Root folder access issue? Try these alternatives:
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-blue-700 dark:text-blue-300">
                                • <strong>Navigate to a specific folder</strong> you know you have access to
                              </div>
                              <div className="text-xs text-blue-700 dark:text-blue-300">
                                • <strong>Check Box permissions</strong> - ensure the app is invited to folders
                              </div>
                              <div className="text-xs text-blue-700 dark:text-blue-300">
                                • <strong>Use OAuth2.0</strong> - personal accounts have different access patterns
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  // Try to navigate to a common folder ID (Documents)
                                  setCurrentFolderId("329136417488");
                                  setBreadcrumbs([{ id: "329136417488", name: "Documents" }]);
                                  loadFolderContents("329136417488");
                                }}
                                className="text-blue-700 border-blue-300 hover:bg-blue-100"
                              >
                                Try Documents Folder
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  // Reset to root and try again
                                  setCurrentFolderId("0");
                                  setBreadcrumbs([{ id: "0", name: "All Files" }]);
                                  loadFolderContents("0");
                                }}
                                className="text-blue-700 border-blue-300 hover:bg-blue-100"
                              >
                                Retry Root
                              </Button>
                            </div>
                          </div>
                        )}
                    </div>
                ) : files.length === 0 && folders.length === 0 ? (
                       <div className="flex items-center justify-center h-full">
                         <p className="text-sm text-center text-muted-foreground">
                      {currentFolderId === "0" 
                        ? "No files or folders found at root level. You may need to grant access to specific folders."
                        : "No files or folders found in this folder."
                      }
                    </p>
                       </div>
                ) : (
                    <>
                           <div className="flex-shrink-0 flex items-center space-x-3 p-4 border-b">
                            <Checkbox
                                id="select-all-files-in-folder"
                                checked={allFilesInFolderSelected ? true : someFilesInFolderSelected ? 'indeterminate' : false}
                                onCheckedChange={handleSelectAllInFolder}
                            />
                            <Label htmlFor="select-all-files-in-folder" className="flex-1 cursor-pointer text-sm font-medium">
                                Select All in Current Folder ({files.filter(f => globalFileSelection[f.id]).length}/{files.length} files)
                            </Label>
                        </div>
                           <div className="flex-1 overflow-hidden">
                             <ScrollArea className="h-full w-full">
                                 <div className="space-y-1 p-1">
                                {/* Show folders first */}
                                {folders.map(folder => (
                                <button
                                  key={`folder-${folder.id}`} 
                                  onClick={() => navigateToFolder(folder)}
                                  className="w-full flex items-center space-x-3 rounded-md bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    <div className="flex-shrink-0 px-3">
                                      <div className="w-4 h-4" /> {/* Spacer where checkbox would be */}
                                    </div>
                                    <div className="py-3 text-left overflow-hidden flex-1">
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                            <span className="truncate text-sm font-medium text-foreground">{folder.name}</span>
                                            <span className="text-xs text-muted-foreground">(folder)</span>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                                        </div>
                                    </div>
                                </button>
                                ))}
                                
                                {/* Show files */}
                                {files.map(file => (
                                <div key={file.id} className="flex items-center space-x-3 rounded-md">
                                    <div className="flex-shrink-0 px-3">
                                      <Checkbox
                                          id={`file-${file.id}`}
                                          checked={!!globalFileSelection[file.id]}
                                          onCheckedChange={() => handleToggleFileSelection(file)}
                                      />
                                    </div>
                                    <Label htmlFor={`file-${file.id}`} className="cursor-pointer py-3 overflow-hidden flex-1">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            <span className="block truncate text-sm">{file.name}</span>
                                            {globalFileSelection[file.id] && (
                                              <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded-full">
                                                Selected
                                              </span>
                                            )}
                                        </div>
                                    </Label>
                                </div>
                                ))}
                            </div>
                        </ScrollArea>
                           </div>
                    </>
                )}
                </div>
              </div>

              {/* Right Column: Selected Files Panel */}
              <div className="lg:col-span-4">
                <div className="sticky top-0">
                  <div className="border rounded-md bg-card h-[320px] flex flex-col">
                    {/* Scrollable files area - takes remaining space */}
                    <div className="flex-1 overflow-hidden">
                      {totalSelectedCount === 0 ? (
                        <div className="flex items-center justify-center h-full text-center">
                          <div className="text-sm text-muted-foreground">
                            No files selected<br />
                            <span className="text-xs">Select files from the left panel</span>
                          </div>
                        </div>
                      ) : (
                                                <div className="h-full overflow-auto px-3 py-2">
                          <div className="space-y-2">
                            {Object.values(globalFileSelection).map((item) => (
                              <div key={item.file.id} className="group relative w-full">
                                <div className="flex items-start gap-2 p-2 rounded-md border bg-card hover:bg-accent transition-colors h-16 w-full max-w-full overflow-hidden">
                                  <FileText className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                  <div className="flex-1 min-w-0 py-1 pr-8">
                                    <div className="text-xs font-medium truncate leading-tight" title={item.file.name}>
                                      {item.file.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate mt-1 leading-tight" title={item.folderName || item.folderPath}>
                                      📁 {item.folderName || item.folderPath.split(' > ').pop() || 'Unknown'}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleFileSelection(item.file)}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 absolute right-2 top-2"
                                  >
                                    ×
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Fixed footer area - always present to maintain consistent height */}
                    <div className="flex-shrink-0 h-12 border-t bg-muted/30 flex items-center justify-center rounded-b-md">
                      <div className="text-xs text-muted-foreground text-center">
                        {totalSelectedCount === 0 
                          ? "No files selected" 
                          : `${totalSelectedCount} file${totalSelectedCount === 1 ? '' : 's'} from ${new Set(Object.values(globalFileSelection).map(item => item.folderName || item.folderPath.split(' > ').pop() || 'Unknown')).size} folder${new Set(Object.values(globalFileSelection).map(item => item.folderName || item.folderPath.split(' > ').pop() || 'Unknown')).size === 1 ? '' : 's'}`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
             </div>
            </div>
          </div>
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button 
              onClick={handleRunExtraction} 
              disabled={!selectedTemplateKey || totalSelectedCount === 0}
            >
                {!selectedTemplateKey 
                  ? "Complete Step 1: Choose Template" 
                  : totalSelectedCount === 0 
                    ? "Complete Step 2: Select Documents"
                    : `Process ${totalSelectedCount} Document${totalSelectedCount === 1 ? '' : 's'}`
                }
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
