/**
 * Utility functions for Prompt Studio components
 */

import React from 'react';

// Helper function to format date values (remove timestamp from ISO dates)
export const formatDateValue = (value: string): string => {
  if (!value || typeof value !== 'string') return value;
  
  // Check if it's an ISO 8601 date with timestamp
  // Handles: "2025-04-04T00:00:00Z", "2025-04-04T00:00:00", "2026-03-26T00:00:00Z"
  const isoDatePattern = /^(\d{4}-\d{2}-\d{2})T[\d:.]+(Z)?$/;
  const match = value.match(isoDatePattern);
  
  if (match) {
    // Return just the date portion (YYYY-MM-DD)
    return match[1];
  }
  
  return value;
};

// Helper function to get generation method badge
export const getGenerationMethodBadge = (method?: 'standard' | 'dspy' | 'agent'): React.ReactNode => {
  if (!method) return null;
  
  const badges = {
    standard: { label: 'Gen w/Standard', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    dspy: { label: 'Gen w/DSPy Style', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    agent: { label: 'Gen w/Agent', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  };
  
  const badge = badges[method];
  return React.createElement('span', {
    className: `text-xs px-2 py-1 rounded-full ${badge.className}`
  }, badge.label);
};
