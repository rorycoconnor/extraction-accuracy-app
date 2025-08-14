/**
 * Context finder utility for locating extracted values in document text
 * and providing surrounding context with highlighting
 */

import { findSemanticMatch, isSemanticMatchingEnabled } from './semantic-matcher';

export type ContextMatch = {
  value: string;
  context: string;
  highlightedContext: string;
  confidence: 'high' | 'medium' | 'low';
  startIndex: number;
  endIndex: number;
};

/**
 * Finds the context for an extracted value in the document text
 */
export function findValueContext(
  extractedValue: string,
  documentText: string,
  fieldName: string
): ContextMatch | null {
  if (!extractedValue || !documentText || extractedValue.trim() === '') {
    return null;
  }

  const cleanValue = extractedValue.trim();
  const cleanText = documentText.replace(/\s+/g, ' ').trim();
  
  // Try multiple search strategies
  const searches = [
    // Exact match
    { pattern: cleanValue, confidence: 'high' as const, caseInsensitive: false, normalized: false, dateVariation: false },
    // Case insensitive
    { pattern: cleanValue.toLowerCase(), confidence: 'high' as const, caseInsensitive: true, normalized: false, dateVariation: false },
    // Normalized (remove punctuation)
    { pattern: normalizeForSearch(cleanValue), confidence: 'medium' as const, caseInsensitive: false, normalized: true, dateVariation: false },
    // Date variations (for date fields)
    ...generateDateVariations(cleanValue).map(pattern => ({ 
      pattern, 
      confidence: 'medium' as const,
      caseInsensitive: false,
      normalized: false,
      dateVariation: true 
    })),
    // Case insensitive date variations
    ...generateDateVariations(cleanValue).map(pattern => ({ 
      pattern: pattern.toLowerCase(), 
      confidence: 'medium' as const,
      caseInsensitive: true,
      normalized: false,
      dateVariation: true 
    })),
  ];

  for (const search of searches) {
    const match = findBestMatch(search.pattern, cleanText, search);
    if (match) {
      const context = extractContext(cleanText, match.start, match.end);
      const highlightedContext = highlightValueInContext(
        context, 
        search.pattern, 
        search.caseInsensitive || search.normalized
      );
      
      return {
        value: cleanValue,
        context,
        highlightedContext,
        confidence: search.confidence,
        startIndex: match.start,
        endIndex: match.end
      };
    }
  }

  // ==========================================
  // SEMANTIC MATCHING (Isolated Module)
  // ==========================================
  // Try semantic matching (acronyms, expansions) if enabled
  // This section can be easily removed if needed
  if (isSemanticMatchingEnabled()) {
    const semanticMatch = findSemanticMatch(cleanValue, cleanText);
    if (semanticMatch) {
      const context = extractContext(cleanText, semanticMatch.start, semanticMatch.end);
      const highlightedContext = highlightValueInContext(
        context, 
        semanticMatch.matchedText, 
        false  // Use exact matched text for highlighting
      );
      
      return {
        value: cleanValue,
        context,
        highlightedContext,
        confidence: 'medium' as const,  // Conservative confidence for semantic matches
        startIndex: semanticMatch.start,
        endIndex: semanticMatch.end
      };
    }
  }
  // ==========================================
  // END SEMANTIC MATCHING
  // ==========================================

  // Try fuzzy date matching for date-like values
  const fuzzyDateMatch = tryFuzzyDateMatch(cleanValue, cleanText);
  if (fuzzyDateMatch) {
    const context = extractContext(cleanText, fuzzyDateMatch.start, fuzzyDateMatch.end);
    const highlightedContext = highlightValueInContext(
      context, 
      cleanText.substring(fuzzyDateMatch.start, fuzzyDateMatch.end), 
      false
    );
    
    return {
      value: cleanValue,
      context,
      highlightedContext,
      confidence: 'low' as const,
      startIndex: fuzzyDateMatch.start,
      endIndex: fuzzyDateMatch.end
    };
  }

  return null;
}

/**
 * Normalizes text for better matching by removing punctuation and extra spaces
 */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates date format variations for better date matching
 */
function generateDateVariations(value: string): string[] {
  const variations: string[] = [];
  
  // Month names mapping
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthAbbreviations = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  // Try to parse the extracted value as a date
  let parsedDate: Date | null = null;
  
  // Parse various date formats
  const datePatterns = [
    /(\d{4})-(\d{1,2})-(\d{1,2})/,     // YYYY-MM-DD
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,  // MM/DD/YYYY
    /(\d{1,2})-(\d{1,2})-(\d{2,4})/,   // MM-DD-YYYY
    /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/,  // MM.DD.YYYY
  ];
  
  for (const pattern of datePatterns) {
    const match = value.match(pattern);
    if (match) {
      const [, part1, part2, part3] = match;
      
      try {
        if (pattern.source.startsWith('(\\d{4})')) {
          // YYYY-MM-DD format
          parsedDate = new Date(parseInt(part1), parseInt(part2) - 1, parseInt(part3));
        } else {
          // MM/DD/YYYY or MM-DD-YYYY format
          const year = part3.length === 2 ? 2000 + parseInt(part3) : parseInt(part3);
          parsedDate = new Date(year, parseInt(part1) - 1, parseInt(part2));
        }
        break;
      } catch (e) {
        // Continue to next pattern
      }
    }
  }
  
  // Try parsing month name formats
  if (!parsedDate) {
    monthNames.forEach((month, index) => {
      const monthPattern = new RegExp(`${month}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i');
      const match = value.match(monthPattern);
      if (match) {
        try {
          parsedDate = new Date(parseInt(match[2]), index, parseInt(match[1]));
        } catch (e) {
          // Continue
        }
      }
    });
  }
  
  // Try parsing abbreviated month formats
  if (!parsedDate) {
    monthAbbreviations.forEach((month, index) => {
      const monthPattern = new RegExp(`${month}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i');
      const match = value.match(monthPattern);
      if (match) {
        try {
          parsedDate = new Date(parseInt(match[2]), index, parseInt(match[1]));
        } catch (e) {
          // Continue
        }
      }
    });
  }
  
  // If we successfully parsed a date, generate all common variations
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth() + 1; // 0-based to 1-based
    const day = parsedDate.getDate();
    
    // Generate format variations
    variations.push(
      // ISO format
      `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      // US format
      `${month}/${day}/${year}`,
      `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`,
      // Alternative separators
      `${month}-${day}-${year}`,
      `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${year}`,
      `${month}.${day}.${year}`,
      // European format
      `${day}/${month}/${year}`,
      `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
      // Month name formats
      `${monthNames[month - 1]} ${day}, ${year}`,
      `${monthNames[month - 1]} ${day} ${year}`,
      `${monthAbbreviations[month - 1]} ${day}, ${year}`,
      `${monthAbbreviations[month - 1]} ${day} ${year}`,
      // Short year formats
      `${month}/${day}/${year.toString().slice(-2)}`,
      `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year.toString().slice(-2)}`,
      // Ordinal day formats
      `${monthNames[month - 1]} ${getOrdinalDay(day)}, ${year}`,
      `${monthAbbreviations[month - 1]} ${getOrdinalDay(day)}, ${year}`,
      // Without comma
      `${monthNames[month - 1]} ${day} ${year}`,
      `${monthAbbreviations[month - 1]} ${day} ${year}`,
      // Just month and year
      `${monthNames[month - 1]} ${year}`,
      `${monthAbbreviations[month - 1]} ${year}`,
    );
  }
  
  // Also try direct text matching for month names in the original value
  monthNames.forEach((month, index) => {
    if (value.toLowerCase().includes(month.toLowerCase())) {
      variations.push(value);
      variations.push(value.replace(new RegExp(month, 'gi'), monthAbbreviations[index]));
    }
  });
  
  monthAbbreviations.forEach((month, index) => {
    if (value.toLowerCase().includes(month.toLowerCase())) {
      variations.push(value);
      variations.push(value.replace(new RegExp(month, 'gi'), monthNames[index]));
    }
  });
  
  return [...new Set(variations)]; // Remove duplicates
}

/**
 * Helper function to get ordinal day (1st, 2nd, 3rd, etc.)
 */
function getOrdinalDay(day: number): string {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

/**
 * Tries fuzzy date matching for date-like values
 */
function tryFuzzyDateMatch(
  extractedValue: string, 
  text: string
): { start: number; end: number } | null {
  // Only try fuzzy matching if the value looks like a date
  if (!isDateLike(extractedValue)) {
    return null;
  }

  // Try to extract components from the extracted value
  const extractedComponents = extractDateComponents(extractedValue);
  if (!extractedComponents) {
    return null;
  }

  // Look for date patterns in the text that might match the components
  const dateRegexes = [
    // Month DD, YYYY formats
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    // Mon DD, YYYY formats
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    // DD/MM/YYYY or MM/DD/YYYY formats
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
    // DD-MM-YYYY or MM-DD-YYYY formats  
    /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g,
    // YYYY-MM-DD formats
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
  ];

  for (const regex of dateRegexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const matchedComponents = extractDateComponents(match[0]);
      if (matchedComponents && datesMatch(extractedComponents, matchedComponents)) {
        return {
          start: match.index,
          end: match.index + match[0].length
        };
      }
    }
  }

  return null;
}

/**
 * Checks if a string looks like a date
 */
function isDateLike(value: string): boolean {
  // Check for common date patterns
  const datePatterns = [
    /\d{4}-\d{1,2}-\d{1,2}/, // YYYY-MM-DD
    /\d{1,2}\/\d{1,2}\/\d{4}/, // MM/DD/YYYY
    /\d{1,2}-\d{1,2}-\d{4}/, // MM-DD-YYYY
    /(January|February|March|April|May|June|July|August|September|October|November|December)/i, // Month names
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i, // Month abbreviations
  ];

  return datePatterns.some(pattern => pattern.test(value));
}

/**
 * Extracts date components (year, month, day) from a string
 */
function extractDateComponents(value: string): { year: number; month: number; day: number } | null {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthAbbreviations = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Try different date formats
  const patterns = [
    // YYYY-MM-DD
    { regex: /(\d{4})-(\d{1,2})-(\d{1,2})/, order: ['year', 'month', 'day'] },
    // MM/DD/YYYY
    { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, order: ['month', 'day', 'year'] },
    // MM-DD-YYYY
    { regex: /(\d{1,2})-(\d{1,2})-(\d{4})/, order: ['month', 'day', 'year'] },
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern.regex);
    if (match) {
      const components: any = {};
      pattern.order.forEach((component, index) => {
        components[component] = parseInt(match[index + 1]);
      });
      return components;
    }
  }

  // Try month name patterns
  for (let i = 0; i < monthNames.length; i++) {
    const monthPattern = new RegExp(`${monthNames[i]}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i');
    const match = value.match(monthPattern);
    if (match) {
      return {
        year: parseInt(match[2]),
        month: i + 1,
        day: parseInt(match[1])
      };
    }
  }

  // Try month abbreviation patterns
  for (let i = 0; i < monthAbbreviations.length; i++) {
    const monthPattern = new RegExp(`${monthAbbreviations[i]}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i');
    const match = value.match(monthPattern);
    if (match) {
      return {
        year: parseInt(match[2]),
        month: i + 1,
        day: parseInt(match[1])
      };
    }
  }

  return null;
}

/**
 * Checks if two date components represent the same date
 */
function datesMatch(
  date1: { year: number; month: number; day: number },
  date2: { year: number; month: number; day: number }
): boolean {
  return date1.year === date2.year && date1.month === date2.month && date1.day === date2.day;
}

/**
 * Finds the best match for a pattern in text
 */
function findBestMatch(
  pattern: string, 
  text: string, 
  options: { caseInsensitive?: boolean; normalized?: boolean; dateVariation?: boolean }
): { start: number; end: number } | null {
  let searchText = text;
  let searchPattern = pattern;

  if (options.caseInsensitive) {
    searchText = text.toLowerCase();
    searchPattern = pattern.toLowerCase();
  }

  if (options.normalized) {
    searchText = normalizeForSearch(text);
    searchPattern = normalizeForSearch(pattern);
  }

  const index = searchText.indexOf(searchPattern);
  if (index !== -1) {
    return {
      start: index,
      end: index + searchPattern.length
    };
  }

  return null;
}

/**
 * Extracts context around the found value (surrounding sentences)
 */
function extractContext(text: string, startIndex: number, endIndex: number): string {
  // Find sentence boundaries around the match
  const sentenceEnders = /[.!?]+\s+/g;
  const sentences: { start: number; end: number; text: string }[] = [];
  
  let match;
  let lastEnd = 0;
  
  while ((match = sentenceEnders.exec(text)) !== null) {
    sentences.push({
      start: lastEnd,
      end: match.index + match[0].length,
      text: text.substring(lastEnd, match.index + match[0].length).trim()
    });
    lastEnd = match.index + match[0].length;
  }
  
  // Add the last sentence if it doesn't end with punctuation
  if (lastEnd < text.length) {
    sentences.push({
      start: lastEnd,
      end: text.length,
      text: text.substring(lastEnd).trim()
    });
  }

  // Find which sentence contains our match
  const matchSentenceIndex = sentences.findIndex(
    sentence => startIndex >= sentence.start && endIndex <= sentence.end
  );

  if (matchSentenceIndex === -1) {
    // Fallback: return a character-based window
    const contextStart = Math.max(0, startIndex - 100);
    const contextEnd = Math.min(text.length, endIndex + 100);
    return text.substring(contextStart, contextEnd).trim();
  }

  // Include the matching sentence plus one before and one after
  const contextStartIndex = Math.max(0, matchSentenceIndex - 1);
  const contextEndIndex = Math.min(sentences.length - 1, matchSentenceIndex + 1);
  
  const contextSentences = sentences.slice(contextStartIndex, contextEndIndex + 1);
  return contextSentences.map(s => s.text).join(' ').trim();
}

/**
 * Highlights the found value within the context
 */
function highlightValueInContext(
  context: string,
  value: string,
  caseInsensitive: boolean = false
): string {
  let searchContext = context;
  let searchValue = value;
  
  if (caseInsensitive) {
    searchContext = context.toLowerCase();
    searchValue = value.toLowerCase();
  }
  
  const index = searchContext.indexOf(searchValue);
  if (index === -1) {
    return context; // Return original if not found
  }
  
  // Use the original casing from context for the highlighted portion
  const beforeHighlight = context.substring(0, index);
  const highlightedPart = context.substring(index, index + searchValue.length);
  const afterHighlight = context.substring(index + searchValue.length);
  
  return `${beforeHighlight}<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">${highlightedPart}</mark>${afterHighlight}`;
}

/**
 * Finds context for multiple field values at once
 */
export function findMultipleValueContexts(
  extractedData: Record<string, string>,
  documentText: string
): Record<string, ContextMatch | null> {
  const contexts: Record<string, ContextMatch | null> = {};
  
  Object.entries(extractedData).forEach(([fieldKey, value]) => {
    contexts[fieldKey] = findValueContext(value, documentText, fieldKey);
  });
  
  return contexts;
} 