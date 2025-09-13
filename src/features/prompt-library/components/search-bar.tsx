'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { usePromptLibrary } from '../hooks/use-prompt-library';
import { ALL_CATEGORIES, ALL_TEMPLATES } from '../types';

export function SearchBar() {
  const { 
    database,
    searchFilters, 
    setSearchTerm,
    setSelectedCategory,
    setSelectedTemplate,
    filteredTemplates
  } = usePromptLibrary();

  // Get available templates for the selected category
  const availableTemplates = React.useMemo(() => {
    if (!searchFilters.category || searchFilters.category === ALL_CATEGORIES) {
      return database.templates;
    }
    return database.templates.filter(t => t.category === searchFilters.category);
  }, [database.templates, searchFilters.category]);

  // Check if any filters are active
  const hasActiveFilters = React.useMemo(() => {
    return !!(
      searchFilters.searchTerm.trim() ||
      (searchFilters.category && searchFilters.category !== ALL_CATEGORIES) ||
      (searchFilters.template && searchFilters.template !== ALL_TEMPLATES)
    );
  }, [searchFilters.searchTerm, searchFilters.category, searchFilters.template]);

  const handleClear = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setSelectedTemplate(null);
  };

  return (
    <div className="space-y-3">
      {/* Title Row */}
      <div className="flex gap-4">
        <div className="flex-[2]">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">What are you looking for?</label>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Categories</label>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Templates</label>
        </div>
        <div className="w-32">
          {/* Empty space for clear button alignment */}
        </div>
      </div>

      {/* Input Row */}
      <div className="flex gap-4 items-end">
        {/* Search Input - 2x width, with clear button */}
        <div className="flex-[2] relative">
          <Input
            type="text"
            placeholder="Search for categories, templates, fields, prompts, etc."
            value={searchFilters.searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 pr-10 bg-white dark:bg-gray-800"
          />
          {searchFilters.searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              style={{ top: 'calc(50% + 1px)', transform: 'translateY(-50%)' }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Categories Select - equal width with templates */}
        <div className="flex-1">
          <Select 
            value={searchFilters.category || ALL_CATEGORIES} 
            onValueChange={(value) => setSelectedCategory(value === ALL_CATEGORIES ? null : value)}
          >
            <SelectTrigger className="h-11 bg-white dark:bg-gray-800">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800">
              <SelectItem value={ALL_CATEGORIES}>All</SelectItem>
              {database.categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates Select - equal width with categories */}
        <div className="flex-1">
          <Select 
            value={searchFilters.template || ALL_TEMPLATES} 
            onValueChange={(value) => setSelectedTemplate(value === ALL_TEMPLATES ? null : value)}
          >
            <SelectTrigger className="h-11 bg-white dark:bg-gray-800">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800">
              <SelectItem value={ALL_TEMPLATES}>All</SelectItem>
              {availableTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear Button - fixed width */}
        <div className="w-32">
          <button
            onClick={handleClear}
            disabled={!hasActiveFilters}
            className={`w-full h-11 font-medium rounded-full transition-colors ${
              hasActiveFilters
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-[#EFF6FF] text-gray-500 cursor-not-allowed'
            }`}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
} 