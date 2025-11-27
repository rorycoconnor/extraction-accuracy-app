/**
 * Agent-Alpha Configuration Tests
 * 
 * These tests verify the configuration constants and defaults for Agent-Alpha.
 * They serve as a contract that any implementation (TypeScript or Python) must satisfy.
 */

import { describe, test, expect } from 'vitest';
import {
  AGENT_ALPHA_CONFIG,
  DEFAULT_AGENT_SYSTEM_PROMPT,
  DEFAULT_PROMPT_GENERATION_INSTRUCTIONS,
  getDefaultRuntimeConfig,
  type AgentAlphaRuntimeConfig,
} from '@/lib/agent-alpha-config';

describe('Agent-Alpha Configuration', () => {
  
  describe('AGENT_ALPHA_CONFIG constants', () => {
    test('should have valid MAX_DOCS value', () => {
      expect(AGENT_ALPHA_CONFIG.MAX_DOCS).toBeGreaterThan(0);
      expect(AGENT_ALPHA_CONFIG.MAX_DOCS).toBeLessThanOrEqual(20);
      expect(typeof AGENT_ALPHA_CONFIG.MAX_DOCS).toBe('number');
    });

    test('should have valid MAX_ITERATIONS value', () => {
      expect(AGENT_ALPHA_CONFIG.MAX_ITERATIONS).toBeGreaterThan(0);
      expect(AGENT_ALPHA_CONFIG.MAX_ITERATIONS).toBeLessThanOrEqual(20);
      expect(typeof AGENT_ALPHA_CONFIG.MAX_ITERATIONS).toBe('number');
    });

    test('should have TARGET_ACCURACY of 1.0 (100%)', () => {
      expect(AGENT_ALPHA_CONFIG.TARGET_ACCURACY).toBe(1.0);
    });

    test('should have a valid PROMPT_GEN_MODEL', () => {
      expect(typeof AGENT_ALPHA_CONFIG.PROMPT_GEN_MODEL).toBe('string');
      expect(AGENT_ALPHA_CONFIG.PROMPT_GEN_MODEL.length).toBeGreaterThan(0);
    });

    test('should have reasonable API_TIMEOUT_MS', () => {
      expect(AGENT_ALPHA_CONFIG.API_TIMEOUT_MS).toBeGreaterThanOrEqual(10000);
      expect(AGENT_ALPHA_CONFIG.API_TIMEOUT_MS).toBeLessThanOrEqual(120000);
    });

    test('should have valid DEFAULT_TEST_MODEL', () => {
      expect(typeof AGENT_ALPHA_CONFIG.DEFAULT_TEST_MODEL).toBe('string');
      expect(AGENT_ALPHA_CONFIG.DEFAULT_TEST_MODEL.length).toBeGreaterThan(0);
    });

    test('should have valid EXTRACTION_CONCURRENCY', () => {
      expect(AGENT_ALPHA_CONFIG.EXTRACTION_CONCURRENCY).toBeGreaterThan(0);
      expect(AGENT_ALPHA_CONFIG.EXTRACTION_CONCURRENCY).toBeLessThanOrEqual(20);
    });

    test('should have valid FIELD_CONCURRENCY', () => {
      expect(AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY).toBeGreaterThan(0);
      expect(AGENT_ALPHA_CONFIG.FIELD_CONCURRENCY).toBeLessThanOrEqual(10);
    });
  });

  describe('DEFAULT_AGENT_SYSTEM_PROMPT', () => {
    test('should be a non-empty string', () => {
      expect(typeof DEFAULT_AGENT_SYSTEM_PROMPT).toBe('string');
      expect(DEFAULT_AGENT_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    test('should contain key instruction elements', () => {
      const prompt = DEFAULT_AGENT_SYSTEM_PROMPT.toLowerCase();
      
      // Should mention being specific
      expect(prompt).toContain('specific');
      
      // Should mention where to look
      expect(prompt).toContain('where');
      
      // Should mention output format
      expect(prompt).toContain('format');
      
      // Should mention handling not found cases
      expect(prompt).toContain('not found');
    });
  });

  describe('DEFAULT_PROMPT_GENERATION_INSTRUCTIONS', () => {
    test('should be a non-empty string', () => {
      expect(typeof DEFAULT_PROMPT_GENERATION_INSTRUCTIONS).toBe('string');
      expect(DEFAULT_PROMPT_GENERATION_INSTRUCTIONS.length).toBeGreaterThan(200);
    });

    test('should contain JSON response format instructions', () => {
      const instructions = DEFAULT_PROMPT_GENERATION_INSTRUCTIONS;
      
      // Should specify JSON output
      expect(instructions.toLowerCase()).toContain('json');
      
      // Should specify the expected structure
      expect(instructions).toContain('newPrompt');
      expect(instructions).toContain('reasoning');
    });

    test('should contain quality criteria', () => {
      const instructions = DEFAULT_PROMPT_GENERATION_INSTRUCTIONS.toLowerCase();
      
      // Should mention key quality criteria
      expect(instructions).toContain('specific');
      expect(instructions).toContain('synonym');
    });
  });

  describe('getDefaultRuntimeConfig', () => {
    test('should return a valid AgentAlphaRuntimeConfig', () => {
      const config = getDefaultRuntimeConfig();
      
      expect(config).toBeDefined();
      expect(typeof config.maxDocs).toBe('number');
      expect(typeof config.maxIterations).toBe('number');
      expect(typeof config.testModel).toBe('string');
    });

    test('should use values from AGENT_ALPHA_CONFIG', () => {
      const config = getDefaultRuntimeConfig();
      
      expect(config.maxDocs).toBe(AGENT_ALPHA_CONFIG.MAX_DOCS);
      expect(config.maxIterations).toBe(AGENT_ALPHA_CONFIG.MAX_ITERATIONS);
      expect(config.testModel).toBe(AGENT_ALPHA_CONFIG.DEFAULT_TEST_MODEL);
    });

    test('should have optional overrides as undefined by default', () => {
      const config = getDefaultRuntimeConfig();
      
      expect(config.systemPromptOverride).toBeUndefined();
      expect(config.customInstructions).toBeUndefined();
    });

    test('should return a new object each time (not shared reference)', () => {
      const config1 = getDefaultRuntimeConfig();
      const config2 = getDefaultRuntimeConfig();
      
      expect(config1).not.toBe(config2);
      
      // Mutating one should not affect the other
      config1.maxDocs = 999;
      expect(config2.maxDocs).toBe(AGENT_ALPHA_CONFIG.MAX_DOCS);
    });
  });

  describe('AgentAlphaRuntimeConfig type contract', () => {
    test('should accept valid configuration', () => {
      const validConfig: AgentAlphaRuntimeConfig = {
        maxDocs: 5,
        maxIterations: 3,
        testModel: 'test-model',
        systemPromptOverride: 'Custom system prompt',
        customInstructions: 'Custom instructions',
      };
      
      expect(validConfig.maxDocs).toBe(5);
      expect(validConfig.maxIterations).toBe(3);
      expect(validConfig.testModel).toBe('test-model');
      expect(validConfig.systemPromptOverride).toBe('Custom system prompt');
      expect(validConfig.customInstructions).toBe('Custom instructions');
    });

    test('should allow optional fields to be undefined', () => {
      const minimalConfig: AgentAlphaRuntimeConfig = {
        maxDocs: 3,
        maxIterations: 5,
        testModel: 'model',
      };
      
      expect(minimalConfig.systemPromptOverride).toBeUndefined();
      expect(minimalConfig.customInstructions).toBeUndefined();
    });
  });
});

