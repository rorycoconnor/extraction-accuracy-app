'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Terminal, ChevronDown, ChevronRight, MapPin, Navigation, Eye } from 'lucide-react';
import type { BoxFile, BoxTemplate, ContextMatch, ExtractionReferences, BoundingBox } from '@/lib/types';
import { DatePicker } from './ui/date-picker';
import { getBoxAccessTokenAction } from '@/lib/actions/box';
import { getFieldContext } from '@/lib/actions/context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NOT_PRESENT_VALUE } from '@/lib/utils';
import { logger } from '@/lib/logger';
import BoxContentPreview, { type BoxContentPreviewHandle } from '@/components/box-content-preview';

type GroundTruthEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  file: BoxFile;
  template: BoxTemplate;
  groundTruth: Record<string, string>;
  onSave: (fileId: string, data: Record<string, string>) => void;
  allReferenceData?: Record<string, ExtractionReferences>;
};

// Helper to create a default form state from template and ground truth data
const createDefaultValues = (template: BoxTemplate, groundTruth: Record<string, string>) => {
    const defaultValues: Record<string, any> = {};
    template.fields.forEach(field => {
        const value = groundTruth[field.key];
        if (field.type === 'date' && value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                defaultValues[field.key] = date;
            } else {
                 defaultValues[field.key] = undefined;
            }
        } else {
             defaultValues[field.key] = value || '';
        }
    });
    return defaultValues;
};


export default function GroundTruthEditor({ isOpen, onClose, file, template, groundTruth, onSave, allReferenceData }: GroundTruthEditorProps) {
  logger.debug('GroundTruthEditor opened for file', { fileId: file.id, 
    template: template.templateKey,
    groundTruthData: groundTruth,
    activeFields: template.fields.filter(f => f.isActive).map(f => ({ key: f.key, name: f.displayName }))
  });
  
  const { toast } = useToast();
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = React.useState(true);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  
  const previewRef = React.useRef<BoxContentPreviewHandle>(null);
  const formContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Where Found functionality
  const [fieldContexts, setFieldContexts] = React.useState<Record<string, ContextMatch | null>>({});
  const [loadingContexts, setLoadingContexts] = React.useState<Record<string, boolean>>({});
  const [openContexts, setOpenContexts] = React.useState<Record<string, boolean>>({});
  const [showAllContexts, setShowAllContexts] = React.useState(false);
  
  // Track if we've initialized the form for this modal open session
  const prevIsOpenRef = React.useRef(isOpen);
  const prevFileIdRef = React.useRef(file.id);
  
  const { control, handleSubmit, formState: { isSubmitting }, reset } = useForm({
    defaultValues: createDefaultValues(template, groundTruth),
  });

  // Load context for a specific field
  const loadFieldContext = React.useCallback(async (fieldKey: string, value: string) => {
    if (!value || value === NOT_PRESENT_VALUE) return;
    
    setLoadingContexts(prev => ({ ...prev, [fieldKey]: true }));
    try {
      const context = await getFieldContext(file.id, fieldKey, value);
      setFieldContexts(prev => ({ ...prev, [fieldKey]: context }));
    } catch (error) {
      logger.error('Failed to load context for field', { fieldKey, error: error instanceof Error ? error : String(error) });
      setFieldContexts(prev => ({ ...prev, [fieldKey]: null }));
    } finally {
      setLoadingContexts(prev => ({ ...prev, [fieldKey]: false }));
    }
  }, [file.id]);

  // Toggle context visibility for a field
  const toggleFieldContext = (fieldKey: string) => {
    setOpenContexts(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  // Toggle all contexts visibility
  const toggleAllContexts = () => {
    const newShowAll = !showAllContexts;
    setShowAllContexts(newShowAll);
    
    if (newShowAll) {
      // Open all contexts and load them
      const allContexts: Record<string, boolean> = {};
      template.fields.filter(f => f.isActive).forEach(field => {
        allContexts[field.key] = true;
        const value = groundTruth[field.key];
        if (value && value !== NOT_PRESENT_VALUE && !fieldContexts[field.key] && !loadingContexts[field.key]) {
          loadFieldContext(field.key, value);
        }
      });
      setOpenContexts(allContexts);
    } else {
      // Close all contexts
      setOpenContexts({});
    }
  };

  // Only reset form when modal OPENS or when file actually changes
  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    const prevFileId = prevFileIdRef.current;
    
    prevIsOpenRef.current = isOpen;
    prevFileIdRef.current = file.id;
    
    const modalJustOpened = isOpen && !wasOpen;
    const fileChangedWhileOpen = isOpen && file.id !== prevFileId;
    
    if (modalJustOpened || fileChangedWhileOpen) {
      reset(createDefaultValues(template, groundTruth));
      setFieldContexts({});
      setLoadingContexts({});
      setOpenContexts({});
      setShowAllContexts(false);
    }
  }, [isOpen, file.id, template, groundTruth, reset]);

  React.useEffect(() => {
    if (isOpen) {
      if (!accessToken) {
        setIsTokenLoading(true);
      }
      setTokenError(null);
      getBoxAccessTokenAction()
        .then(token => setAccessToken(token))
        .catch(err => {
          logger.error('Failed to get access token', err);
          setTokenError(err instanceof Error ? err.message : 'Could not load file preview.');
        })
        .finally(() => setIsTokenLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Get citations for a specific field from all models' reference data
  const getFieldCitations = React.useCallback((fieldKey: string) => {
    if (!allReferenceData) return [];
    const citations: Array<{
      modelName: string;
      content: string;
      pageIndex: number | null;
      boundingBox?: { top_left: { x: number; y: number }; bottom_right: { x: number; y: number } };
      boundingBoxes: BoundingBox[];
    }> = [];
    for (const [modelName, modelRefs] of Object.entries(allReferenceData)) {
      const fieldRef = modelRefs[fieldKey];
      if (fieldRef?.citations) {
        fieldRef.citations.forEach(citation => {
          const boxes = citation.bounding_boxes ?? [];
          const firstBB = boxes[0];
          const page = citation.page ?? firstBB?.page_index ?? null;
          citations.push({
            modelName,
            content: citation.content,
            pageIndex: typeof page === 'number' ? page : null,
            boundingBox: firstBB ? { top_left: firstBB.top_left, bottom_right: firstBB.bottom_right } : undefined,
            boundingBoxes: boxes,
          });
        });
      }
    }
    return citations;
  }, [allReferenceData]);

  // Highlight a citation in the document. Prefers exact coordinate-based
  // bounding box overlays and falls back to text search when unavailable.
  const showCitation = React.useCallback((citation: { content: string; pageIndex: number | null; boundingBoxes: BoundingBox[] }) => {
    if (citation.boundingBoxes.length > 0) {
      previewRef.current?.highlightBoundingBoxes(citation.boundingBoxes);
    } else if (citation.pageIndex !== null) {
      const pageNumber = citation.pageIndex + 1;
      previewRef.current?.setPage(pageNumber);
      if (citation.content) {
        previewRef.current?.highlightText(citation.content, pageNumber);
      }
    }
    logger.debug('Showing citation in preview', {
      pageIndex: citation.pageIndex,
      boxCount: citation.boundingBoxes.length,
    });
  }, []);

  const onSubmit = (data: Record<string, any>) => {
    logger.debug('GroundTruthEditor submitting data for file', { fileId: file.id });
    
    const dataToSave = Object.entries(data).reduce((acc, [key, value]) => {
        if (value instanceof Date) {
            acc[key] = value.toISOString().split('T')[0];
        } else {
            acc[key] = String(value);
        }
        return acc;
    }, {} as Record<string, string>);

    logger.debug('Saving ground truth data', { fieldCount: Object.keys(dataToSave).length });
    onSave(file.id, dataToSave);
  };

  const renderFieldInput = (templateField: typeof template.fields[0], formField: any) => {
    switch (templateField.type) {
      case 'date':
        return (
          <DatePicker
            date={formField.value}
            setDate={formField.onChange}
          />
        );
      case 'enum':
        const options = templateField.options?.map(opt => opt.key) || [];
        return (
          <Select onValueChange={formField.onChange} defaultValue={formField.value}>
            <SelectTrigger className="bg-white dark:bg-gray-800">
              <SelectValue placeholder={`Select ${templateField.displayName}`} />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800">
              <SelectItem value={NOT_PRESENT_VALUE}>{NOT_PRESENT_VALUE}</SelectItem>
              {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <div className="space-y-2">
            <Select onValueChange={(value) => {
              if (value === 'custom') {
                formField.onChange('');
              } else {
                formField.onChange(value);
              }
            }} defaultValue={formField.value === NOT_PRESENT_VALUE ? NOT_PRESENT_VALUE : 'custom'}>
              <SelectTrigger className="bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select option or enter custom value" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800">
                <SelectItem value={NOT_PRESENT_VALUE}>{NOT_PRESENT_VALUE}</SelectItem>
                <SelectItem value="custom">Enter custom value</SelectItem>
              </SelectContent>
            </Select>
            {formField.value !== NOT_PRESENT_VALUE && (
              <Input {...formField} placeholder={`Enter ${templateField.displayName}`} className="bg-white dark:bg-gray-800" />
            )}
          </div>
        );
    }
  };

  // Render the "Where Found" section for a field
  const renderWhereFound = (fieldKey: string, fieldName: string, value: string) => {
    if (!value || value === NOT_PRESENT_VALUE) return null;

    const isOpen = openContexts[fieldKey];
    const isLoading = loadingContexts[fieldKey];
    const context = fieldContexts[fieldKey];
    const citations = getFieldCitations(fieldKey);

    return (
      <Collapsible 
        open={isOpen} 
        onOpenChange={() => toggleFieldContext(fieldKey)}
        className="mt-2"
      >
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (!isOpen && !context && !isLoading) {
                loadFieldContext(fieldKey, value);
              }
            }}
          >
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <MapPin className="h-3 w-3" />
            Where Found
            {citations.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {citations.length} citation{citations.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {context && (
              <Badge variant="outline" className="ml-auto text-xs">
                {context.confidence}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-3">
            {/* Box AI Citations with page navigation */}
            {citations.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Navigation className="h-3 w-3" />
                  Box AI Citations
                </div>
                {citations.map((citation, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (citation.boundingBoxes.length > 0 || citation.pageIndex !== null) showCitation(citation);
                    }}
                    className={`w-full text-left text-xs p-2 rounded border bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                      (citation.boundingBoxes.length > 0 || citation.pageIndex !== null) ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <Eye className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          {citation.pageIndex !== null && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">Page {citation.pageIndex + 1}</Badge>
                          )}
                          {citation.boundingBoxes.length > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-400 text-yellow-700 dark:text-yellow-400">
                              {citation.boundingBoxes.length > 1
                                ? `${citation.boundingBoxes.length} highlights`
                                : 'Highlight'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed line-clamp-2">&ldquo;{citation.content}&rdquo;</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Text search context */}
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Finding context...
              </div>
            ) : context ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Found in document with {context.confidence} confidence
                </div>
                <div 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: context.highlightedContext }}
                />
              </div>
            ) : citations.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Context not found in document text
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderPreview = () => {
    if (isTokenLoading) {
      return (
        <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-background z-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    if (tokenError) {
      return (
        <div className="flex h-full w-full items-center justify-center p-4">
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Preview Error</AlertTitle>
            <AlertDescription>{tokenError}</AlertDescription>
          </Alert>
        </div>
      );
    }
    if (accessToken) {
      return (
        <BoxContentPreview
          ref={previewRef}
          fileId={file.id}
          accessToken={accessToken}
        />
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90%] w-full h-[90vh] flex flex-col p-0 gap-0">
        <div className="flex-grow flex h-full min-h-0">
          {/* Left Side: Document Preview */}
          <div className="flex-[3] bg-muted/30 flex flex-col p-2">
            <div className="relative flex-grow rounded-md border bg-background overflow-hidden">
                {renderPreview()}
            </div>
          </div>
          {/* Right Side: Metadata Form */}
          <div className="flex-[2] flex flex-col border-l" ref={formContainerRef}>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
              <DialogHeader className="p-6 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="font-headline text-xl">Edit Ground Truth</DialogTitle>
                    <DialogDescription>
                      For: {file.name}
                      <br />
                      Confirm or correct AI-suggested values.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              {/* Show Where Found Button Section */}
              <div className="flex justify-center py-4 border-b bg-muted/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleAllContexts}
                >
                  Show Where Found
                </Button>
              </div>
              <ScrollArea className="flex-grow">
                <div className="space-y-6 p-6">
                  {template.fields.filter(f => f.isActive).map((field) => {
                    const fieldCitations = getFieldCitations(field.key);
                    const highlightable = fieldCitations.find(c => c.boundingBoxes.length > 0 || c.pageIndex !== null);
                    return (
                    <div key={field.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor={field.key}>
                                {field.displayName} ({field.type})
                            </Label>
                            {highlightable && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                onClick={() => showCitation(highlightable)}
                                title="Highlight where Box AI found this in the document"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Show in document
                              </Button>
                            )}
                        </div>
                       <Controller
                            name={field.key}
                            control={control}
                            render={({ field: formField }) => (
                              <div className="space-y-2">
                                {renderFieldInput(field, formField)}
                                {renderWhereFound(field.key, field.displayName, formField.value)}
                              </div>
                            )}
                        />
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-muted/50 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => window.open(`https://appworld.app.box.com/file/${file.id}`, '_blank')}
                >
                  Open in Box
                </Button>
                <div className="flex-1" />
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Ground Truth
                </Button>
              </DialogFooter>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
