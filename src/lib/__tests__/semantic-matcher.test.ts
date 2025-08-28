/**
 * Semantic Matcher Tests
 * 
 * Tests to verify the semantic matching functionality works as expected.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findSemanticMatch } from '../semantic-matcher';
import { 
  addExpansion, 
  removeExpansion, 
  listAllExpansions,
  enableSemanticMatching,
  disableSemanticMatching 
} from '../semantic-matcher-utils';

describe('Semantic Matcher', () => {
  beforeEach(() => {
    // Enable semantic matching before each test
    enableSemanticMatching();
  });

  afterEach(() => {
    // Clean up any custom expansions after each test
    removeExpansion('TEST');
  });

  describe('Basic Semantic Matching', () => {
    it('should match NDA to Non Disclosure Agreement', () => {
      const result = findSemanticMatch('NDA', 'This Non Disclosure Agreement shall remain in effect...');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('Non Disclosure Agreement');
    });

    it('should match Non Disclosure Agreement to NDA', () => {
      const result = findSemanticMatch('Non Disclosure Agreement', 'Please sign the NDA before proceeding.');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('NDA');
    });

    it('should match LLC to Limited Liability Company', () => {
      const result = findSemanticMatch('LLC', 'Acme Corporation is a Limited Liability Company.');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('Limited Liability Company');
    });

    it('should match CEO to Chief Executive Officer', () => {
      const result = findSemanticMatch('CEO', 'The Chief Executive Officer will sign the contract.');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('Chief Executive Officer');
    });

    it('should not match when no semantic match exists', () => {
      const result = findSemanticMatch('XYZ', 'This document contains no matching terms.');
      expect(result).toBeFalsy();
    });
  });

  describe('Number Formatting', () => {
    it('should match 4000000 to 4,000,000', () => {
      const result = findSemanticMatch('4000000', 'The total amount is 4,000,000 dollars.');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('4,000,000');
    });

    it('should match 4,000,000 to 4000000', () => {
      const result = findSemanticMatch('4,000,000', 'The contract value is 4000000 USD.');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('4000000');
    });

    it('should match 1000 to 1,000', () => {
      const result = findSemanticMatch('1000', 'The fee is 1,000 per month.');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('1,000');
    });

    it('should match 12.50 to 12.50', () => {
      const result = findSemanticMatch('12.50', 'The cost is 12.50 each.');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('12.50');
    });
  });

  describe('Management Utilities', () => {
    it('should add custom expansion', () => {
      const success = addExpansion('TEST', ['Test Expansion', 'Testing']);
      expect(success).toBe(true);
    });

    it('should find custom expansion after adding', () => {
      addExpansion('TEST', ['Test Expansion', 'Testing']);
      const result = findSemanticMatch('TEST', 'This is a Test Expansion document.');
      expect(result).toBeTruthy();
      expect(result?.matchedText).toBe('Test Expansion');
    });

    it('should remove custom expansion', () => {
      addExpansion('TEST', ['Test Expansion', 'Testing']);
      const removed = removeExpansion('TEST');
      expect(removed).toBe(true);
    });

    it('should not find custom expansion after removal', () => {
      addExpansion('TEST', ['Test Expansion', 'Testing']);
      removeExpansion('TEST');
      const result = findSemanticMatch('TEST', 'This is a Test Expansion document.');
      expect(result).toBeFalsy();
    });
  });

  describe('Enable/Disable Functionality', () => {
    it('should work when feature is enabled', () => {
      enableSemanticMatching();
      const result = findSemanticMatch('NDA', 'This Non Disclosure Agreement is important.');
      expect(result).toBeTruthy();
    });

    it('should not work when feature is disabled', () => {
      disableSemanticMatching();
      const result = findSemanticMatch('NDA', 'This Non Disclosure Agreement is important.');
      expect(result).toBeFalsy();
    });

    it('should work again after re-enabling', () => {
      disableSemanticMatching();
      enableSemanticMatching();
      const result = findSemanticMatch('NDA', 'This Non Disclosure Agreement is important.');
      expect(result).toBeTruthy();
    });
  });
}); 