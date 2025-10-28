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
import { Loader2, Terminal, ChevronDown, ChevronRight, MapPin, Eye, EyeOff } from 'lucide-react';
import type { BoxFile, BoxTemplate, ContextMatch } from '@/lib/types';
import { DatePicker } from './ui/date-picker';
import { getBoxFileEmbedLinkAction } from '@/lib/actions/box';
import { getFieldContext } from '@/lib/actions/context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NOT_PRESENT_VALUE } from '@/lib/utils';
import { logger } from '@/lib/logger';

type GroundTruthEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  file: BoxFile;
  template: BoxTemplate;
  groundTruth: Record<string, string>;
  onSave: (fileId: string, data: Record<string, string>) => void;
};

// Helper to create a default form state from template and ground truth data
const createDefaultValues = (template: BoxTemplate, groundTruth: Record<string, string>) => {
    const defaultValues: Record<string, any> = {};
    template.fields.forEach(field => {
        const value = groundTruth[field.key];
        if (field.type === 'date' && value) {
            const date = new Date(value);
            // Check for invalid date, which can happen if the string is not a valid date format
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


export default function GroundTruthEditor({ isOpen, onClose, file, template, groundTruth, onSave }: GroundTruthEditorProps) {
  logger.debug('GroundTruthEditor opened for file', { fileId: file.id, 
    template: template.templateKey,
    groundTruthData: groundTruth,
    activeFields: template.fields.filter(f => f.isActive).map(f => ({ key: f.key, name: f.displayName }))
  });
  
  const { toast } = useToast();
  const [embedUrl, setEmbedUrl] = React.useState<string | null>(null);
  const [isEmbedLoading, setIsEmbedLoading] = React.useState(true);
  const [embedError, setEmbedError] = React.useState<string | null>(null);
  
  // Where Found functionality
  const [fieldContexts, setFieldContexts] = React.useState<Record<string, ContextMatch | null>>({});
  const [loadingContexts, setLoadingContexts] = React.useState<Record<string, boolean>>({});
  const [openContexts, setOpenContexts] = React.useState<Record<string, boolean>>({});
  const [showAllContexts, setShowAllContexts] = React.useState(false);

  
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
      logger.error('Failed to load context for field', { fieldKey, error });
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

  // Re-initialize form when the selected file changes
  React.useEffect(() => {
    reset(createDefaultValues(template, groundTruth));
    // Reset context state when file changes
    setFieldContexts({});
    setLoadingContexts({});
    setOpenContexts({});
    setShowAllContexts(false);
  }, [file.id, template, groundTruth, reset]);

  React.useEffect(() => {
    if (isOpen && file.id) {
      setIsEmbedLoading(true);
      setEmbedError(null);
      setEmbedUrl(null);

      getBoxFileEmbedLinkAction(file.id)
        .then(url => {
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


  const onSubmit = (data: Record<string, any>) => {
    logger.debug('GroundTruthEditor submitting data for file', { fileId: file.id });
    
    // Convert date objects back to strings for saving
    const dataToSave = Object.entries(data).reduce((acc, [key, value]) => {
        if (value instanceof Date) {
            acc[key] = value.toISOString().split('T')[0]; // Format as YYYY-MM-DD
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
      default: // string and others
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
            {context && (
              <Badge variant="outline" className="ml-auto text-xs">
                {context.confidence}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
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
            ) : (
              <div className="text-xs text-muted-foreground">
                Context not found in document text
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderPreview = () => {
    if (isEmbedLoading) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    if (embedError) {
      return (
        <div className="flex h-full w-full items-center justify-center p-4">
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Preview Error</AlertTitle>
                <AlertDescription>{embedError}</AlertDescription>
            </Alert>
        </div>
      );
    }
    if (embedUrl) {
      return (
        <iframe
            src={embedUrl}
            className="h-full w-full"
            title="PDF Preview"
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
          <div className="flex-[2] flex flex-col border-l">
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
                  {template.fields.filter(f => f.isActive).map((field) => (
                    <div key={field.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor={field.key}>
                                {field.displayName} ({field.type})
                            </Label>
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
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-muted/50 border-t">
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
