'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { AccuracyData } from '@/lib/types';
import type { OptimizerDocumentTheory, OptimizerFieldSummary } from '@/lib/optimizer-types';
import { cn } from '@/lib/utils';

interface OptimizerSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  accuracyData: AccuracyData | null;
  sampledDocs: OptimizerDocumentTheory[];
  fieldSummaries: OptimizerFieldSummary[];
  onOpenPromptStudio: (fieldKey: string) => void;
}

const statusCopy: Record<'success' | 'error' | 'skipped', { label: string; className: string }> = {
  success: { label: 'Updated', className: 'bg-green-100 text-green-900' },
  error: { label: 'Needs attention', className: 'bg-red-100 text-red-900' },
  skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-600' },
};

export const OptimizerSummaryModal: React.FC<OptimizerSummaryModalProps> = ({
  isOpen,
  onClose,
  accuracyData,
  sampledDocs,
  fieldSummaries,
  onOpenPromptStudio,
}) => {
  const fieldMeta = React.useMemo(() => {
    const map = new Map<string, { name: string; prompt: string }>();
    accuracyData?.fields.forEach((field) => {
      map.set(field.key, { name: field.name, prompt: field.prompt });
    });
    return map;
  }, [accuracyData]);

  const runStats = React.useMemo(() => {
    const updated = fieldSummaries?.filter((summary) => summary.newPrompt).length ?? 0;
    const failed = fieldSummaries?.filter((summary) => summary.error).length ?? 0;
    return { updated, failed };
  }, [fieldSummaries]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Optimizer Run Summary</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Fields optimized" value={runStats.updated} />
            <StatCard label="Documents analyzed" value={sampledDocs?.length ?? 0} />
            <StatCard label="Failures" value={runStats.failed} variant={runStats.failed ? 'error' : 'success'} />
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Document Theories</h3>
            {!sampledDocs || sampledDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No document theories were captured.</p>
            ) : (
              <Accordion type="single" collapsible>
                {sampledDocs.map((doc) => (
                  <AccordionItem key={doc.docId} value={doc.docId}>
                    <AccordionTrigger>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{doc.docName}</span>
                        {doc.error && <span className="text-xs text-red-600">{doc.error}</span>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {Object.entries(doc.theories).map(([fieldKey, theory]) => (
                          <li key={`${doc.docId}-${fieldKey}`} className="text-sm">
                            <span className="font-semibold">{fieldMeta.get(fieldKey)?.name ?? fieldKey}:</span> {theory}
                          </li>
                        ))}
                        {Object.keys(doc.theories).length === 0 && (
                          <li className="text-sm text-muted-foreground">No theories returned for this document.</li>
                        )}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Field Updates</h3>
            <div className="space-y-4">
              {fieldSummaries?.map((summary) => {
                const meta = fieldMeta.get(summary.fieldKey);
                const status = summary.error ? 'error' : summary.newPrompt ? 'success' : 'skipped';
                const badgeConfig = statusCopy[status];

                return (
                  <div key={summary.fieldKey} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold flex-1">{meta?.name ?? summary.fieldKey}</h4>
                      <Badge className={cn('text-xs', badgeConfig.className)}>{badgeConfig.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Accuracy before run: {(summary.accuracyBefore * 100 || 0).toFixed(1)}%
                    </div>
                    {summary.newPrompt ? (
                      <div className="grid gap-2">
                        <div>
                          <p className="text-sm font-medium">New prompt</p>
                          <pre className="bg-muted p-3 rounded max-h-48 overflow-y-auto whitespace-pre-wrap text-xs">{summary.newPrompt}</pre>
                        </div>
                        {summary.promptTheory && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Why:</span> {summary.promptTheory}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {summary.sampledDocIds?.map((docId) => {
                            const docName = sampledDocs?.find((doc) => doc.docId === docId)?.docName ?? docId;
                            return (
                              <Badge key={`${summary.fieldKey}-${docId}`} variant="secondary">
                                {docName}
                              </Badge>
                            );
                          })}
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => onOpenPromptStudio(summary.fieldKey)}>
                          Open in Prompt Studio
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{summary.error ?? 'Field skipped (already optimal).'}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  variant?: 'default' | 'error' | 'success';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, variant = 'default' }) => {
  const variantClass =
    variant === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : variant === 'success'
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-muted border-transparent text-foreground';

  return (
    <div className={cn('rounded-lg border p-4 flex flex-col gap-1', variantClass)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
};

export default OptimizerSummaryModal;
