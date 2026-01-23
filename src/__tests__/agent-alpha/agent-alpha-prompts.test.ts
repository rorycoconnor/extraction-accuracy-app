/**
 * Agent-Alpha Prompt Generation Tests
 * 
 * These tests verify the prompt building and parsing logic for Agent-Alpha.
 * The prompt generation is critical for the AI to understand what improvements to make.
 */

import { describe, test, expect } from 'vitest';
import {
  buildAgentAlphaPrompt,
  parseAgentAlphaPromptResponse,
} from '@/lib/agent-alpha-prompts';

describe('Agent-Alpha Prompt Generation', () => {
  
  describe('buildAgentAlphaPrompt', () => {
    test('should build a valid prompt with all required sections', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Company Name',
        fieldType: 'string',
        currentPrompt: 'Extract the company name',
        previousPrompts: [],
        failureExamples: [
          { docId: 'doc1', predicted: 'Acme', expected: 'Acme Corporation' },
        ],
        successExamples: [
          { docId: 'doc2', value: 'Beta Inc' },
        ],
        iterationNumber: 1,
        maxIterations: 5,
      });

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
      
      // Should contain field information
      expect(prompt).toContain('Company Name');
      
      // Should contain current prompt
      expect(prompt).toContain('Extract the company name');
      
      // Should contain failure example
      expect(prompt).toContain('Acme');
      expect(prompt).toContain('Acme Corporation');
    });

    test('should include iteration context', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Test Field',
        fieldType: 'string',
        currentPrompt: 'Test prompt',
        previousPrompts: ['Previous prompt 1', 'Previous prompt 2'],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 3,
        maxIterations: 5,
      });

      // Should indicate iteration number
      expect(prompt).toContain('3');
    });

    test('should include previous prompts for context', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Test Field',
        fieldType: 'string',
        currentPrompt: 'Current prompt',
        previousPrompts: ['First attempt', 'Second attempt'],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 3,
        maxIterations: 5,
      });

      // Should include previous attempts
      expect(prompt).toContain('First attempt');
      expect(prompt).toContain('Second attempt');
    });

    test('should handle different field types', () => {
      const stringPrompt = buildAgentAlphaPrompt({
        fieldName: 'Name',
        fieldType: 'string',
        currentPrompt: 'Extract name',
        previousPrompts: [],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
      });

      const datePrompt = buildAgentAlphaPrompt({
        fieldName: 'Date',
        fieldType: 'date',
        currentPrompt: 'Extract date',
        previousPrompts: [],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
      });

      const enumPrompt = buildAgentAlphaPrompt({
        fieldName: 'Status',
        fieldType: 'enum',
        currentPrompt: 'Extract status',
        previousPrompts: [],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
        options: [{ key: 'active' }, { key: 'inactive' }],
      });

      // Each should be valid
      expect(stringPrompt.length).toBeGreaterThan(50);
      expect(datePrompt.length).toBeGreaterThan(50);
      expect(enumPrompt.length).toBeGreaterThan(50);
      
      // Enum should include options
      expect(enumPrompt).toContain('active');
      expect(enumPrompt).toContain('inactive');
    });

    test('should include document type when provided', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Party Name',
        fieldType: 'string',
        currentPrompt: 'Extract party',
        previousPrompts: [],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
        documentType: 'NDA (Non-Disclosure Agreement)',
      });

      expect(prompt).toContain('NDA');
    });

    test('should include custom instructions when provided', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Field',
        fieldType: 'string',
        currentPrompt: 'Extract field',
        previousPrompts: [],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
        customInstructions: 'Always format as uppercase. Never include punctuation.',
      });

      expect(prompt).toContain('uppercase');
      expect(prompt).toContain('punctuation');
    });

    test('should handle empty failure and success examples', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Field',
        fieldType: 'string',
        currentPrompt: 'Extract field',
        previousPrompts: [],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
      });

      // Should still produce valid prompt
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    });

    test('should include multiple failure examples', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Field',
        fieldType: 'string',
        currentPrompt: 'Extract field',
        previousPrompts: [],
        failureExamples: [
          { docId: 'doc1', predicted: 'Wrong1', expected: 'Right1' },
          { docId: 'doc2', predicted: 'Wrong2', expected: 'Right2' },
          { docId: 'doc3', predicted: 'Wrong3', expected: 'Right3' },
        ],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
      });

      expect(prompt).toContain('Wrong1');
      expect(prompt).toContain('Right1');
      expect(prompt).toContain('Wrong2');
      expect(prompt).toContain('Right2');
    });
  });

  describe('parseAgentAlphaPromptResponse', () => {
    // NOTE: The parser has a minimum length requirement of 100 characters for prompts
    // to ensure quality. Short prompts trigger fallback behavior.
    
    const createLongPrompt = (base: string) => 
      `${base}. Look in the header section, signature blocks, and main body. Search for variations like "${base}", "The ${base}", and similar phrases. Return the exact value as it appears in the document. If not found, return "Not Present".`;

    test('should parse valid JSON response with long enough prompt', () => {
      const longPrompt = createLongPrompt('Look for company name');
      const response = JSON.stringify({
        newPrompt: longPrompt,
        reasoning: 'The original prompt was too vague',
      });

      const result = parseAgentAlphaPromptResponse(response, 'Company Name');

      expect(result.newPrompt).toBe(longPrompt);
      expect(result.reasoning).toBe('The original prompt was too vague');
    });

    test('should handle response with extra whitespace', () => {
      // Use JSON.stringify to properly escape the string
      const longPrompt = 'Extract the value from the document. Look in the header section, signature blocks, and main body. Search for variations and synonyms. Return the exact value as it appears in the document.';
      const response = JSON.stringify({
        newPrompt: longPrompt,
        reasoning: 'Added specificity',
      });
      // Add whitespace around it
      const responseWithWhitespace = `  \n  ${response}  \n  `;

      const result = parseAgentAlphaPromptResponse(responseWithWhitespace, 'Field');

      expect(result.newPrompt).toBe(longPrompt);
      expect(result.reasoning).toBe('Added specificity');
    });

    test('should use fallback for prompts under 100 characters', () => {
      // Short prompts trigger fallback behavior
      const response = '```json\n{"newPrompt": "Test prompt", "reasoning": "Test reason"}\n```';

      const result = parseAgentAlphaPromptResponse(response, 'Field');

      // Should return fallback prompt (which is longer)
      expect(result.newPrompt.length).toBeGreaterThan(100);
      expect(result.reasoning).toContain('fallback');
    });

    test('should handle response wrapped in markdown code blocks with valid prompt', () => {
      const longPrompt = 'Extract the field value. Look in the header section, signature blocks, and main body. Search for variations and synonyms. Return the exact value as it appears in the document.';
      const response = `\`\`\`json\n${JSON.stringify({ newPrompt: longPrompt, reasoning: 'Test reason' })}\n\`\`\``;

      const result = parseAgentAlphaPromptResponse(response, 'Field');

      expect(result.newPrompt).toBe(longPrompt);
      expect(result.reasoning).toBe('Test reason');
    });

    test('should provide fallback for invalid JSON', () => {
      const response = 'This is not valid JSON at all';

      const result = parseAgentAlphaPromptResponse(response, 'Company Name');

      // Should return a fallback prompt
      expect(typeof result.newPrompt).toBe('string');
      expect(result.newPrompt.length).toBeGreaterThan(100);
      expect(result.reasoning).toContain('fallback');
    });

    test('should handle empty response', () => {
      const response = '';

      const result = parseAgentAlphaPromptResponse(response, 'Field Name');

      // Should return fallback
      expect(typeof result.newPrompt).toBe('string');
      expect(result.newPrompt.length).toBeGreaterThan(100);
    });

    test('should handle response with missing newPrompt', () => {
      const response = JSON.stringify({
        reasoning: 'Only reasoning provided',
      });

      const result = parseAgentAlphaPromptResponse(response, 'Field');

      // Should return fallback prompt
      expect(typeof result.newPrompt).toBe('string');
      expect(result.newPrompt.length).toBeGreaterThan(100);
    });

    test('should handle response with missing reasoning (but valid long prompt)', () => {
      const longPrompt = createLongPrompt('Only prompt provided');
      const response = JSON.stringify({
        newPrompt: longPrompt,
      });

      const result = parseAgentAlphaPromptResponse(response, 'Field');

      expect(result.newPrompt).toBe(longPrompt);
      // Reasoning will have default value
      expect(typeof result.reasoning).toBe('string');
    });

    test('should handle escaped quotes in prompt', () => {
      // Prompt must be 150+ chars and have 3+ key elements: location, synonyms, format, not-found handling
      const longPrompt = 'Look for "Company Name" in quotes, search in the header section, signature blocks, and main body of the document. Also look for variations like "The Company Name" and "Company Name Inc". Return the exact value as found. If not found, return "Not Present".';
      const response = JSON.stringify({
        newPrompt: longPrompt,
        reasoning: 'Added quote handling',
      });

      const result = parseAgentAlphaPromptResponse(response, 'Field');

      expect(result.newPrompt).toContain('"Company Name"');
    });

    test('should handle newlines in prompt', () => {
      const longPrompt = 'Line 1: Search the header section for the value.\nLine 2: Look for variations and synonyms.\nLine 3: If not found in header, check the signature block and body text for the field value.';
      const response = JSON.stringify({
        newPrompt: longPrompt,
        reasoning: 'Multi-line prompt',
      });

      const result = parseAgentAlphaPromptResponse(response, 'Field');

      expect(result.newPrompt).toContain('Line 1');
      expect(result.newPrompt).toContain('Line 2');
      expect(result.newPrompt).toContain('Line 3');
    });

    test('should handle unicode characters', () => {
      const longPrompt = 'Extract the company name (公司名称) from the document. Search in the header, signature blocks, and main body. Look for variations in both English and Chinese. Return the exact value as it appears.';
      const response = JSON.stringify({
        newPrompt: longPrompt,
        reasoning: 'Added Chinese translation',
      });

      const result = parseAgentAlphaPromptResponse(response, 'Field');

      expect(result.newPrompt).toContain('公司名称');
    });

    test('should throw error when no field name provided and parsing fails', () => {
      const response = 'Invalid response';

      // When no fieldName is provided, it should throw
      expect(() => parseAgentAlphaPromptResponse(response)).toThrow();
    });
  });

  describe('Prompt quality requirements', () => {
    test('built prompt should request JSON output format', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Field',
        fieldType: 'string',
        currentPrompt: 'Extract',
        previousPrompts: [],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
      });

      // Should instruct AI to respond in JSON
      const lowerPrompt = prompt.toLowerCase();
      expect(lowerPrompt).toContain('json');
    });

    test('built prompt should include newPrompt and reasoning keys', () => {
      const prompt = buildAgentAlphaPrompt({
        fieldName: 'Field',
        fieldType: 'string',
        currentPrompt: 'Extract',
        previousPrompts: [],
        failureExamples: [],
        successExamples: [],
        iterationNumber: 1,
        maxIterations: 5,
      });

      expect(prompt).toContain('newPrompt');
      expect(prompt).toContain('reasoning');
    });
  });
});

