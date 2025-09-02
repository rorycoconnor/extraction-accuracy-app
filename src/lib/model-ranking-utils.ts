import type { AccuracyData } from './types';

// Constants for better maintainability
export const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 0.9,
  GOOD: 0.7,
  POOR: 0.0
} as const;

export const FLOATING_POINT_PRECISION = 0.001;

export interface ModelSummary {
  modelName: string;
  overallF1: number;
  overallAccuracy: number;
  overallPrecision: number;
  overallRecall: number;
  fieldsWon: number;
  totalFields: number;
  rank: number;
  fieldPerformance: Array<{
    fieldName: string;
    fieldKey: string;
    f1: number;
    accuracy: number;
    precision: number;
    recall: number;
    isWinner: boolean;
    isSharedVictory?: boolean;
  }>;
}

/**
 * Calculates initial model summaries without winner determination
 */
export function calculateModelSummaries(
  visibleModels: string[],
  fields: AccuracyData['fields'],
  averages: AccuracyData['averages']
): ModelSummary[] {
  return visibleModels.map(modelName => {
    const fieldPerformance = fields.map(field => {
      const fieldAvg = averages[field.key]?.[modelName] || { accuracy: 0, precision: 0, recall: 0, f1: 0 };
      return {
        fieldName: field.name,
        fieldKey: field.key,
        f1: fieldAvg.f1,
        accuracy: fieldAvg.accuracy,
        precision: fieldAvg.precision,
        recall: fieldAvg.recall,
        isWinner: false,
        isSharedVictory: false
      };
    });
    
    // Calculate overall metrics (macro averaging - average across all fields)
    // Include ALL fields in the average, even those with 0% scores
    const overallF1 = fieldPerformance.length > 0 
      ? fieldPerformance.reduce((sum, fp) => sum + fp.f1, 0) / fieldPerformance.length 
      : 0;
    const overallAccuracy = fieldPerformance.length > 0 
      ? fieldPerformance.reduce((sum, fp) => sum + fp.accuracy, 0) / fieldPerformance.length 
      : 0;
    const overallPrecision = fieldPerformance.length > 0 
      ? fieldPerformance.reduce((sum, fp) => sum + fp.precision, 0) / fieldPerformance.length 
      : 0;
    const overallRecall = fieldPerformance.length > 0 
      ? fieldPerformance.reduce((sum, fp) => sum + fp.recall, 0) / fieldPerformance.length 
      : 0;
    
    // VALIDATION: Check if macro-averaged metrics satisfy F1 formula
    if (overallPrecision > 0 && overallRecall > 0) {
      const expectedF1 = (2 * overallPrecision * overallRecall) / (overallPrecision + overallRecall);
      const f1Diff = Math.abs(overallF1 - expectedF1);
      
      if (f1Diff > 0.01) { // 1% tolerance for rounding
        console.warn(`🚨 ${modelName} - Macro F1 inconsistency!`);
        console.warn(`   Macro F1: ${(overallF1 * 100).toFixed(1)}%`);
        console.warn(`   Macro Precision: ${(overallPrecision * 100).toFixed(1)}%`);
        console.warn(`   Macro Recall: ${(overallRecall * 100).toFixed(1)}%`);
        console.warn(`   Expected F1 from formula: ${(expectedF1 * 100).toFixed(1)}%`);
        console.warn(`   Difference: ${(f1Diff * 100).toFixed(1)}%`);
        
        // Log field-level details for debugging
        console.warn(`   Field details:`);
        fieldPerformance.forEach(fp => {
          console.warn(`     ${fp.fieldName}: F1=${(fp.f1*100).toFixed(1)}%, P=${(fp.precision*100).toFixed(1)}%, R=${(fp.recall*100).toFixed(1)}%`);
        });
      } else {
        console.log(`✅ ${modelName} - Macro averaging validation passed: F1=${(overallF1*100).toFixed(1)}%, P=${(overallPrecision*100).toFixed(1)}%, R=${(overallRecall*100).toFixed(1)}%`);
      }
    }
    
    // VALIDATION: Check for impossible Precision=100% with field failures
    if (overallPrecision >= 0.999) {
      const failedFields = fieldPerformance.filter(fp => fp.f1 < 0.999);
      if (failedFields.length > 0) {
        console.warn(`🚨 ${modelName} - Precision=100% but ${failedFields.length} fields have F1 < 100%:`);
        failedFields.forEach(fp => {
          console.warn(`     ${fp.fieldName}: F1=${(fp.f1*100).toFixed(1)}%, P=${(fp.precision*100).toFixed(1)}%, R=${(fp.recall*100).toFixed(1)}%`);
        });
      }
    }
    
    return {
      modelName,
      overallF1,
      overallAccuracy,
      overallPrecision,
      overallRecall,
      fieldsWon: 0,
      totalFields: fields.length,
      rank: 0,
      fieldPerformance
    };
  });
}

/**
 * Determines field winners using tie-breaking hierarchy:
 * 1. Accuracy (primary)
 * 2. Precision (first tie-breaker)
 * 3. Recall (second tie-breaker)
 */
export function determineFieldWinners(
  modelSummaries: ModelSummary[],
  fields: AccuracyData['fields']
): void {
  
  fields.forEach((field, fieldIndex) => {
    // Find the best accuracy for this field
    const performances = modelSummaries.map(summary => summary.fieldPerformance[fieldIndex]);
    const bestAccuracy = Math.max(...performances.map(p => p.accuracy));
    
    // Find all models that achieved the best accuracy
    let winnerIndices = performances
      .map((perf, index) => ({ perf, index }))
      .filter(({ perf }) => Math.abs(perf.accuracy - bestAccuracy) <= FLOATING_POINT_PRECISION)
      .map(({ index }) => index);
    
    // Apply tie-breaking if multiple winners
    if (winnerIndices.length > 1) {
      winnerIndices = applyTieBreaking(modelSummaries, fieldIndex, winnerIndices);
    }
    
    // Mark winners
    winnerIndices.forEach(index => {
      modelSummaries[index].fieldPerformance[fieldIndex].isWinner = true;
      modelSummaries[index].fieldsWon += winnerIndices.length > 1 ? (1 / winnerIndices.length) : 1;
      
      // Mark shared victories
      if (winnerIndices.length > 1) {
        modelSummaries[index].fieldPerformance[fieldIndex].isSharedVictory = true;
      }
    });
  });
}

/**
 * Applies tie-breaking logic using precision and recall
 */
function applyTieBreaking(
  modelSummaries: ModelSummary[],
  fieldIndex: number,
  winnerIndices: number[]
): number[] {
  // Try precision as first tie-breaker
  let bestPrecision = -1;
  let precisionWinners: number[] = [];
  
  winnerIndices.forEach(modelIndex => {
    const precision = modelSummaries[modelIndex].fieldPerformance[fieldIndex].precision;
    if (precision > bestPrecision) {
      bestPrecision = precision;
    }
  });
  
  winnerIndices.forEach(modelIndex => {
    const precision = modelSummaries[modelIndex].fieldPerformance[fieldIndex].precision;
    if (Math.abs(precision - bestPrecision) < FLOATING_POINT_PRECISION) {
      precisionWinners.push(modelIndex);
    }
  });
  
  // If still tied, use recall as second tie-breaker
  if (precisionWinners.length > 1) {
    let bestRecall = -1;
    let recallWinners: number[] = [];
    
    precisionWinners.forEach(modelIndex => {
      const recall = modelSummaries[modelIndex].fieldPerformance[fieldIndex].recall;
      if (recall > bestRecall) {
        bestRecall = recall;
      }
    });
    
    precisionWinners.forEach(modelIndex => {
      const recall = modelSummaries[modelIndex].fieldPerformance[fieldIndex].recall;
      if (Math.abs(recall - bestRecall) < FLOATING_POINT_PRECISION) {
        recallWinners.push(modelIndex);
      }
    });
    
    return recallWinners;
  }
  
  return precisionWinners;
}

/**
 * Assigns ranks based on the specification tie-breaking hierarchy:
 * 1. Overall Accuracy Score
 * 2. Overall Precision  
 * 3. Overall Recall
 * 4. Total Field Wins
 * 5. Alphabetical order (final fallback)
 */
export function assignRanks(modelSummaries: ModelSummary[]): void {
  modelSummaries.sort((a, b) => {
    // 1. Overall Accuracy Score (primary)
    if (Math.abs(a.overallAccuracy - b.overallAccuracy) > FLOATING_POINT_PRECISION) {
      return b.overallAccuracy - a.overallAccuracy;
    }
    
    // 2. Overall Precision (first tie-breaker)
    if (Math.abs(a.overallPrecision - b.overallPrecision) > FLOATING_POINT_PRECISION) {
      return b.overallPrecision - a.overallPrecision;
    }
    
    // 3. Overall Recall (second tie-breaker)
    if (Math.abs(a.overallRecall - b.overallRecall) > FLOATING_POINT_PRECISION) {
      return b.overallRecall - a.overallRecall;
    }
    
    // 4. Total Field Wins (third tie-breaker)
    if (Math.abs(a.fieldsWon - b.fieldsWon) > FLOATING_POINT_PRECISION) {
      return b.fieldsWon - a.fieldsWon;
    }
    
    // 5. Alphabetical order (final fallback)
    return a.modelName.localeCompare(b.modelName);
  });
  
  // Assign ranks, handling ties properly
  let currentRank = 1;
  modelSummaries.forEach((summary, index) => {
    if (index > 0) {
      const prev = modelSummaries[index - 1];
      
      // If this model has different performance than previous, increment rank
      if (Math.abs(summary.overallAccuracy - prev.overallAccuracy) > FLOATING_POINT_PRECISION ||
          Math.abs(summary.overallPrecision - prev.overallPrecision) > FLOATING_POINT_PRECISION ||
          Math.abs(summary.overallRecall - prev.overallRecall) > FLOATING_POINT_PRECISION ||
          Math.abs(summary.fieldsWon - prev.fieldsWon) > FLOATING_POINT_PRECISION) {
        currentRank = index + 1;
      }
      // If performance is identical, keep the same rank (tie)
    }
    
    summary.rank = currentRank;
  });
} 