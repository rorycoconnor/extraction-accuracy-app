import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Crown, Star, Target, LayoutGrid, Columns } from 'lucide-react';
import { cn, formatModelName } from '@/lib/utils';
import type { AccuracyData, FieldAverage } from '@/lib/types';
import { 
  PERFORMANCE_THRESHOLDS,
  calculateModelSummaries,
  determineFieldWinners,
  assignRanks,
  type ModelSummary
} from '@/lib/model-ranking-utils';

/**
 * Props for the ModelRankingSummary component
 */
interface ModelRankingSummaryProps {
  /** Accuracy data containing fields and model performance averages */
  data: AccuracyData;
  /** Record of which model columns are currently visible */
  shownColumns: Record<string, boolean>;
}

type ViewMode = 'stack' | 'side-by-side';

/**
 * ModelRankingSummary displays a comprehensive performance analysis of AI models
 * 
 * Features:
 * - Ranks models by overall Accuracy with sophisticated tie-breaking
 * - Shows detailed metrics (Accuracy, F1, Precision, Recall) for each model
 * - Displays field-by-field performance with winner indicators
 * - Provides actionable insights and recommendations
 * - Supports both stack and side-by-side view modes
 * - Fully accessible with ARIA labels and semantic HTML
 * 
 * @param props - Component props
 * @returns JSX element containing the model performance summary
 */
function ModelRankingSummary({ data, shownColumns }: ModelRankingSummaryProps) {
  // View mode state (default to stack view)
  const [viewMode, setViewMode] = useState<ViewMode>('stack');

  // Early validation to prevent runtime errors
  if (!data || !data.fields || !data.averages) {
    return null;
  }
  
  const { fields, averages } = data;
  
  // Additional validation
  if (!fields || fields.length === 0) {
    return null;
  }
  
  // Get visible models (excluding Ground Truth)
  const visibleModels = Object.keys(shownColumns).filter(
    model => shownColumns[model] && model !== 'Ground Truth'
  );
  
  if (visibleModels.length === 0) {
    return null;
  }
  
  // Calculate model summaries with memoization for performance
  const modelSummaries: ModelSummary[] = useMemo(() => {
    // Calculate initial summaries
    const summaries = calculateModelSummaries(visibleModels, fields, averages);
    
    // Determine winners and assign ranks
    determineFieldWinners(summaries, fields);
    assignRanks(summaries);
    
    return summaries;
  }, [visibleModels, fields, averages]);
  
  /**
   * Returns the appropriate icon for a model's rank
   * @param rank - The model's rank (1-based)
   * @returns JSX element representing the rank
   */
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
      case 2: return <Medal className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
      case 3: return <Award className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
      default: return <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400">{rank}</div>;
    }
  };
  
  /**
   * Returns the appropriate color classes for a model's rank
   * @param rank - The model's rank (1-based)
   * @returns CSS class string for styling the rank
   */
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200';
      case 2: return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-300';
      case 3: return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-300';
      default: return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/20 dark:text-gray-400';
    }
  };

  /**
   * Renders the stack view (original layout)
   */
  const renderStackView = () => (
    <div className="space-y-4" role="list" aria-label="Model performance rankings">
      {modelSummaries.map((summary, index) => (
        <div
          key={summary.modelName}
          role="listitem"
          className={cn(
            'rounded-lg border p-4 transition-all',
            getRankColor(summary.rank)
          )}
          aria-label={`${formatModelName(summary.modelName)} ranked ${summary.rank} with ${(summary.overallAccuracy * 100).toFixed(1)}% Accuracy`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {getRankIcon(summary.rank)}
              <div>
                <h3 className="font-semibold text-lg">
                  {formatModelName(summary.modelName)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Rank #{summary.rank} • Won {summary.fieldsWon % 1 === 0 ? summary.fieldsWon : summary.fieldsWon.toFixed(1)} of {summary.totalFields} fields
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-lg font-bold px-3 py-1',
                summary.overallAccuracy >= PERFORMANCE_THRESHOLDS.EXCELLENT
                  ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                  : summary.overallAccuracy >= PERFORMANCE_THRESHOLDS.GOOD
                  ? 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
                  : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
              )}
              aria-label={`Accuracy: ${(summary.overallAccuracy * 100).toFixed(1)} percent`}
            >
              {(summary.overallAccuracy * 100).toFixed(1)}% Accuracy
            </Badge>
          </div>
          
          {/* Overall Metrics */}
          <div className="grid grid-cols-4 gap-4 mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{(summary.overallAccuracy * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{(summary.overallF1 * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Accuracy Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{(summary.overallPrecision * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Precision</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{(summary.overallRecall * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Recall</div>
            </div>
          </div>
          
          {/* Field Performance */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Field Performance:</h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {summary.fieldPerformance.map((field) => (
                <div
                  key={field.fieldKey}
                  className={cn(
                    'flex items-center justify-between p-2 rounded text-xs',
                    field.isWinner
                      ? field.isSharedVictory
                        ? 'bg-blue-100 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                        : 'bg-green-100 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                      : 'bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span className="font-medium truncate" title={field.fieldName}>
                      {field.fieldName}
                    </span>
                  </div>
                  <span className="font-bold">
                    {(field.accuracy * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      
      {/* Summary insights */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/20 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Key Insights
        </h4>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• <strong>{formatModelName(modelSummaries[0].modelName)}</strong> is the top performer with {(modelSummaries[0].overallAccuracy * 100).toFixed(1)}% average Accuracy</li>
          <li>• Best model won {modelSummaries[0].fieldsWon % 1 === 0 ? modelSummaries[0].fieldsWon : modelSummaries[0].fieldsWon.toFixed(1)} out of {modelSummaries[0].totalFields} metadata fields</li>
          {modelSummaries.length > 1 && (
            <li>• Performance gap between best and worst model: {((modelSummaries[0].overallAccuracy - modelSummaries[modelSummaries.length - 1].overallAccuracy) * 100).toFixed(1)} percentage points</li>
          )}
          {(() => {
            const sharedVictories = modelSummaries.reduce((total, model) => {
              return total + model.fieldPerformance.filter(field => field.isSharedVictory).length;
            }, 0);
            return sharedVictories > 0 ? (
              <li>• {sharedVictories} field{sharedVictories > 1 ? 's' : ''} had tied performance (shared victories)</li>
            ) : null;
          })()}
          <li>• Consider using the top-performing model for production workloads</li>
        </ul>
      </div>
    </div>
  );

  /**
   * Renders the side-by-side view (new horizontal layout)
   */
  const renderSideBySideView = () => (
    <div className="w-full">
      {/* Horizontal scroll container */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: `${modelSummaries.length * 416}px` }}>
          {modelSummaries.map((summary) => (
            <div
              key={summary.modelName}
              className={cn(
                'flex-shrink-0 w-[416px] rounded-lg border p-4 transition-all',
                getRankColor(summary.rank)
              )}
              aria-label={`${formatModelName(summary.modelName)} ranked ${summary.rank} with ${(summary.overallAccuracy * 100).toFixed(1)}% Accuracy`}
            >
              {/* Header with rank and name */}
              <div className="mb-3">
                <div className="mb-2">
                  <h3 className="font-semibold text-lg">
                    {formatModelName(summary.modelName)}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Rank #{summary.rank}
                  </p>
                </div>
                {/* Accuracy Score centered and 15% larger */}
                <div className="flex justify-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-base font-bold px-2.5 py-1.5',
                      summary.overallAccuracy >= PERFORMANCE_THRESHOLDS.EXCELLENT
                        ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                        : summary.overallAccuracy >= PERFORMANCE_THRESHOLDS.GOOD
                        ? 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400'
                        : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                    )}
                  >
                    {(summary.overallAccuracy * 100).toFixed(1)}% Accuracy
                  </Badge>
                </div>
              </div>
              
              {/* Field Performance */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Field Performance:</h4>
                <div className="space-y-1">
                  {summary.fieldPerformance.map((field) => (
                    <div
                      key={field.fieldKey}
                      className={cn(
                        'flex items-center justify-between p-2 rounded text-xs',
                        field.isWinner
                          ? field.isSharedVictory
                            ? 'bg-blue-100 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                            : 'bg-green-100 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                          : 'bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                      )}
                    >
                      <span className="font-medium truncate" title={field.fieldName}>
                        {field.fieldName}
                      </span>
                      <span className="font-bold">
                        {(field.accuracy * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Summary insights */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/20 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Key Insights
        </h4>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• <strong>{formatModelName(modelSummaries[0].modelName)}</strong> is the top performer with {(modelSummaries[0].overallAccuracy * 100).toFixed(1)}% average Accuracy</li>
          <li>• Best model won {modelSummaries[0].fieldsWon % 1 === 0 ? modelSummaries[0].fieldsWon : modelSummaries[0].fieldsWon.toFixed(1)} out of {modelSummaries[0].totalFields} metadata fields</li>
          {modelSummaries.length > 1 && (
            <li>• Performance gap between best and worst model: {((modelSummaries[0].overallAccuracy - modelSummaries[modelSummaries.length - 1].overallAccuracy) * 100).toFixed(1)} percentage points</li>
          )}
          <li>• Consider using the top-performing model for production workloads</li>
        </ul>
      </div>
    </div>
  );
  
  return (
    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          {/* View Toggle Buttons */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <Button
              variant={viewMode === 'stack' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('stack')}
              className={cn(
                'flex items-center gap-2 text-xs px-3 py-1.5',
                viewMode === 'stack' 
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <LayoutGrid className="h-3 w-3" />
              Stack
            </Button>
            <Button
              variant={viewMode === 'side-by-side' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('side-by-side')}
              className={cn(
                'flex items-center gap-2 text-xs px-3 py-1.5',
                viewMode === 'side-by-side' 
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <Columns className="h-3 w-3" />
              Side by side
            </Button>
          </div>

          {/* Field Performance Legend */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">Field Performance:</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded"></div>
              <span>Winner</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded"></div>
              <span>Shared Victory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded"></div>
              <span>Non-winner</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'stack' ? renderStackView() : renderSideBySideView()}
      </CardContent>
    </Card>
  );
}

// Export with React.memo for performance optimization  
const MemoizedModelRankingSummary = React.memo(ModelRankingSummary);
export default MemoizedModelRankingSummary;