
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { BoxTemplate } from '@/lib/types';
import { PlusCircle, Terminal, Trash2 } from 'lucide-react';
import NewTemplateDialog from '@/components/new-template-dialog';
import { addConfiguredTemplates, getConfiguredTemplates, removeConfiguredTemplate, toggleTemplateFieldActive } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export default function TemplatesPage() {
  const [configuredTemplates, setConfiguredTemplates] = useState<BoxTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<BoxTemplate | null>(null);

  useEffect(() => {
    setConfiguredTemplates(getConfiguredTemplates());
    setIsLoading(false);
  }, []);

  const handleAddTemplates = (newTemplates: BoxTemplate[]) => {
    addConfiguredTemplates(newTemplates);
    setConfiguredTemplates(getConfiguredTemplates());
  };

  const handleRemoveTemplate = (templateId: string) => {
    const template = configuredTemplates.find(t => t.id === templateId);
    if (template) {
      setTemplateToDelete(template);
    }
  };

  const confirmDeleteTemplate = () => {
    if (templateToDelete) {
      removeConfiguredTemplate(templateToDelete.id);
      setConfiguredTemplates(getConfiguredTemplates());
      setTemplateToDelete(null);
    }
  };

  const cancelDeleteTemplate = () => {
    setTemplateToDelete(null);
  };
  
  const handleToggleField = (templateId: string, fieldId: string) => {
    toggleTemplateFieldActive(templateId, fieldId);
    setConfiguredTemplates(getConfiguredTemplates());
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <TableBody>
          {[...Array(3)].map((_, i) => (
            <TableRow key={i}>
              <TableCell className="w-[250px]">
                <Skeleton className="h-5 w-32" />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </TableCell>
               <TableCell className="w-[80px] text-right">
                <Skeleton className="h-10 w-10 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      );
    }

    if (error) {
        return (
            <TableBody>
                <TableRow>
                    <TableCell colSpan={3}>
                        <Alert variant="destructive">
                             <Terminal className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </TableCell>
                </TableRow>
            </TableBody>
        )
    }

    if (configuredTemplates.length === 0) {
        return (
             <TableBody>
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No templates configured. Click "New Template" to get started.
                    </TableCell>
                </TableRow>
            </TableBody>
        )
    }

    return (
      <TableBody>
        {configuredTemplates.map(template => (
          <TableRow key={template.id}>
            <TableCell className="w-[250px] align-top font-medium">{template.displayName}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                {template.fields.map(field => (
                  <button key={field.id} onClick={() => handleToggleField(template.id, field.id)} className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                    <Badge
                      variant={field.isActive ? 'default' : 'secondary'}
                      className={cn(
                        'cursor-pointer font-normal transition-all',
                         field.isActive ? 'hover:bg-primary/80' : 'hover:bg-secondary/80'
                      )}
                    >
                      {field.displayName}
                    </Badge>
                  </button>
                ))}
              </div>
            </TableCell>
             <TableCell className="w-[80px] text-right">
                <Button variant="ghost" size="icon" onClick={() => handleRemoveTemplate(template.id)}>
                    <Trash2 className="h-4 w-4 text-foreground" />
                    <span className="sr-only">Remove {template.displayName}</span>
                </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    );
  };


  return (
    <>
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Templates
          </h1>
          <p className="text-muted-foreground">Manage your metadata templates.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Template
              </Button>
              <CardDescription>
                Click on a metadata field to activate or deactivate it for extraction.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Template Name</TableHead>
                    <TableHead>Metadata Fields</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                {renderContent()}
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <NewTemplateDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onAddTemplates={handleAddTemplates}
        existingTemplates={configuredTemplates}
      />
      
      <AlertDialog open={!!templateToDelete} onOpenChange={cancelDeleteTemplate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.displayName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteTemplate}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
