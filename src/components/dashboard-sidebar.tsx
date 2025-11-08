'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  FileText,
  ExternalLink,
  AlertTriangle,
  Database,
  Settings2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { BoxTemplate } from '@/lib/types';
import { ThemeCard } from './theme-card';

interface DashboardSidebarProps {
  isAuthenticated: boolean;
  authMethod?: string;
  metadataTemplates: BoxTemplate[];
  groundTruthStats?: {
    totalFiles: number;
    filesWithGroundTruth: number;
    completionPercentage: number;
  };
  isLoading?: boolean;
  onNavigateToSettings?: () => void;
}

export function DashboardSidebar({
  isAuthenticated,
  authMethod,
  metadataTemplates,
  groundTruthStats,
  isLoading = false,
  onNavigateToSettings,
}: DashboardSidebarProps) {
  const { toast } = useToast();
  
  return (
    <div className="flex-shrink-0 space-y-4 min-w-[320px]">
      {/* Authentication Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Authentication</CardTitle>
            {isAuthenticated && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-6 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Connected
                </Badge>
                {authMethod && (
                  <span className="text-xs text-muted-foreground">({authMethod})</span>
                )}
              </div>
              {!authMethod && (
                <p className="text-xs text-muted-foreground">
                  Box connection active
                </p>
              )}
            </div>
          ) : (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm text-red-800">
                Not authenticated.
                <Link href="/settings">
                  <Button variant="link" size="sm" className="h-auto p-0 text-red-700 font-semibold block mt-1">
                    Go to Settings →
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Theme / Appearance Card */}
      <ThemeCard />

      {/* Metadata Templates Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Metadata Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : metadataTemplates.length === 0 ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm text-red-800">
                <strong>No templates configured.</strong> Add a template to get started with document processing.
                <Link href="/templates">
                  <Button variant="link" size="sm" className="h-auto p-0 text-red-700 font-semibold block mt-1">
                    Add Template →
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {metadataTemplates.slice(0, 5).map((template) => {
                const activeFieldCount = template.fields.filter(f => f.isActive).length;
                return (
                  <Link key={template.id} href="/templates">
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors group cursor-pointer">
                      <p className="text-sm font-medium truncate group-hover:text-primary flex-1">
                        {template.displayName}
                      </p>
                      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                        ({activeFieldCount} active field{activeFieldCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </Link>
                );
              })}
              {metadataTemplates.length > 5 && (
                <Link href="/templates">
                  <p className="text-xs text-center text-muted-foreground pt-2 hover:text-primary cursor-pointer transition-colors">
                    +{metadataTemplates.length - 5} more
                  </p>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ground Truth Progress Card */}
      {groundTruthStats && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Ground Truth
              </CardTitle>
              <Link href="/ground-truth">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Manage
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Files with data:</span>
                <span className="text-sm font-semibold">
                  {groundTruthStats.filesWithGroundTruth} / {groundTruthStats.totalFiles}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${groundTruthStats.completionPercentage}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {groundTruthStats.completionPercentage}% complete
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compare Types Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Compare Types
            </CardTitle>
            <Link href="/compare-types">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Configure
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Set comparison strategies for each field to control how extracted values are validated.
          </p>
        </CardContent>
      </Card>

      {/* Getting Started Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Documentation is located on Box Corporate EID.
          </p>
          <Button 
            className="w-full" 
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText('https://cloud.box.com/s/8yxlyqj2ud16k8q9ortql7fw4chsl06y');
              toast({
                description: "📋 Link copied to clipboard",
                duration: 2000,
              });
            }}
          >
            Copy Link
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

