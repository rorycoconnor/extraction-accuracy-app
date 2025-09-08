import type { Database } from '../types';
import { STORAGE_KEY } from '../types';
import { autoMigrateIfNeeded } from './migration';

// Seed data only used if localStorage is completely empty
function createInitialSeedData(): Database {
  return {
    categories: ['Legal', 'Finance', 'Marketing'],
    templates: [
      {
        id: 'legal-contracts',
        name: 'Contracts',
        category: 'Legal',
        key: 'contracts',
        copyOnCopy: false,
        fields: [
          {
            id: 'counter-party-name',
            name: 'Counter Party Name',
            type: 'text',
            key: 'counterPartyName',
            hidden: false,
            options: [],
            optionsPaste: '',
            prompts: [
              {
                id: 'prompt-1',
                text: 'What is the name of the counter party?',
                up: 30,
                down: 2,
                createdAt: Date.now() - 86400000,
              },
              {
                id: 'prompt-2', 
                text: 'What is the name of the counter party. It is not company name.',
                up: 10,
                down: 3,
                createdAt: Date.now() - 86400000 * 2,
              },
              {
                id: 'prompt-3',
                text: 'Identify and extract the counterparty mentioned in the agreement.',
                up: 25,
                down: 2,
                createdAt: Date.now() - 86400000 * 3,
              }
            ]
          },
          {
            id: 'start-date',
            name: 'Start Date',
            type: 'date',
            key: 'startDate',
            hidden: false,
            options: [],
            optionsPaste: '',
            prompts: [
              {
                id: 'prompt-4',
                text: 'What is the effective start date of this agreement?',
                up: 22,
                down: 3,
                createdAt: Date.now() - 86400000,
              },
              {
                id: 'prompt-5',
                text: 'Find the commencement date of the contract.',
                up: 19,
                down: 5,
                createdAt: Date.now() - 86400000 * 2,
              }
            ]
          }
        ]
      },
      {
        id: 'finance-invoices',
        name: 'Invoices',
        category: 'Finance',
        key: 'invoices',
        copyOnCopy: false,
        fields: [
          {
            id: 'invoice-number',
            name: 'Invoice Number',
            type: 'text',
            key: 'invoiceNumber',
            hidden: false,
            options: [],
            optionsPaste: '',
            prompts: [
              {
                id: 'prompt-6',
                text: 'What is the invoice number?',
                up: 15,
                down: 1,
                createdAt: Date.now() - 86400000,
              }
            ]
          },
          {
            id: 'invoice-amount',
            name: 'Invoice Amount',
            type: 'text',
            key: 'invoiceAmount',
            hidden: false,
            options: [],
            optionsPaste: '',
            prompts: [
              {
                id: 'prompt-7',
                text: 'What is the total amount of this invoice?',
                up: 12,
                down: 2,
                createdAt: Date.now() - 86400000,
              }
            ]
          }
        ]
      }
    ]
  };
}

export const PromptLibraryStorage = {
  // Load data from localStorage with automatic migration
  load(): Database {
    // First, attempt automatic migration if needed
    const migratedData = autoMigrateIfNeeded();
    if (migratedData) {
      return migratedData;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure we have valid structure
        if (parsed.categories && parsed.templates) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Failed to load prompt library data:', error);
    }
    
    // Return seed data only if localStorage is empty/invalid and save it
    const seedData = createInitialSeedData();
    this.save(seedData);
    return seedData;
  },

  // Save data to localStorage
  save(data: Database): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save prompt library data:', error);
    }
  },

  // Clear all data
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear prompt library data:', error);
    }
  }
}; 