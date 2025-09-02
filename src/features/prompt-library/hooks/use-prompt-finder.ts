import { usePromptLibrary } from './use-prompt-library';

export function usePromptFinder() {
  const { database } = usePromptLibrary();

  const findMatchingPrompts = (fieldName: string) => {
    // Normalize the field name for comparison
    const normalizedFieldName = fieldName.toLowerCase().trim();
    
    // Search through all templates and fields
    for (const template of database.templates) {
      for (const field of template.fields) {
        // Check if field names match (case-insensitive)
        if (field.name.toLowerCase().trim() === normalizedFieldName && field.prompts.length > 0) {
          // Return the field and its template info if there are prompts
          return {
            hasPrompts: true,
            fieldId: field.id,
            templateId: template.id,
            templateName: template.name,
            categoryName: template.category,
            prompts: field.prompts,
          };
        }
      }
    }

    return { hasPrompts: false };
  };

  return { findMatchingPrompts };
} 