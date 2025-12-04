import { describe, test, expect } from 'vitest';
import { validateEnumValue, validateMultiSelectValue } from '@/lib/enum-validator';
import { NOT_PRESENT_VALUE } from '@/lib/utils';

describe('Enum Validator - Single Select', () => {
  const countryOptions = [
    { key: 'USA' },
    { key: 'United Kingdom' },
    { key: 'Japan' },
    { key: 'Germany' },
    { key: 'France' },
  ];

  test('should match exact value', () => {
    const result = validateEnumValue('USA', countryOptions, 'test_field');
    expect(result).toBe('USA');
  });

  test('should match case-insensitive', () => {
    const result = validateEnumValue('usa', countryOptions, 'test_field');
    expect(result).toBe('USA');
  });

  test('should match with fuzzy matching for common abbreviations', () => {
    // "USA" should match even if extracted as "United States"
    const options = [{ key: 'USA' }, { key: 'UK' }];
    const result = validateEnumValue('United States', options, 'test_field');
    expect(result).toBe('USA');
  });

  test('should match UK variations', () => {
    const result = validateEnumValue('United Kingdom', countryOptions, 'test_field');
    expect(result).toBe('United Kingdom');
  });

  test('should return NOT_PRESENT for no match', () => {
    const result = validateEnumValue('Canada', countryOptions, 'test_field');
    expect(result).toBe(NOT_PRESENT_VALUE);
  });

  test('should handle empty value', () => {
    const result = validateEnumValue('', countryOptions, 'test_field');
    expect(result).toBe(NOT_PRESENT_VALUE);
  });

  test('should handle null value', () => {
    const result = validateEnumValue(null, countryOptions, 'test_field');
    expect(result).toBe(NOT_PRESENT_VALUE);
  });

  test('should handle undefined value', () => {
    const result = validateEnumValue(undefined, countryOptions, 'test_field');
    expect(result).toBe(NOT_PRESENT_VALUE);
  });
});

describe('Enum Validator - Multi Select', () => {
  const countryOptions = [
    { key: 'USA' },
    { key: 'United Kingdom' },
    { key: 'Japan' },
    { key: 'Germany' },
    { key: 'France' },
  ];

  test('should validate pipe-separated values', () => {
    const result = validateMultiSelectValue('USA | Japan', countryOptions, 'test_field');
    expect(result).toBe('USA | Japan');
  });

  test('should validate comma-separated values', () => {
    const result = validateMultiSelectValue('USA, Japan', countryOptions, 'test_field');
    expect(result).toBe('USA | Japan');
  });

  test('should validate array of values', () => {
    const result = validateMultiSelectValue(['USA', 'Japan'], countryOptions, 'test_field');
    expect(result).toBe('USA | Japan');
  });

  test('should handle case-insensitive matching', () => {
    const result = validateMultiSelectValue('usa | japan', countryOptions, 'test_field');
    expect(result).toBe('USA | Japan');
  });

  test('should filter out invalid values', () => {
    const result = validateMultiSelectValue('USA | Canada | Japan', countryOptions, 'test_field');
    // Canada is not in options, should be filtered out
    expect(result).toBe('USA | Japan');
  });

  test('should return NOT_PRESENT when no values match', () => {
    const result = validateMultiSelectValue('Canada | Australia', countryOptions, 'test_field');
    expect(result).toBe(NOT_PRESENT_VALUE);
  });

  test('should handle empty value', () => {
    const result = validateMultiSelectValue('', countryOptions, 'test_field');
    expect(result).toBe(NOT_PRESENT_VALUE);
  });

  test('should handle fuzzy matching in multi-select', () => {
    const options = [{ key: 'USA' }, { key: 'UK' }];
    const result = validateMultiSelectValue('United States | United Kingdom', options, 'test_field');
    expect(result).toBe('USA | UK');
  });
});

describe('Enum Validator - Real-World Scenarios', () => {
  test('should handle country codes vs full names', () => {
    const options = [
      { key: 'USA' },
      { key: 'JPN' },
      { key: 'DEU' },
      { key: 'GBR' },
    ];

    expect(validateEnumValue('United States', options, 'country')).toBe('USA');
    expect(validateEnumValue('Japan', options, 'country')).toBe('JPN');
    expect(validateEnumValue('Germany', options, 'country')).toBe('DEU');
    expect(validateEnumValue('United Kingdom', options, 'country')).toBe('GBR');
  });

  test('should handle contract types', () => {
    const options = [
      { key: 'Service Agreement' },
      { key: 'NDA' },
      { key: 'Purchase Agreement' },
    ];

    expect(validateEnumValue('Service Agreement', options, 'contract_type')).toBe('Service Agreement');
    expect(validateEnumValue('service agreement', options, 'contract_type')).toBe('Service Agreement');
    expect(validateEnumValue('NDA', options, 'contract_type')).toBe('NDA');
  });

  test('should handle yes/no fields', () => {
    const options = [
      { key: 'Yes' },
      { key: 'No' },
    ];

    expect(validateEnumValue('Yes', options, 'termination')).toBe('Yes');
    expect(validateEnumValue('yes', options, 'termination')).toBe('Yes');
    expect(validateEnumValue('NO', options, 'termination')).toBe('No');
  });
});

