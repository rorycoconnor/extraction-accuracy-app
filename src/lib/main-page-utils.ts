/**
 * Utility Functions for the Main Page Component
 * 
 * This file contains utility functions extracted from the main page component
 * to improve maintainability and enable better testing.
 */

import { DEFAULT_ENUM_OPTIONS, UI_LABELS, FIELD_TYPES } from './main-page-constants';

/**
 * Generate default enum options for common contract fields
 * 
 * @param fieldKey - The field key to analyze
 * @param fieldName - The display name of the field
 * @returns Array of default enum options
 */
export function getDefaultEnumOptions(fieldKey: string, fieldName: string): { key: string }[] {
  const fieldKeyLower = fieldKey.toLowerCase();
  const fieldNameLower = fieldName.toLowerCase();
  
  if (fieldKeyLower.includes('contracttype') || fieldKeyLower.includes('contract_type') || fieldNameLower.includes('contract type')) {
    return [...DEFAULT_ENUM_OPTIONS.CONTRACT_TYPES];
  }
  
  if (fieldKeyLower.includes('contractterm') || fieldKeyLower.includes('contract_term') || fieldNameLower.includes('contract term')) {
    return [...DEFAULT_ENUM_OPTIONS.CONTRACT_TERMS];
  }
  
  if (fieldKeyLower.includes('renewal') || fieldNameLower.includes('renewal')) {
    return [...DEFAULT_ENUM_OPTIONS.RENEWAL_TYPES];
  }
  
  if (fieldKeyLower.includes('termination') || fieldKeyLower.includes('termination')) {
    return [...DEFAULT_ENUM_OPTIONS.TERMINATION_OPTIONS];
  }
  
  return [...DEFAULT_ENUM_OPTIONS.YES_NO_OPTIONS];
}

/**
 * Generate intelligent initial prompts based on field type and name
 * 
 * @param field - The field object to generate a prompt for
 * @returns Generated prompt string
 */
export function generateInitialPromptForField(field: any): string {
  const fieldName = field.displayName.toLowerCase();
  const fieldKey = field.key.toLowerCase();
  
  // Contract type specific prompts
  if (fieldKey.includes('contracttype') || fieldKey.includes('contract_type') || fieldName.includes('contract type')) {
    return `Identify the contract type. Prioritize headings and explicitly labeled sections such as "Contract Type", "Agreement Type", or "Nature of Agreement". If none are found, extract the most descriptive phrase indicating the type of contract from the document's first paragraph.`;
  }
  
  // Counter party specific prompts
  if (fieldKey.includes('counterparty') || fieldKey.includes('counter_party') || fieldName.includes('counter party')) {
    return `Extract the counter party name from the contract. Look for the company or individual name that is NOT your organization. Prioritize: 1. Names in signature blocks, 2. Names in "Party" or "Between" sections, 3. Company names in headers or letterheads.`;
  }
  
  // Date specific prompts
  if (fieldKey.includes('effective') || fieldName.includes('effective')) {
    return `Extract the single, primary effective date from the contract. Prioritize in this order: 1. Dates explicitly labeled "Effective Date," "Effective as of," or "Commencement Date". 2. If no explicit effective date is found, use the latest signature date.`;
  }
  
  if (fieldKey.includes('end') || fieldKey.includes('expir') || fieldName.includes('end') || fieldName.includes('expir')) {
    return `Extract the contract end or expiration date. Look for dates labeled "End Date", "Expiration Date", "Termination Date", or "Through Date". If not explicitly labeled, look for the later date in a date range.`;
  }
  
  // Legal specific prompts
  if (fieldKey.includes('governing') || fieldKey.includes('law') || fieldName.includes('governing') || fieldName.includes('law')) {
    return `Extract the governing law clause. Prioritize clauses explicitly mentioning "Governing Law", "Jurisdiction", or "Choice of Law". If none are found, extract any clause specifying a legal jurisdiction or state. Output as a single name such as New York, Florida, California, Texas.`;
  }
  
  if (fieldKey.includes('venue') || fieldName.includes('venue')) {
    return `Extract the venue from the contract. Prioritize: 1. Clauses explicitly mentioning "Venue", "Jurisdiction", or "Court". 2. Any section specifying the location for dispute resolution. 3. If none of the above are found, extract any location-related information that might imply venue (city, state, country) as a last resort. Output as a single name such as New York, Florida, California, Texas.`;
  }
  
  // Financial specific prompts
  if (fieldKey.includes('value') || fieldKey.includes('amount') || fieldKey.includes('price') || fieldName.includes('value') || fieldName.includes('amount') || fieldName.includes('price')) {
    return `Extract the contract value. Prioritize: 1. Values explicitly labeled "Contract Value", "Total Contract Price", or "Total Amount"; 2. Numerical values in close proximity to phrases like "Total," "Sum," or "Cost"; 3. If no value is found, return "Not Found".`;
  }
  
  // Contact information specific prompts
  if (fieldKey.includes('email') || fieldName.includes('email')) {
    return `Extract email addresses from the contract. Prioritize these locations: 1. Signature blocks explicitly labeled "Email" or "Email Address"; 2. Contact information sections; 3. Email addresses near company names or representative names. If no email is found, return "Not Found".`;
  }
  
  if (fieldKey.includes('address') || fieldName.includes('address')) {
    return `Extract the address from the contract. Look for complete addresses including street, city, state, and zip code. Prioritize addresses in signature blocks, contact information sections, or party identification sections.`;
  }
  
  // Generic prompts based on field type
  switch (field.type) {
    case FIELD_TYPES.DATE:
      return `Extract the ${field.displayName} from the document. Look for dates that are explicitly labeled or contextually related to "${field.displayName}". Return the date in a clear format.`;
    case FIELD_TYPES.ENUM:
      return `Extract the ${field.displayName} from the document. Look for explicit labels or contextual information that indicates the ${field.displayName}. If multiple options are available, choose the most specific and accurate one.`;
    default:
      return `Extract the ${field.displayName} from the document. Look for explicit labels, headings, or contextual information that clearly indicates the ${field.displayName}. Be specific and accurate.`;
  }
} 