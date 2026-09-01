'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Terminal, Edit3, FileText, MapPin, Navigation, Eye } from 'lucide-react';
import type { BoxFile, BoxTemplate, AccuracyField, ContextMatch, FieldReference, BoundingBox } from '@/lib/types';
import { DatePicker } from './ui/date-picker';
import { getBoxAccessTokenAction } from '@/lib/actions/box';
import { getFieldContext } from '@/lib/actions/context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NOT_PRESENT_VALUE } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Badge } from '@/components/ui/badge';
import BoxContentPreview, { type BoxContentPreviewHandle } from '@/components/box-content-preview';

type InlineGroundTruthEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  file: BoxFile;
  template: BoxTemplate;
  field: AccuracyField;
  currentValue: string;
  onSave: (fileId: string, fieldKey: string, newValue: string) => Promise<void>;
  fieldReferences?: Record<string, FieldReference>;
};

export default function InlineGroundTruthEditor({ 
  isOpen, 
  onClose, 
  file, 
  template, 
  field, 
  currentValue, 
  onSave,
  fieldReferences
}: InlineGroundTruthEditorProps) {
  const { toast } = useToast();
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = React.useState(true);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<ContextMatch | null>(null);
  const [isContextLoading, setIsContextLoading] = React.useState(false);
  const [contextError, setContextError] = React.useState<string | null>(null);
  const [activeCitationIndex, setActiveCitationIndex] = React.useState<number | null>(null);
  
  const prevIsOpenRef = React.useRef(isOpen);
  const previewRef = React.useRef<BoxContentPreviewHandle>(null);
  const formContainerRef = React.useRef<HTMLDivElement>(null);

  const { control, handleSubmit, formState: { isSubmitting }, reset } = useForm({
    defaultValues: {
      [field.key]: currentValue || '',
    },
  });

  // Only reset form when modal OPENS (transitions from closed to open)
  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    
    if (isOpen && !wasOpen) {
      reset({ [field.key]: currentValue || '' });
    }
  }, [isOpen, field.key, currentValue, reset]);

  React.useEffect(() => {
    if (isOpen) {
      // Don't show loading spinner if we already have a token — avoids
      // unmounting the preview when the dialog reopens for a different field.
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

  // Flatten all citations from all models into a single list for display
  const allCitations = React.useMemo(() => {
    if (!fieldReferences) return [];
    
    const citations: Array<{
      modelName: string;
      content: string;
      pageIndex: number | null;
      boundingBox?: { top_left: { x: number; y: number }; bottom_right: { x: number; y: number } };
      boundingBoxes: BoundingBox[];
      citationIndex: number;
    }> = [];
    
    for (const [modelName, fieldRef] of Object.entries(fieldReferences)) {
      fieldRef.citations.forEach((citation, idx) => {
        const boxes = citation.bounding_boxes ?? [];
        const firstBB = boxes[0];
        // Page number comes from the citation level (Box API puts it there),
        // falling back to the bounding box page_index if present.
        const page = citation.page ?? firstBB?.page_index ?? null;
        
        citations.push({
          modelName,
          content: citation.content,
          pageIndex: typeof page === 'number' ? page : null,
          boundingBox: firstBB ? { top_left: firstBB.top_left, bottom_right: firstBB.bottom_right } : undefined,
          boundingBoxes: boxes,
          citationIndex: idx,
        });
      });
    }
    return citations;
  }, [fieldReferences, field.key]);

  // Highlight a citation in the document. Prefers exact coordinate-based
  // bounding box overlays (from Box AI reference data) and falls back to
  // text search when a citation has no bounding boxes.
  const showCitation = React.useCallback((citation: typeof allCitations[number], citationIdx: number) => {
    if (citation.boundingBoxes.length > 0) {
      previewRef.current?.highlightBoundingBoxes(citation.boundingBoxes);
    } else if (citation.pageIndex !== null) {
      const pageNumber = citation.pageIndex + 1;
      previewRef.current?.setPage(pageNumber);
      if (citation.content) {
        previewRef.current?.highlightText(citation.content, pageNumber);
      }
    }
    setActiveCitationIndex(citationIdx);
    logger.debug('Showing citation in preview', {
      citationIdx,
      pageIndex: citation.pageIndex,
      boxCount: citation.boundingBoxes.length,
    });
  }, [allCitations]);

  // Auto-navigate to first citation when preview is ready
  const [previewReady, setPreviewReady] = React.useState(false);
  const handlePreviewLoad = React.useCallback(() => setPreviewReady(true), []);

  React.useEffect(() => {
    if (previewReady && allCitations.length > 0 && activeCitationIndex === null) {
      const first = allCitations[0];
      if (first.boundingBoxes.length > 0 || first.pageIndex !== null) {
        showCitation(first, 0);
      }
    }
  }, [previewReady, allCitations, activeCitationIndex, showCitation]);

  React.useEffect(() => {
    if (!isOpen) {
      setPreviewReady(false);
      setActiveCitationIndex(null);
    }
  }, [isOpen]);

  // Fetch context information when the editor opens with a current value
  React.useEffect(() => {
    if (isOpen && file.id && currentValue && currentValue.trim() !== '' && currentValue !== NOT_PRESENT_VALUE) {
      setIsContextLoading(true);
      setContextError(null);
      setContext(null);

      getFieldContext(file.id, field.key, currentValue)
        .then(contextResult => {
          setContext(contextResult);
        })
        .catch(err => {
          logger.error('Failed to get context', err);
          setContextError(err instanceof Error ? err.message : "Could not load context information.");
        })
        .finally(() => {
          setIsContextLoading(false);
        });
    } else {
      setContext(null);
      setContextError(null);
      setIsContextLoading(false);
    }
  }, [isOpen, file.id, currentValue, field.key]);

  const onSubmit = async (data: Record<string, any>) => {
    const newValue = data[field.key];
    
    let valueToSave: string;
    if (newValue instanceof Date) {
      valueToSave = newValue.toISOString().split('T')[0];
    } else {
      valueToSave = String(newValue);
    }

    try {
      await onSave(file.id, field.key, valueToSave);
      onClose();
    } catch (error) {
      logger.error('Error saving ground truth', error instanceof Error ? error : { error });
      toast({
        title: 'Save Failed',
        description: 'Failed to save ground truth data. Please try again.',
        variant: 'destructive',
      });
    }
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
          onLoad={handlePreviewLoad}
        />
      );
    }
    return null;
  };

  const templateField = template.fields.find(tf => tf.key === field.key);
  if (!templateField) {
    return null;
  }

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
          
          {/* Right Side: Field Editor */}
          <div className="flex-[2] flex flex-col border-l" ref={formContainerRef}>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
              <DialogHeader className="p-6 border-b">
                <DialogTitle className="font-headline text-xl flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Quick Edit: {field.name}
                </DialogTitle>
                <DialogDescription>
                  File: {file.name}
                  <br />
                  Current value: <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{currentValue || 'Empty'}</span>
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-grow overflow-y-auto p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={field.key}>
                        {field.name} ({templateField.type})
                      </Label>
                      {allCitations.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          onClick={() => showCitation(allCitations[0], 0)}
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
                      render={({ field: formField }) => renderFieldInput(templateField, formField)}
                    />
                  </div>
                  
                  {/* Box AI Citations with page navigation (when available) */}
                  {allCitations.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground flex items-center gap-2">
                        <Navigation className="h-4 w-4" />
                        Citations from Box AI
                        <Badge variant="secondary" className="text-xs">{allCitations.length}</Badge>
                      </Label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {allCitations.map((citation, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (citation.boundingBoxes.length > 0 || citation.pageIndex !== null) {
                                showCitation(citation, idx);
                              }
                            }}
                            className={`w-full text-left text-sm p-2.5 rounded border transition-all ${
                              activeCitationIndex === idx
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-200 dark:ring-blue-800'
                                : 'bg-muted/30 border-border hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800'
                            } ${(citation.boundingBoxes.length > 0 || citation.pageIndex !== null) ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="flex items-start gap-2">
                              <Eye className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                                activeCitationIndex === idx ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5 flex-wrap">
                                  {citation.pageIndex !== null && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      Page {citation.pageIndex + 1}
                                    </Badge>
                                  )}
                                  {citation.boundingBoxes.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-400 text-yellow-700 dark:text-yellow-400">
                                      {citation.boundingBoxes.length > 1
                                        ? `${citation.boundingBoxes.length} highlights`
                                        : 'Highlight'}
                                    </Badge>
                                  )}
                                  <span className="truncate text-[10px] opacity-70">{citation.modelName.replace(/__/g, ' ')}</span>
                                </div>
                                <p className="text-xs leading-relaxed line-clamp-3">
                                  &ldquo;{citation.content}&rdquo;
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Click a citation to highlight where it was found in the document.
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback: text-search-based context (when no Box AI citations) */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {allCitations.length > 0 ? 'Text Search Context:' : 'Where AI Found This Information:'}
                    </Label>
                    {isContextLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded border">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Finding context in document...
                      </div>
                    ) : contextError ? (
                      <Alert variant="destructive">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Context Error</AlertTitle>
                        <AlertDescription>{contextError}</AlertDescription>
                      </Alert>
                    ) : context ? (
                      <div className="space-y-2">
                        <div className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                          <div className="flex items-start gap-2 mb-2">
                            <FileText className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400" />
                            <div className="flex-1">
                              <div className="font-medium text-green-800 dark:text-green-200 text-xs mb-1">
                                Found with {context.confidence} confidence
                              </div>
                              <div 
                                className="text-sm text-green-700 dark:text-green-300 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: context.highlightedContext }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          This shows the sentence(s) where the AI found &ldquo;<strong>{context.value}</strong>&rdquo; in the document.
                        </div>
                      </div>
                    ) : currentValue && currentValue.trim() !== '' && currentValue !== NOT_PRESENT_VALUE ? (
                      <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded border">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Could not locate where this value was found in the document.
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded border">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          No current value to search for in the document.
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Show the field's prompt for context */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Extraction Prompt:</Label>
                    <div className="text-xs bg-muted/50 p-3 rounded border">
                      {field.prompt}
                    </div>
                  </div>
                </div>
              </div>
              
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
