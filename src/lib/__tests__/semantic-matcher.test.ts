/**
 * Semantic Matcher Tests
 * 
 * Simple tests to verify the semantic matching functionality works as expected.
 * Run these in your console to test the feature.
 */

import { findSemanticMatch } from '../semantic-matcher';
import { 
  addExpansion, 
  removeExpansion, 
  listAllExpansions,
  enableSemanticMatching,
  disableSemanticMatching 
} from '../semantic-matcher-utils';

// Test cases for common scenarios
export const TEST_CASES = [
  {
    name: 'NDA → Non Disclosure Agreement',
    pattern: 'NDA',
    text: 'This Non Disclosure Agreement shall remain in effect...',
    expectedMatch: true,
    expectedText: 'Non Disclosure Agreement'
  },
  {
    name: 'Non Disclosure Agreement → NDA',
    pattern: 'Non Disclosure Agreement',
    text: 'Please sign the NDA before proceeding.',
    expectedMatch: true,
    expectedText: 'NDA'
  },
  {
    name: 'LLC → Limited Liability Company',
    pattern: 'LLC',
    text: 'Acme Corporation is a Limited Liability Company.',
    expectedMatch: true,
    expectedText: 'Limited Liability Company'
  },
  {
    name: 'CEO → Chief Executive Officer',
    pattern: 'CEO',
    text: 'The Chief Executive Officer will sign the contract.',
    expectedMatch: true,
    expectedText: 'Chief Executive Officer'
  },
  {
    name: 'No match case',
    pattern: 'XYZ',
    text: 'This document contains no matching terms.',
    expectedMatch: false,
    expectedText: null
  },
  {
    name: 'Number formatting: 4000000 → 4,000,000',
    pattern: '4000000',
    text: 'The total amount is 4,000,000 dollars.',
    expectedMatch: true,
    expectedText: '4,000,000'
  },
  {
    name: 'Number formatting: 4,000,000 → 4000000',
    pattern: '4,000,000',
    text: 'The contract value is 4000000 USD.',
    expectedMatch: true,
    expectedText: '4000000'
  },
  {
    name: 'Number formatting: 1000 → 1,000',
    pattern: '1000',
    text: 'The fee is 1,000 per month.',
    expectedMatch: true,
    expectedText: '1,000'
  },
  {
    name: 'Number formatting: 12.50 → 12.50',
    pattern: '12.50',
    text: 'The cost is 12.50 each.',
    expectedMatch: true,
    expectedText: '12.50'
  }
];

/**
 * Run all test cases
 */
export function runSemanticMatchingTests(): void {
  console.log('🧪 SEMANTIC MATCHING TESTS\n');
  
  let passedTests = 0;
  let totalTests = TEST_CASES.length;
  
  TEST_CASES.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    
    const result = findSemanticMatch(testCase.pattern, testCase.text);
    
    if (testCase.expectedMatch) {
      if (result && result.matchedText === testCase.expectedText) {
        console.log(`✅ PASS - Found: "${result.matchedText}"`);
        passedTests++;
      } else {
        console.log(`❌ FAIL - Expected: "${testCase.expectedText}", Got: ${result ? `"${result.matchedText}"` : 'null'}`);
      }
    } else {
      if (!result) {
        console.log('✅ PASS - No match found (as expected)');
        passedTests++;
      } else {
        console.log(`❌ FAIL - Expected no match, but found: "${result.matchedText}"`);
      }
    }
    console.log('');
  });
  
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Semantic matching is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the implementation.');
  }
}

/**
 * Test the management utilities
 */
export function testManagementUtilities(): void {
  console.log('🛠️  TESTING MANAGEMENT UTILITIES\n');
  
  // Test adding custom expansion
  console.log('1. Adding custom expansion...');
  const success = addExpansion('TEST', ['Test Expansion', 'Testing']);
  console.log(success ? '✅ Added successfully' : '❌ Failed to add');
  
  // Test the new expansion
  console.log('\n2. Testing custom expansion...');
  const result = findSemanticMatch('TEST', 'This is a Test Expansion document.');
  console.log(result ? `✅ Found: "${result.matchedText}"` : '❌ Custom expansion not working');
  
  // Test removal
  console.log('\n3. Removing custom expansion...');
  const removed = removeExpansion('TEST');
  console.log(removed ? '✅ Removed successfully' : '❌ Failed to remove');
  
  // Verify removal
  console.log('\n4. Verifying removal...');
  const resultAfterRemoval = findSemanticMatch('TEST', 'This is a Test Expansion document.');
  console.log(!resultAfterRemoval ? '✅ Correctly removed' : '❌ Still finding matches');
  
  console.log('\n✅ Management utilities test complete');
}

/**
 * Test enable/disable functionality
 */
export function testEnableDisable(): void {
  console.log('🔄 TESTING ENABLE/DISABLE FUNCTIONALITY\n');
  
  // Test with feature enabled
  console.log('1. Testing with feature enabled...');
  enableSemanticMatching();
  const enabledResult = findSemanticMatch('NDA', 'This Non Disclosure Agreement is important.');
  console.log(enabledResult ? '✅ Working when enabled' : '❌ Not working when enabled');
  
  // Test with feature disabled
  console.log('\n2. Testing with feature disabled...');
  disableSemanticMatching();
  const disabledResult = findSemanticMatch('NDA', 'This Non Disclosure Agreement is important.');
  console.log(!disabledResult ? '✅ Correctly disabled' : '❌ Still working when disabled');
  
  // Re-enable for other tests
  console.log('\n3. Re-enabling feature...');
  enableSemanticMatching();
  const reEnabledResult = findSemanticMatch('NDA', 'This Non Disclosure Agreement is important.');
  console.log(reEnabledResult ? '✅ Successfully re-enabled' : '❌ Failed to re-enable');
  
  console.log('\n✅ Enable/disable test complete');
}

/**
 * Run all tests
 */
export function runAllTests(): void {
  console.log('🚀 RUNNING ALL SEMANTIC MATCHING TESTS\n');
  console.log('=' .repeat(50));
  
  runSemanticMatchingTests();
  console.log('\n' + '=' .repeat(50));
  
  testManagementUtilities();
  console.log('\n' + '=' .repeat(50));
  
  testEnableDisable();
  console.log('\n' + '=' .repeat(50));
  
  console.log('\n🎯 ALL TESTS COMPLETE');
  console.log('\nTo see current expansions, run: listAllExpansions()');
}

// Export for easy console usage
export { runAllTests as test };

/**
 * Quick demo for console usage
 */
export function quickDemo(): void {
  console.log('🎬 SEMANTIC MATCHING QUICK DEMO\n');
  
  const demos = [
    { pattern: 'NDA', text: 'Please review the Non Disclosure Agreement.' },
    { pattern: 'LLC', text: 'Acme Corp is a Limited Liability Company.' },
    { pattern: 'CEO', text: 'The Chief Executive Officer approved this.' },
    { pattern: 'Corporation', text: 'ABC Corp specializes in software.' },
    { pattern: '4000000', text: 'The contract value is 4,000,000 USD.' },
    { pattern: '1,500', text: 'Monthly fee: 1500 dollars.' }
  ];
  
  demos.forEach((demo, index) => {
    console.log(`Demo ${index + 1}: Looking for "${demo.pattern}" in:`);
    console.log(`"${demo.text}"`);
    
    const result = findSemanticMatch(demo.pattern, demo.text);
    if (result) {
      console.log(`✅ Found semantic match: "${result.matchedText}" (${result.matchType})`);
    } else {
      console.log('❌ No semantic match found');
    }
    console.log('');
  });
  
  console.log('💡 Try adding your own: addExpansion("API", "Application Programming Interface")');
} 