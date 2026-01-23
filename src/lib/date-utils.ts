/**
 * Shared date utilities for parsing and comparing dates.
 * 
 * This module provides flexible date parsing that handles multiple formats
 * commonly found in documents (contracts, invoices, etc.).
 */

/** Month name to number mapping (0-indexed) */
const MONTH_MAP: Record<string, number> = {
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4,
  'jun': 5, 'june': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11
};

/** Date pattern definition */
interface DatePattern {
  regex: RegExp;
  parse: (match: RegExpMatchArray) => Date | null;
}

/** All supported date patterns */
const DATE_PATTERNS: DatePattern[] = [
  // YYYY-MM-DD, YYYY/MM/DD (ISO format - unambiguous)
  {
    regex: /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/,
    parse: (match) => new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
  },
  
  // MM/DD/YY, MM-DD-YY, DD/MM/YY (2-digit year - smart US/EU detection)
  {
    regex: /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/,
    parse: (match) => {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);
      const year = parseInt(match[3]);
      const fullYear = year < 50 ? 2000 + year : 1900 + year; // 49 and below = 20xx, 50+ = 19xx
      
      // If first number > 12, it must be DD/MM format (European)
      if (first > 12) {
        return new Date(fullYear, second - 1, first);
      }
      // If second number > 12, it must be MM/DD format (US)
      if (second > 12) {
        return new Date(fullYear, first - 1, second);
      }
      // Ambiguous case - default to MM/DD (US format)
      return new Date(fullYear, first - 1, second);
    }
  },
  
  // MM/DD/YYYY, MM-DD-YYYY, DD/MM/YYYY (4-digit year - smart US/EU detection)
  {
    regex: /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
    parse: (match) => {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);
      const year = parseInt(match[3]);
      
      // If first number > 12, it must be DD/MM format (European)
      if (first > 12) {
        return new Date(year, second - 1, first);
      }
      // If second number > 12, it must be MM/DD format (US)
      if (second > 12) {
        return new Date(year, first - 1, second);
      }
      // Ambiguous case - default to MM/DD (US format)
      return new Date(year, first - 1, second);
    }
  },
  
  // MON-DD-YY format (e.g., MAR-22-08)
  {
    regex: /^([a-z]{3})[-\/](\d{1,2})[-\/](\d{2})$/i,
    parse: (match) => {
      const monthNum = MONTH_MAP[match[1].toLowerCase()];
      if (monthNum === undefined) return null;
      const year = parseInt(match[3]);
      const fullYear = year < 50 ? 2000 + year : 1900 + year;
      return new Date(fullYear, monthNum, parseInt(match[2]));
    }
  },
  
  // MON-DD-YYYY format (e.g., MAR-22-2008)
  {
    regex: /^([a-z]{3})[-\/](\d{1,2})[-\/](\d{4})$/i,
    parse: (match) => {
      const monthNum = MONTH_MAP[match[1].toLowerCase()];
      if (monthNum === undefined) return null;
      return new Date(parseInt(match[3]), monthNum, parseInt(match[2]));
    }
  },
  
  // Month Name DD, YYYY (e.g., "March 22, 2008" or "May 7, 2025")
  {
    regex: /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i,
    parse: (match) => {
      const monthNum = MONTH_MAP[match[1].toLowerCase()];
      if (monthNum === undefined) return null;
      return new Date(parseInt(match[3]), monthNum, parseInt(match[2]));
    }
  },
];

/**
 * Enhanced date parser that handles multiple formats including:
 * - ISO: 2008-09-30, 2008/09/30
 * - US short: 09/30/08, 09-30-08
 * - US long: 09/30/2008, 09-30-2008
 * - Month abbrev: MAR-22-08, Mar-22-2008
 * - Month name: May 7, 2025, March 22, 2008
 * - European: 30/09/2008 (when day > 12)
 * 
 * @param dateStr - The date string to parse
 * @returns Parsed Date object or null if parsing fails
 */
export function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  
  // Try each pattern in order
  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      try {
        const date = pattern.parse(match);
        if (date && !isNaN(date.getTime())) {
          return date;
        }
      } catch {
        // Continue to next pattern
      }
    }
  }
  
  // Fallback to JavaScript's Date constructor for other formats
  try {
    const fallbackDate = new Date(trimmed);
    return !isNaN(fallbackDate.getTime()) ? fallbackDate : null;
  } catch {
    return null;
  }
}

/**
 * Compare two dates for equality (same year, month, day).
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if dates represent the same day
 */
export function areDatesEqual(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Format a date to YYYY-MM-DD string.
 * 
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
