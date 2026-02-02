'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { formatModelName } from '@/lib/utils';
import { ModelIcon } from '@/components/model-pill';
import { Copy } from 'lucide-react';

type CopyGroundTruthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedModel: string) => void;
  availableModels: string[];
};

export default function CopyGroundTruthModal({
  isOpen,
  onClose,
  onConfirm,
  availableModels,
}: CopyGroundTruthModalProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      // Default to enhanced_extract_agent if available, otherwise first model
      if (availableModels.includes('enhanced_extract_agent')) {
        setSelectedModel('enhanced_extract_agent');
      } else if (availableModels.length > 0) {
        setSelectedModel(availableModels[0]);
      } else {
        setSelectedModel('');
      }
    }
  }, [isOpen, availableModels]);

  const handleConfirm = () => {
    if (selectedModel) {
      onConfirm(selectedModel);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Ground Truth</DialogTitle>
          <DialogDescription>
            Select which model&apos;s results to copy to Ground Truth.
          </DialogDescription>
        </DialogHeader>
        
        {availableModels.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-8">
            No model results available. Please run an extraction first.
          </p>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-6 -mr-6">
            <RadioGroup value={selectedModel} onValueChange={setSelectedModel} className="space-y-3">
              {availableModels.map((modelId) => (
                <div key={modelId} className="flex items-center space-x-3">
                  <RadioGroupItem value={modelId} id={`model-${modelId}`} />
                  <Label 
                    htmlFor={`model-${modelId}`} 
                    className="flex-1 cursor-pointer font-normal flex items-center gap-2"
                  >
                    <span>{formatModelName(modelId)}</span>
                    <ModelIcon modelId={modelId} size="sm" />
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </ScrollArea>
        )}
        
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedModel || availableModels.length === 0}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
