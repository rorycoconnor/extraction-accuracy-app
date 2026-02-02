'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Terminal, Edit3, FileText, MapPin } from 'lucide-react';
import type { BoxFile, BoxTemplate, AccuracyField, ContextMatch } from '@/lib/types';
import { DatePicker } from './ui/date-picker';
import { getBoxFileEmbedLinkAction } from '@/lib/actions/box';
import { getFieldContext } from '@/lib/actions/context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NOT_PRESENT_VALUE } from '@/lib/utils';
import { logger } from '@/lib/logger';

type InlineGroundTruthEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  file: BoxFile;
  template: BoxTemplate;
  field: AccuracyField;
  currentValue: string;
  onSave: (fileId: string, fieldKey: string, newValue: string) => Promise<void>;
};

export default function InlineGroundTruthEditor({ 
  isOpen, 
  onClose, 
  file, 
  template, 
  field, 
  currentValue, 
  onSave 
}: InlineGroundTruthEditorProps) {
  const { toast } = useToast();
  const [embedUrl, setEmbedUrl] = React.useState<string | null>(null);
  const [isEmbedLoading, setIsEmbedLoading] = React.useState(true);
  const [embedError, setEmbedError] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<ContextMatch | null>(null);
  const [isContextLoading, setIsContextLoading] = React.useState(false);
  const [contextError, setContextError] = React.useState<string | null>(null);
  
  // Track previous isOpen state to detect open/close transitions
  const prevIsOpenRef = React.useRef(isOpen);
  
  // Track focused element to restore after iframe loads (focus theft prevention)
  const focusedElementRef = React.useRef<HTMLElement | null>(null);
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

  // Load embed URL
  React.useEffect(() => {
    if (isOpen && file.id) {
      setIsEmbedLoading(true);
      setEmbedError(null);
      setEmbedUrl(null);

      getBoxFileEmbedLinkAction(file.id)
        .then(url => {
          // Capture currently focused element before iframe renders
          if (document.activeElement instanceof HTMLElement && 
              formContainerRef.current?.contains(document.activeElement)) {
            focusedElementRef.current = document.activeElement;
          }
          setEmbedUrl(url);
        })
        .catch(err => {
          logger.error('Failed to get embed link', err);
          setEmbedError(err instanceof Error ? err.message : "Could not load file preview.");
        })
        .finally(() => {
          setIsEmbedLoading(false);
        });
    }
  }, [isOpen, file.id]);

  // Handle iframe load to restore focus after Box embed steals it
  const handleIframeLoad = React.useCallback(() => {
    // Box's embed viewer steals focus multiple times as it initializes.
    // We monitor and restore focus for a short period after load.
    const restoreFocus = () => {
      if (focusedElementRef.current && document.body.contains(focusedElementRef.current)) {
        // Check if focus has moved to something outside our form (like the iframe)
        const activeElement = document.activeElement;
        const isInForm = formContainerRef.current?.contains(activeElement);
        const isInIframe = activeElement?.tagName === 'IFRAME';
        
        if (!isInForm || isInIframe) {
          focusedElementRef.current.focus();
        }
      }
    };

    // Restore focus multiple times to combat Box's repeated focus theft
    // Box viewer initializes in phases and may steal focus multiple times
    requestAnimationFrame(restoreFocus);
    setTimeout(restoreFocus, 100);
    setTimeout(restoreFocus, 300);
    setTimeout(restoreFocus, 500);
  }, []);

  // Track focus changes within the form to know what to restore
  const handleFormFocus = React.useCallback((e: React.FocusEvent) => {
    if (e.target instanceof HTMLElement) {
      focusedElementRef.current = e.target;
    }
  }, []);

  // Detect when focus leaves the form to the iframe and restore it
  const handleFormBlur = React.useCallback((e: React.FocusEvent) => {
    // Use setTimeout to check where focus went after the blur completes
    setTimeout(() => {
      const activeElement = document.activeElement;
      const isInIframe = activeElement?.tagName === 'IFRAME';
      const isInForm = formContainerRef.current?.contains(activeElement);
      
      // If focus went to the iframe and we had a focused form element, restore focus
      if ((isInIframe || !isInForm) && focusedElementRef.current && document.body.contains(focusedElementRef.current)) {
        // Only restore if the user was actively editing (input, textarea, or select)
        const tagName = focusedElementRef.current.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
          focusedElementRef.current.focus();
        }
      }
    }, 0);
  }, []);

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
    return (
      <>
        {isEmbedLoading && (
          <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-background z-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        
        {embedError && !isEmbedLoading && (
          <div className="flex h-full w-full items-center justify-center p-4">
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Preview Error</AlertTitle>
              <AlertDescription>{embedError}</AlertDescription>
            </Alert>
          </div>
        )}
        
        {embedUrl && (
          <iframe
            src={embedUrl}
            className={`h-full w-full ${isEmbedLoading ? 'invisible' : 'visible'}`}
            title="PDF Preview"
            tabIndex={-1}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            onLoad={handleIframeLoad}
          />
        )}
      </>
    );
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
          <div className="flex-[2] flex flex-col border-l" ref={formContainerRef} onFocusCapture={handleFormFocus} onBlurCapture={handleFormBlur}>
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
              
              <div className="flex-grow p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.name} ({templateField.type})
                    </Label>
                    <Controller
                      name={field.key}
                      control={control}
                      render={({ field: formField }) => renderFieldInput(templateField, formField)}
                    />
                  </div>
                  
                  {/* Show where AI found the information */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Where AI Found This Information:
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
                          💡 This shows the sentence(s) where the AI found "<strong>{context.value}</strong>" in the document.
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
