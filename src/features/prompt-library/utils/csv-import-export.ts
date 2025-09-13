import type { Database, Template, Field, Prompt, FieldType } from '../types';

export interface ExportableTemplate {
  category: string;
  templateName: string;
  fieldName: string;
  fieldType: string;
  prompts: string[];
  fieldOrder?: number;
}

export function exportTemplatesToCSV(database: Database, selectedTemplateIds: string[]): string {
  const rows: string[] = [];
  
  // Add header
  rows.push('Category,Template,Field,Type,Prompt 1,Prompt 2,Prompt 3');
  
  // Filter templates to export
  const templatesToExport = selectedTemplateIds.includes('all') 
    ? database.templates 
    : database.templates.filter(t => selectedTemplateIds.includes(t.id));
  
  // Process each template
  for (const template of templatesToExport) {
    for (const field of template.fields) {
      // Sort prompts by rating (up - down) descending
      const sortedPrompts = [...field.prompts].sort((a, b) => (b.up - b.down) - (a.up - a.down));
      
      const prompts: string[] = [];
      // Take up to 3 top prompts, but user can add more columns in CSV
      for (let i = 0; i < 3; i++) {
        prompts.push(sortedPrompts[i]?.text || '');
      }
      
      // Create CSV row with proper escaping
      const row = [
        template.category,
        template.name,
        field.name,
        field.type,
        ...prompts.map(p => p.includes(',') || p.includes('"') ? `"${p.replace(/"/g, '""')}"` : p)
      ];
      
      rows.push(row.join(','));
    }
  }
  
  return rows.join('\n');
}

export function parseImportCSV(csvText: string): ExportableTemplate[] {
  // Normalize different types of quotes to standard quotes
  const normalizedText = csvText
    .replace(/[""]/g, '"')  // Replace smart quotes with regular quotes
    .replace(/['']/g, "'")  // Replace smart apostrophes with regular apostrophes
    .trim();
  
  const lines = normalizedText.split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row');
  }
  
  const templates: ExportableTemplate[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing (handles quoted fields)
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        if (insideQuotes && line[j + 1] === '"') {
          // Escaped quote
          currentValue += '"';
          j++; // Skip next quote
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // End of field
        values.push(normalizeFieldValue(currentValue.trim()));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Add the last value
    values.push(normalizeFieldValue(currentValue.trim()));
    
    if (values.length >= 4) {
      // Get all prompts from columns 5 onwards and normalize them
      const prompts = values.slice(4)
        .filter(p => p.trim() !== '')
        .map(p => normalizeFieldValue(p));
      
      templates.push({
        category: values[0],
        templateName: values[1],
        fieldName: values[2],
        fieldType: values[3],
        prompts,
        fieldOrder: i - 1 // Use CSV row order for field ordering
      });
    }
  }
  
  return templates;
}

/**
 * Normalize field values by fixing common encoding issues
 */
function normalizeFieldValue(value: string): string {
  return value
    // Fix common encoding issues
    .replace(/â€œ/g, '"')    // Fix â€œ to "
    .replace(/â€/g, '"')     // Fix â€ to "
    .replace(/â€™/g, "'")    // Fix â€™ to '
    .replace(/â€˜/g, "'")    // Fix â€˜ to '
    .replace(/â€"/g, '—')    // Fix â€" to em dash
    .replace(/â€"/g, '–')    // Fix â€" to en dash
    .replace(/Â/g, '')       // Remove stray Â characters
    // Normalize different quote types
    .replace(/[""]/g, '"')   // Replace smart quotes
    .replace(/['']/g, "'")   // Replace smart apostrophes
    .trim();
}

export function validateImportData(templates: ExportableTemplate[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (templates.length === 0) {
    errors.push('CSV file contains no valid data rows');
    return { valid: false, errors };
  }
  
  // Check required fields
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    
    if (!template.category?.trim()) {
      errors.push(`Row ${i + 2}: Missing category`);
    }
    if (!template.templateName?.trim()) {
      errors.push(`Row ${i + 2}: Missing template name`);
    }
    if (!template.fieldName?.trim()) {
      errors.push(`Row ${i + 2}: Missing field name`);
    }
    if (!template.fieldType?.trim()) {
      errors.push(`Row ${i + 2}: Missing field type`);
    }
  }
  
  // Check for duplicate field names within the same template
  const templateFieldMap = new Map<string, Set<string>>();
  const duplicateRows: number[] = [];
  
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const templateKey = `${template.category?.trim()}-${template.templateName?.trim()}`;
    const fieldName = template.fieldName?.trim();
    
    if (!templateKey || !fieldName) continue; // Skip if missing required data
    
    if (!templateFieldMap.has(templateKey)) {
      templateFieldMap.set(templateKey, new Set());
    }
    
    const fieldsInTemplate = templateFieldMap.get(templateKey)!;
    
    if (fieldsInTemplate.has(fieldName)) {
      // Found duplicate field name
      duplicateRows.push(i + 2); // +2 for 1-based indexing and header row
    } else {
      fieldsInTemplate.add(fieldName);
    }
  }
  
  if (duplicateRows.length > 0) {
    const duplicateFieldNames = new Set<string>();
    for (let i = 0; i < templates.length; i++) {
      if (duplicateRows.includes(i + 2)) {
        duplicateFieldNames.add(templates[i].fieldName?.trim() || '');
      }
    }
    
    errors.push(
      `Duplicate field names found: ${Array.from(duplicateFieldNames).join(', ')}. ` +
      `Each field name must be unique within a template. Please remove duplicates and re-upload.`
    );
  }
  
  return { valid: errors.length === 0, errors };
}

export function downloadCSV(csvContent: string, filename: string): void {
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
  }
} 