import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogContent, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogCancel, 
  AlertDialogAction 
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import ExtractionModal from '@/components/extraction-modal';
import PromptStudioSheet from '@/components/prompt-studio-sheet';
import InlineGroundTruthEditor from '@/components/inline-ground-truth-editor';
import ModelRankingSummary from '@/components/model-ranking-summary';
import type { AccuracyData, AccuracyField, BoxTemplate, BoxFile } from '@/lib/types';

interface ModalContainerProps {
  // Extraction Modal
  isExtractionModalOpen: boolean;
  configuredTemplates: BoxTemplate[];
  onCloseExtractionModal: () => void;
  onRunExtraction: (template: BoxTemplate, selectedFiles: BoxFile[]) => void;
  
  // Prompt Studio Sheet
  isPromptStudioOpen: boolean;
  selectedFieldForPromptStudio: AccuracyField | null;
  selectedTemplateName?: string;
  onClosePromptStudio: () => void;
  onUpdatePrompt: (fieldKey: string, newPrompt: string) => void;
  onUsePromptVersion: (fieldKey: string, promptVersion: any) => void;
  onToggleFavorite?: (fieldKey: string, versionId: string) => void;
  
  // Inline Ground Truth Editor
  isInlineEditorOpen: boolean;
  selectedCellForEdit: {
    file: BoxFile;
    field: AccuracyField;
    currentValue: string;
  } | null;
  selectedTemplate: BoxTemplate | null;
  onCloseInlineEditor: () => void;
  onSaveInlineGroundTruth: (fileId: string, fieldKey: string, newValue: string) => Promise<void>;
  
  // Performance Modal
  isPerformanceModalOpen: boolean;
  accuracyData: AccuracyData | null;
  shownColumns: Record<string, boolean>;
  onClosePerformanceModal: () => void;
  onRecalculateMetrics?: () => void; // New prop for recalculating metrics
  
  // Reset Dialog
  showResetDialog: boolean;
  onCloseResetDialog: () => void;
  onConfirmReset: () => void;
}

const ModalContainer: React.FC<ModalContainerProps> = ({
  isExtractionModalOpen,
  configuredTemplates,
  onCloseExtractionModal,
  onRunExtraction,
  isPromptStudioOpen,
  selectedFieldForPromptStudio,
  selectedTemplateName,
  onClosePromptStudio,
  onUpdatePrompt,
  onUsePromptVersion,
  onToggleFavorite,
  isInlineEditorOpen,
  selectedCellForEdit,
  selectedTemplate,
  onCloseInlineEditor,
  onSaveInlineGroundTruth,
  isPerformanceModalOpen,
  accuracyData,
  shownColumns,
  onClosePerformanceModal,
  showResetDialog,
  onCloseResetDialog,
  onConfirmReset
}) => {
  return (
    <>
      {/* Extraction Modal */}
      <ExtractionModal 
        isOpen={isExtractionModalOpen}
        onClose={onCloseExtractionModal}
        templates={configuredTemplates}
        onRunExtraction={onRunExtraction}
      />
      
      {/* Prompt Studio Sheet */}
      <PromptStudioSheet
        isOpen={isPromptStudioOpen}
        onClose={onClosePromptStudio}
        field={selectedFieldForPromptStudio}
        templateName={selectedTemplateName}
        onUpdatePrompt={onUpdatePrompt}
        onUsePromptVersion={onUsePromptVersion}
        onToggleFavorite={onToggleFavorite}
        selectedFileIds={accuracyData?.results?.map(r => r.id) ?? []}
      />
      
      {/* Inline Ground Truth Editor */}
      {(() => {
        // Try to get template from selectedTemplate or derive it from accuracy data
        let templateToUse = selectedTemplate;
        
        if (!templateToUse && accuracyData?.templateKey) {
          templateToUse = configuredTemplates.find(t => t.templateKey === accuracyData.templateKey) || null;
        }
        
        if (selectedCellForEdit && templateToUse) {
          return (
            <InlineGroundTruthEditor
              isOpen={isInlineEditorOpen}
              onClose={onCloseInlineEditor}
              file={selectedCellForEdit.file}
              template={templateToUse}
              field={selectedCellForEdit.field}
              currentValue={selectedCellForEdit.currentValue}
              onSave={onSaveInlineGroundTruth}
            />
          );
        }
        
        return null;
      })()}
      
      {/* Performance Summary Modal */}
      {accuracyData && (
        <Dialog open={isPerformanceModalOpen} onOpenChange={onClosePerformanceModal}>
          <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0">
            <DialogHeader className="p-6 border-b bg-background">
              <DialogTitle className="text-2xl font-bold">Model Performance Summary</DialogTitle>
              <DialogDescription>
                Comprehensive performance analysis showing field-by-field model comparison
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto p-6">
              <ModelRankingSummary 
                data={accuracyData}
                shownColumns={shownColumns}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={onCloseResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reset All Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>All ground truth data</strong> (hours of manual work)</li>
                <li><strong>All prompt versions and history</strong></li>
                <li><strong>All configured templates</strong></li>
                <li><strong>All comparison results</strong></li>
              </ul>
              <p className="mt-3 text-destructive font-medium">
                This action cannot be undone. Are you absolutely sure?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ModalContainer; 