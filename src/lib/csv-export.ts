import type { AccuracyData } from '@/lib/types';
import { formatModelName } from '@/lib/utils';
import { calculateModelSummaries, assignRanks } from '@/lib/model-ranking-utils';

export interface ExportSummaryData {
  templateName: string;
  numberOfFilesProcessed: number;
  hasGroundTruthData: boolean;
  totalFields: number;
  modelsCompared: string[];
}

/**
 * Calculate summary statistics from accuracy data
 */
function calculateSummaryStats(accuracyData: AccuracyData, shownColumns: Record<string, boolean>): ExportSummaryData {
  const hasGroundTruthData = accuracyData.results.some(result => 
    Object.values(result.fields).some(field => 
      field['Ground Truth'] && field['Ground Truth'].trim() !== ''
    )
  );

  // Only include models that are currently visible/selected
  const allModels = accuracyData.results.length > 0 && accuracyData.results[0].fields[accuracyData.fields[0]?.key]
    ? Object.keys(accuracyData.results[0].fields[accuracyData.fields[0].key])
        .filter(key => key !== 'Ground Truth')
    : [];

  // Filter models based on what's currently shown in the UI
  const visibleModels = allModels.filter(model => shownColumns[model] !== false);

  // Sort models by performance (Accuracy) if we have averages data
  let modelsCompared = visibleModels;
  if (accuracyData.averages && accuracyData.fields && hasGroundTruthData) {
    try {
      // Calculate model summaries and rank them
      const modelSummaries = calculateModelSummaries(visibleModels, accuracyData.fields, accuracyData.averages);
      assignRanks(modelSummaries);
      
      // Extract the model names in order of performance (best first)
      modelsCompared = modelSummaries.map(summary => summary.modelName);
      
      console.log('✅ CSV Export: Models sorted by Accuracy performance:', modelsCompared.map((model, index) => {
        const summary = modelSummaries.find(s => s.modelName === model);
        const accuracy = summary ? (summary.overallAccuracy * 100).toFixed(1) : 'N/A';
        return `${index + 1}. ${formatModelName(model)} (Accuracy: ${accuracy}%)`;
      }));
    } catch (error) {
      console.warn('Failed to sort models by performance, using alphabetical order:', error);
      modelsCompared = visibleModels.sort();
    }
  } else {
    // Fallback to alphabetical sorting if no performance data available
    modelsCompared = visibleModels.sort();
    console.log('ℹ️ CSV Export: Using alphabetical order (no performance data available)');
  }

  return {
    templateName: accuracyData.templateKey || 'Unknown Template',
    numberOfFilesProcessed: accuracyData.results.length,
    hasGroundTruthData,
    totalFields: accuracyData.fields.length,
    modelsCompared
  };
}

/**
 * Escape CSV values to handle commas, quotes, and line breaks
 */
function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

/**
 * Convert array of arrays to CSV string
 */
function arrayToCSV(data: any[][]): string {
  return data.map(row => 
    row.map(cell => escapeCSV(cell)).join(',')
  ).join('\n');
}

/**
 * Generate summary information rows for CSV
 */
function generateSummaryRows(
  summaryData: ExportSummaryData, 
  processingTime?: { start?: Date; end?: Date; durationMs?: number }
): any[][] {
  const summaryRows: any[][] = [
    ['Accuracy App - Comparison Results Export'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['SUMMARY INFORMATION'],
    ['Template Name', summaryData.templateName],
    ['Number of Files Processed', summaryData.numberOfFilesProcessed],
    ['Total Fields', summaryData.totalFields],
    ['Models Compared', summaryData.modelsCompared.length],
    ['Ground Truth Available', summaryData.hasGroundTruthData ? 'Yes' : 'No'],
    ['']
  ];

  // Add processing time information if available
  if (processingTime) {
    if (processingTime.start) {
      summaryRows.push(['Processing Started', processingTime.start.toLocaleString()]);
    }
    if (processingTime.end) {
      summaryRows.push(['Processing Completed', processingTime.end.toLocaleString()]);
    }
    if (processingTime.durationMs) {
      const durationSec = (processingTime.durationMs / 1000).toFixed(2);
      summaryRows.push(['Processing Time', `${durationSec} seconds`]);
    }
    summaryRows.push(['']);
  }

  // Add model list
  if (summaryData.modelsCompared.length > 0) {
    summaryRows.push(['MODELS COMPARED']);
    summaryData.modelsCompared.forEach((model, index) => {
      summaryRows.push([`${index + 1}. ${formatModelName(model)}`]);
    });
    summaryRows.push(['']);
  }

  return summaryRows;
}

/**
 * Generate field averages section (F1 scores only)
 */
function generateFieldAveragesRows(accuracyData: AccuracyData, summaryData: ExportSummaryData): any[][] {
  console.log('🔍 CSV Export: Generating Accuracy scores section...');
  console.log('  - Has ground truth data:', summaryData.hasGroundTruthData);
  console.log('  - Has averages data:', !!accuracyData.averages);
  console.log('  - Number of fields:', accuracyData.fields?.length || 0);
  console.log('  - Number of models:', summaryData.modelsCompared.length);
  console.log('  - Averages object keys:', accuracyData.averages ? Object.keys(accuracyData.averages) : 'none');

  if (!summaryData.hasGroundTruthData || !accuracyData.averages) {
    console.log('❌ CSV Export: Cannot generate Accuracy scores - missing ground truth or averages data');
    return [
      ['FIELD AVERAGES (Accuracy Scores)'],
      ['No ground truth data available - metrics cannot be calculated'],
      ['']
    ];
  }

  const rows: any[][] = [
    // Removed explicit section title row per request
  ];

  // Header row: Field, per-model Accuracy columns, then Prompt
  const headerRow = ['Field', ...summaryData.modelsCompared.map(model => formatModelName(model)), 'Prompt'];
  rows.push(headerRow);

  // Insert overall model accuracies row (matches UI badges)
  try {
    const modelSummaries = calculateModelSummaries(summaryData.modelsCompared, accuracyData.fields, accuracyData.averages);
    // No need to assign ranks; we only need overallAccuracy
    const overallRow: any[] = ['Overall Average (Accuracy)'];
    summaryData.modelsCompared.forEach(modelName => {
      const summary = modelSummaries.find(ms => ms.modelName === modelName);
      const acc = summary ? summary.overallAccuracy : NaN;
      overallRow.push(Number.isNaN(acc) ? 'N/A' : `${(acc * 100).toFixed(1)}%`);
    });
    // For the trailing column (Prompt), leave blank in this overall row
    overallRow.push('');
    rows.push(overallRow);
    rows.push(['']);
  } catch (e) {
    console.warn('⚠️ CSV Export: Failed to compute overall model accuracies for header row', e);
  }

  // Data rows for each field
  let fieldsWithData = 0;
  accuracyData.fields.forEach(field => {
    const fieldAverages = accuracyData.averages[field.key];
    if (fieldAverages) {
      fieldsWithData++;
    }
    const row = [
      field.name,
      ...summaryData.modelsCompared.map(model => {
        const avg = fieldAverages ? fieldAverages[model] : undefined;
        if (avg && typeof avg.accuracy === 'number') {
          return `${(avg.accuracy * 100).toFixed(1)}%`;
        } else {
          console.warn(`  - Missing Accuracy data for field "${field.key}", model "${model}":`, avg);
          return 'N/A';
        }
      }),
      field.prompt || '' // Add the prompt column
    ];
    rows.push(row);
  });

  console.log(`✅ CSV Export: Generated Accuracy scores for ${fieldsWithData}/${accuracyData.fields.length} fields`);
  
  rows.push(['']);
  return rows;
}

/**
 * Generate the main comparison table
 */
function generateComparisonTableRows(
  accuracyData: AccuracyData, 
  summaryData: ExportSummaryData,
  shownColumns: Record<string, boolean>
): any[][] {
  const rows: any[][] = [
    ['DETAILED COMPARISON RESULTS'],
    ['']
  ];

  if (accuracyData.results.length === 0) {
    rows.push(['No comparison results available']);
    return rows;
  }

  // Filter models based on shown columns
  const visibleModels = summaryData.modelsCompared.filter(model => 
    shownColumns[model] !== false
  );

  // Build header row
  const headerRow: string[] = ['File Name'];
  
  accuracyData.fields.forEach(field => {
    if (shownColumns['Ground Truth'] !== false) {
      headerRow.push(`${field.name} (Ground Truth)`);
    }
    visibleModels.forEach(model => {
      headerRow.push(`${field.name} (${formatModelName(model)})`);
    });
  });

  rows.push(headerRow);

  // Build data rows
  accuracyData.results.forEach(result => {
    const row: any[] = [result.fileName]; // Use fileName instead of name

    accuracyData.fields.forEach(field => {
      const fieldData = result.fields[field.key];
      
      if (fieldData) {
        // Ground Truth column
        if (shownColumns['Ground Truth'] !== false) {
          row.push(fieldData['Ground Truth'] || '');
        }
        
        // Model columns
        visibleModels.forEach(model => {
          row.push(fieldData[model] || '');
        });
      } else {
        // Fill with empty cells if field data is missing
        if (shownColumns['Ground Truth'] !== false) {
          row.push('');
        }
        visibleModels.forEach(() => {
          row.push('');
        });
      }
    });

    rows.push(row);
  });

  return rows;
}

/**
 * Main export function
 */
export function exportToCSV(
  accuracyData: AccuracyData,
  shownColumns: Record<string, boolean>,
  processingTime?: { start?: Date; end?: Date; durationMs?: number }
): void {
  try {
    const summaryData = calculateSummaryStats(accuracyData, shownColumns);
    const allRows: any[][] = [];

    // Add summary information
    allRows.push(...generateSummaryRows(summaryData, processingTime));

    // Add field averages (F1 scores)
    allRows.push(...generateFieldAveragesRows(accuracyData, summaryData));

    // Add main comparison table
    allRows.push(...generateComparisonTableRows(accuracyData, summaryData, shownColumns));

    // Convert to CSV string
    const csvContent = arrayToCSV(allRows);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const templateName = summaryData.templateName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `accuracy_comparison_${templateName}_${timestamp}.csv`;

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    console.log('✅ CSV export completed:', filename);
  } catch (error) {
    console.error('❌ Error exporting to CSV:', error);
    throw new Error('Failed to export data to CSV. Please try again.');
  }
}

/**
 * Quick export function with default options
 */
export function quickExportToCSV(
  accuracyData: AccuracyData,
  shownColumns: Record<string, boolean>,
  processingTime?: { start?: Date; end?: Date; durationMs?: number }
): void {
  exportToCSV(accuracyData, shownColumns, processingTime);
} 