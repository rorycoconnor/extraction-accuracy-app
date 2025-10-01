import type { Database, Template, Field, Prompt, FieldType } from '../types';

export interface ExportableTemplate {
  category: string;
  templateName: string;
  fieldName: string;
  fieldType: string;
  options: string;
  prompts: string[];
  fieldOrder?: number;
}

// Field type mapping for CSV export - converts internal types to display names
const FIELD_TYPE_EXPORT_MAPPING: Record<string, string> = {
  'text': 'Text',
  'number': 'Number',
  'date': 'Date',
  'dropdown_single': 'Dropdown',
  'dropdown_multi': 'Dropdown (Multi-select)',
  'taxonomy': 'Taxonomy',
};

function getDisplayFieldType(fieldType: string): string {
  return FIELD_TYPE_EXPORT_MAPPING[fieldType] || fieldType;
}

function formatOptionsForCSV(field: Field): string {
  // Only export options for dropdown and taxonomy fields
  if (field.type !== 'dropdown_single' && field.type !== 'dropdown_multi' && field.type !== 'taxonomy') {
    return '';
  }

  let options: string[] = [];
  
  // Get options from field.options or field.optionsPaste
  if (field.options && field.options.length > 0) {
    options = field.options;
  } else if (field.optionsPaste) {
    // Parse from optionsPaste - support both comma and newline separated
    options = parseOptionsFlexible(field.optionsPaste);
  }

  if (options.length === 0) {
    return '';
  }

  // Use comma separator - simple and universal
  return options.join(', ');
}

// Flexible options parser - handles comma-separated, newline-separated, or mixed
export function parseOptionsFlexible(input: string): string[] {
  if (!input || input.trim() === '') {
    return [];
  }

  // First split by newlines, then by commas, then clean up
  return input
    .split(/[\n,]/) // Split by newlines OR commas
    .map(option => option.trim())
    .filter(option => option !== '')
    .filter((option, index, array) => array.indexOf(option) === index); // Remove duplicates
}

export function exportTemplatesToCSV(database: Database, selectedTemplateIds: string[]): string {
  const rows: string[] = [];
  
  // Add header
  rows.push('Category,Template,Field,Type,Options,Prompt 1,Prompt 2,Prompt 3');
  
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
      
      // Get formatted options for this field
      const formattedOptions = formatOptionsForCSV(field);
      
      // Create CSV row with proper escaping
      const row = [
        template.category,
        template.name,
        field.name,
        getDisplayFieldType(field.type),
        // Always quote options if they contain commas or quotes (since we use comma-separated format)
        formattedOptions.includes(',') || formattedOptions.includes('"') ? `"${formattedOptions.replace(/"/g, '""')}"` : formattedOptions,
        ...prompts.map(p => p.includes(',') || p.includes('"') ? `"${p.replace(/"/g, '""')}"` : p)
      ];
      
      rows.push(row.join(','));
    }
  }
  
  return rows.join('\n');
}

// Field type mapping for CSV import - handles both display names and internal types
const FIELD_TYPE_IMPORT_MAPPING: Record<string, string> = {
  // Display names (what users see in UI and CSV export)
  'Text': 'text',
  'Number': 'number', 
  'Date': 'date',
  'Dropdown': 'dropdown_single', // Default dropdown to single select
  'Dropdown (Multi-select)': 'dropdown_multi', // New export format
  'Taxonomy': 'taxonomy',
  
  // Internal types (for backwards compatibility)
  'text': 'text',
  'number': 'number',
  'date': 'date', 
  'dropdown_single': 'dropdown_single',
  'dropdown_multi': 'dropdown_multi',
  'taxonomy': 'taxonomy',
  
  // Common variations users might type
  'dropdown': 'dropdown_single',
  'dropdown multi-select': 'dropdown_multi',
  'dropdown (multi-select)': 'dropdown_multi',
  'dropdown multiselect': 'dropdown_multi',
  'multi-select': 'dropdown_multi',
  'multiselect': 'dropdown_multi',
  'multi select': 'dropdown_multi',
  'string': 'text', // Box API type
  'float': 'number', // Box API type
  'enum': 'dropdown_single', // Box API type
  'multiSelect': 'dropdown_multi', // Box API type
};

function normalizeFieldType(fieldType: string): string {
  const trimmed = fieldType.trim();
  // Try exact match first (case sensitive)
  if (FIELD_TYPE_IMPORT_MAPPING[trimmed]) {
    return FIELD_TYPE_IMPORT_MAPPING[trimmed];
  }
  
  // Try case-insensitive match
  const lowerCase = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(FIELD_TYPE_IMPORT_MAPPING)) {
    if (key.toLowerCase() === lowerCase) {
      return value;
    }
  }

  // Default to 'text' if no match found
  console.warn(`Unknown field type "${fieldType}" in CSV import, defaulting to 'text'`);
  return 'text';
}

export function parseOptionsFromCSV(optionsString: string): string[] {
  return parseOptionsFlexible(optionsString);
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
    
    if (values.length >= 5) {
      // Get all prompts from columns 6 onwards and normalize them
      const prompts = values.slice(5)
        .filter(p => p.trim() !== '')
        .map(p => normalizeFieldValue(p));
      
      templates.push({
        category: values[0],
        templateName: values[1],
        fieldName: values[2],
        fieldType: normalizeFieldType(values[3]),
        options: values[4] || '', // Options column (5th column, index 4)
        prompts,
        fieldOrder: i - 1 // Use CSV row order for field ordering
      });
    }
  }
  
  return templates;
}

/**
 * Decode HTML entities to their proper characters
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&#x27;': "'",
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&ndash;': '–',
    '&mdash;': '—',
  };
  
  let decoded = text;
  
  // Replace named entities
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Replace numeric entities (&#39; or &#x27;)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return decoded;
}

/**
 * Normalize field values by fixing common encoding issues
 */
function normalizeFieldValue(value: string): string {
  return value
    // First decode HTML entities
    .replace(/&[#\w]+;/g, (entity) => decodeHTMLEntities(entity))
    // Fix replacement character (�) - common when UTF-8 is misread
    .replace(/�/g, "'")      // Replace � with apostrophe (most common case)
    // Fix common UTF-8 misreading patterns (Windows-1252 → UTF-8)
    .replace(/â€œ/g, '"')    // Fix â€œ to "
    .replace(/â€/g, '"')     // Fix â€ to "
    .replace(/â€™/g, "'")    // Fix â€™ to '
    .replace(/â€˜/g, "'")    // Fix â€˜ to '
    .replace(/â€"/g, '—')    // Fix â€" to em dash
    .replace(/â€"/g, '–')    // Fix â€" to en dash
    .replace(/Ã©/g, 'é')     // Fix Ã© to é
    .replace(/Ã¨/g, 'è')     // Fix Ã¨ to è
    .replace(/Ã /g, 'à')     // Fix Ã  to à
    .replace(/Ã§/g, 'ç')     // Fix Ã§ to ç
    .replace(/Ã±/g, 'ñ')     // Fix Ã± to ñ
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