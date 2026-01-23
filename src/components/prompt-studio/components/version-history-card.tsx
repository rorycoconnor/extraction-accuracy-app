'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Star, Play, Copy, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { getGenerationMethodBadge } from '../utils';
import type { VersionHistoryCardProps } from '../types';

export const VersionHistoryCard: React.FC<VersionHistoryCardProps> = ({
  version,
  versionNumber,
  isLatestVersion,
  isCurrentVersion,
  field,
  totalVersions,
  onToggleFavorite,
  onDeleteVersion,
  onUseVersion,
  onCopyToClipboard,
}) => {
  // Calculate performance comparison based on average F1 across all models
  const versionsWithMetrics = field.promptHistory?.filter(v => v.metrics) || [];
  let performanceIndicator = null;
  
  if (version.metrics && versionsWithMetrics.length > 1) {
    const modelMetrics = version.metrics.modelMetrics;
    const currentF1 = modelMetrics ? 
      Object.values(modelMetrics).reduce((sum, m) => sum + m.f1, 0) / Object.values(modelMetrics).length : 0;
    
    const otherVersions = versionsWithMetrics.filter(v => v.id !== version.id);
    const otherF1s = otherVersions.map(v => {
      const metrics = v.metrics!.modelMetrics;
      return metrics ? Object.values(metrics).reduce((sum, m) => sum + m.f1, 0) / Object.values(metrics).length : 0;
    });
    const avgOtherF1 = otherF1s.reduce((sum, f1) => sum + f1, 0) / otherF1s.length;
    
    if (currentF1 > avgOtherF1 + 0.05) { // 5% improvement threshold
      performanceIndicator = <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (currentF1 < avgOtherF1 - 0.05) { // 5% degradation threshold
      performanceIndicator = <TrendingDown className="h-4 w-4 text-red-600" />;
    }
  }

  return (
    <div className={`space-y-3 ${isLatestVersion ? 'bg-muted/20 p-4 rounded-lg' : 'p-4'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-base font-medium flex items-center gap-2 flex-wrap">
            Version {versionNumber}
            {isLatestVersion && <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">Latest</span>}
            {isCurrentVersion && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">Same as Active</span>}
            {getGenerationMethodBadge(version.generationMethod)}
          </h4>
          {performanceIndicator}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => onToggleFavorite?.(version.id)}
            disabled={!onToggleFavorite}
          >
            <Star className={`h-4 w-4 ${version.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteVersion(version.id, versionNumber)}
            disabled={totalVersions <= 1}
            title={totalVersions <= 1 ? "Cannot delete the last remaining prompt version" : "Delete this prompt version"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onUseVersion(version)}
            disabled={isCurrentVersion}
          >
            <Play className="mr-2 h-4 w-4" />
            {isCurrentVersion ? 'In Use' : 'Use this Version'}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Saved on: {format(new Date(version.savedAt), 'P p')}</p>
      <div className="relative rounded-md border bg-muted/50 p-4">
        {version.prompt && version.prompt.trim() ? (
          <>
            <p className="text-sm whitespace-pre-wrap break-words pr-10">{version.prompt}</p>
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-3 right-3 h-8 w-8"
              onClick={() => onCopyToClipboard(version.prompt)}
              title="Copy prompt"
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">No prompt</p>
        )}
      </div>
      {version.metrics ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Performance Metrics</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              Updated {format(new Date(version.metrics.lastRunAt), 'MMM d, h:mm a')}
            </span>
          </div>
          
          {/* Top 2 models performance */}
          {version.metrics.modelMetrics && (() => {
            // Calculate average Accuracy for each model to determine ranking
            const modelEntries = Object.entries(version.metrics.modelMetrics);
            if (modelEntries.length === 0) return null;

            // Sort models by Accuracy (best first)
            const sortedModels = modelEntries
              .map(([modelName, metrics]) => ({
                name: modelName,
                metrics,
                displayName: modelName
                  .replace('openai-', '')
                  .replace('anthropic-', '')
                  .replace('google-', '')
                  .replace('GOOGLE_', '')
                  .replace('ENHANCED_', '')
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase())
              }))
              .sort((a, b) => b.metrics.accuracy - a.metrics.accuracy);

            // Show top 2 models
            const topModels = sortedModels.slice(0, 2);

            return (
              <div className="space-y-2">
                {topModels.map((model) => (
                  <div key={model.name} className="flex items-center justify-between py-2 px-3 border rounded-lg bg-card">
                    <span className="text-sm font-medium text-foreground uppercase tracking-wide">
                      {model.displayName}
                    </span>
                    <div className={`font-semibold text-base ${model.metrics.accuracy >= 0.9 ? 'text-green-600 dark:text-green-400' : model.metrics.accuracy >= 0.7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(model.metrics.accuracy * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">
          No performance data available yet. Run a comparison to see metrics.
        </div>
      )}
    </div>
  );
};
