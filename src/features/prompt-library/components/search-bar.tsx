'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

  const handleSearch = () => {
    // Search functionality is already handled by the filters
    // This button is for visual consistency with the screenshot
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
          {/* Empty space for search button alignment */}
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
            className="h-11 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 pr-10"
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
            <SelectTrigger className="h-11 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
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
            <SelectTrigger className="h-11 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEMPLATES}>All</SelectItem>
              {availableTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Button - fixed width */}
        <div className="w-32">
          <Button 
            onClick={handleSearch}
            className="w-full h-11 bg-[#0061d5] hover:bg-[#0061d5]/90 text-white font-medium"
          >
            Search
          </Button>
        </div>
      </div>
    </div>
  );
} 