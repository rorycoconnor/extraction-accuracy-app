# AI Model Performance Metrics Specification

## Overview
This document defines the mathematical foundation for calculating and ranking AI model performance in metadata extraction tasks. The system compares multiple models across various document fields and provides field-level and overall performance metrics.

## Core Principles

1. **Single Source of Truth**: Ground truth data is the authoritative reference for all calculations
2. **Mathematical Consistency**: All metrics must satisfy their fundamental mathematical relationships
3. **Transparent Classification**: Every prediction must be clearly classified into TP/FP/FN/TN categories
4. **Fair Competition**: Ranking methodology must be consistent and unbiased across all models

## Classification System

### For Single-Value Fields (Most Common Case)
When a model makes exactly one prediction per field:

- **True Positive (TP)**: Prediction matches ground truth exactly
- **True Negative (TN)**: Both prediction and ground truth are "Not Present"
- **False Positive (FP)**: Model predicts a value when ground truth is "Not Present" 
- **False Negative (FN)**: Model fails to extract the correct value

### Critical Rule: Wrong Value Classification
When `prediction ≠ ground_truth` AND both are non-empty:
- Count as **BOTH** FP (predicted wrong value) AND FN (missed correct value)
- This prevents artificially inflated Precision scores

### Special Cases
- **Empty/Missing Ground Truth**: Treat as "Not Present"
- **Pending/Error States**: Exclude from calculations entirely
- **Case Sensitivity**: Use normalized text comparison with date format handling
- **Date Formats**: "2024-01-01" and "January 1, 2024" should match if they represent the same date

## Metrics Calculation

### Field-Level Metrics
For each field and model combination:

```
Precision = TP / (TP + FP)
Recall = TP / (TP + FN)  
F1 Score = 2 × (Precision × Recall) / (Precision + Recall)
Accuracy = (TP + TN) / (TP + FP + FN + TN)
```

### Overall Model Metrics (Macro Averaging)
```
Overall Precision = Σ(Field Precisions) / Number of Fields
Overall Recall = Σ(Field Recalls) / Number of Fields  
Overall F1 = Σ(Field F1 Scores) / Number of Fields
Overall Accuracy = Σ(Field Accuracies) / Number of Fields
```

**Important**: Include ALL fields in the average, even those with 0% scores. This prevents artificially inflated overall metrics.

## Validation Rules

### Mathematical Consistency Checks
1. **F1 Formula Validation**: `F1 = 2PR/(P+R)` must hold for individual fields
2. **Impossible Metrics Detection**: 
   - If Precision = 100% then FP must = 0
   - If Recall = 100% then FN must = 0
3. **Perfect "Not Present" Handling**: When all classifications are TN, metrics should be 100%

### Data Quality Checks
- All arrays (predictions, ground truths) must have equal length
- No field should have 0 total classifications after excluding pending/error states
- Overall metrics should never exceed individual field maximums (sanity check)

## Field Winner Determination

### Ranking Criteria (in order of precedence)
1. **F1 Score** (primary metric)
2. **Precision** (first tie-breaker)
3. **Recall** (second tie-breaker)

### Winner Classification
- **Sole Winner**: One model achieves best performance (Green badge)
- **Shared Victory**: Multiple models tie at best performance (Blue badge)
- **Universal Tie**: All models perform identically (Blue badge, no field wins awarded)

### Field Wins Counting
- **Sole Winner**: 1.0 win
- **Shared Victory**: 1/N wins (where N = number of tied winners)
- **Universal Tie**: 0 wins (prevents inflation when all models perform equally)

## Model Ranking System

### Primary Ranking Metric
Models ranked by **Overall F1 Score** (macro-averaged across all fields)

### Tie-Breaking Hierarchy
1. Overall F1 Score
2. Overall Precision  
3. Overall Recall
4. Total Field Wins
5. Alphabetical order (final fallback)

### Ranking Display
- **Rank #1, #2, #3, etc.**
- **Field Win Count**: "Won X of Y fields" (whole numbers preferred)
- **Performance Tier Badges**: Excellent (≥90%), Good (≥70%), Needs Improvement (<70%)

## Example Calculations

### Scenario: Contract Type Extraction
**Documents**: 3 contracts  
**Ground Truth**: ["Service Agreement", "NDA", "Not Present"]  
**Model A Predictions**: ["Service Agreement", "License Agreement", "Not Present"]  
**Model B Predictions**: ["Service Agreement", "NDA", "Employment Agreement"]

#### Model A Classification:
- Document 1: "Service Agreement" = "Service Agreement" → **TP**
- Document 2: "License Agreement" ≠ "NDA" → **FP + FN** (wrong value)
- Document 3: "Not Present" = "Not Present" → **TN**

**Model A Counts**: TP=1, FP=1, FN=1, TN=1  
**Model A Metrics**:
- Precision = 1/(1+1) = 50%
- Recall = 1/(1+1) = 50%  
- F1 = 2×(0.5×0.5)/(0.5+0.5) = 50%
- Accuracy = (1+1)/(1+1+1+1) = 50%

#### Model B Classification:
- Document 1: "Service Agreement" = "Service Agreement" → **TP**
- Document 2: "NDA" = "NDA" → **TP**
- Document 3: "Employment Agreement" ≠ "Not Present" → **FP** (predicted value when should be empty)

**Model B Counts**: TP=2, FP=1, FN=0, TN=0  
**Model B Metrics**:
- Precision = 2/(2+1) = 67%
- Recall = 2/(2+0) = 100%
- F1 = 2×(0.67×1.0)/(0.67+1.0) = 80%
- Accuracy = (2+0)/(2+1+0+0) = 67%

#### Field Winner: Model B (F1: 80% > 50%)

### Scenario: Perfect "Not Present" Field
**Documents**: 2 contracts  
**Ground Truth**: ["Not Present", "Not Present"]  
**Model Predictions**: ["Not Present", "Not Present"]

**Classification**: TP=0, FP=0, FN=0, TN=2  
**Special Case Handling**: All metrics = 100% (perfect identification of absence)

## Common Troubleshooting

### When Metrics Seem Wrong

#### 1. **Precision = 100% but some fields are clearly wrong**
**Check**: Are wrong predictions being classified as both FP and FN?
```javascript
// Wrong - only counts FN
if (prediction !== groundTruth) falseNegatives++;

// Correct - counts both FP and FN for wrong values
if (prediction !== groundTruth && both_non_empty) {
  falsePositives++;
  falseNegatives++;
}
```

#### 2. **Overall F1 ≠ 2PR/(P+R) formula**
**Check**: Are you mixing averaging methods?
- Field-level F1s should be averaged (macro)
- Overall P/R should also be averaged the same way
- Don't mix micro averaging with macro averaging

#### 3. **Model shows 5.7 field wins instead of whole numbers**
**Check**: Are universal ties (all models equal) awarding fractional wins?
```javascript
// Wrong - awards fractional wins even when all models tie
if (bestF1 > 0) awardWins();

// Correct - only award wins when there's performance difference  
if (bestF1 > 0 && winners.length < totalModels) awardWins();
```

#### 4. **Metrics = 0% when they should be 100%**
**Check**: Perfect "Not Present" detection edge case
```javascript
// Handle case where all classifications are True Negatives
if (TP==0 && FP==0 && FN==0 && TN>0) {
  precision = recall = f1 = 1.0; // 100%
}
```

#### 5. **F1 scores don't match individual field calculations**
**Debugging Steps**:
1. Log confusion matrix for each field: `TP=${tp}, FP=${fp}, FN=${fn}, TN=${tn}`
2. Verify F1 formula for each field: `F1 = 2×${precision}×${recall}/(${precision}+${recall})`
3. Check that no fields are excluded from averaging
4. Ensure ground truth data is loaded correctly

#### 6. **Performance changes after ground truth edits**
**Solution**: Implement metrics recalculation
- Add "Recalculate Metrics" button to performance modal
- Reload ground truth from localStorage
- Recalculate all field-level metrics
- Update averages and rankings

### Validation Queries for QA

#### Test Data Sets
1. **All Perfect Matches**: All predictions = ground truth → Should get 100% across all metrics
2. **All "Not Present"**: Both predictions and ground truth empty → Should get 100% across all metrics  
3. **All Wrong Values**: Every prediction ≠ ground truth → Precision and Recall should be low
4. **Mixed Performance**: Some correct, some wrong → Metrics should be between 0-100%

#### Manual Verification
```javascript
// For any field, verify this relationship holds:
const expectedF1 = (2 * precision * recall) / (precision + recall);
console.assert(Math.abs(f1 - expectedF1) < 0.001, 'F1 formula violation');

// For overall metrics, verify macro averaging:
const expectedOverallF1 = fieldF1s.reduce((sum, f1) => sum + f1, 0) / fieldF1s.length;
console.assert(Math.abs(overallF1 - expectedOverallF1) < 0.001, 'Macro averaging violation');
```

## Quality Assurance

### Debug Information Required
- Confusion matrix totals (TP, FP, FN, TN) for each field/model
- Examples of each classification type
- Field-level vs overall metric consistency validation
- Warning flags for impossible metric combinations

### Recalculation Triggers
- Ground truth data modifications
- Model result updates
- Template field changes
- Manual user request ("Recalculate Metrics" button)

## Edge Cases

### Perfect "Not Present" Classification
When all field values are correctly identified as "Not Present":
- TP=0, FP=0, FN=0, TN>0
- Set Precision=100%, Recall=100%, F1=100% (override division by zero)

### No Valid Classifications
When all predictions are pending/error:
- Return 0% for all metrics
- Exclude field from overall averaging

### Single Document Testing  
Metrics still valid but confidence intervals would be wide - consider adding warnings for small sample sizes.

## Implementation Notes

### Storage Format
```typescript
FieldAverage = {
  accuracy: number;    // 0.0 to 1.0
  precision: number;   // 0.0 to 1.0  
  recall: number;      // 0.0 to 1.0
  f1: number;         // 0.0 to 1.0
}
```

### Display Format
- Percentages rounded to 1 decimal place
- Field wins displayed as whole numbers when possible
- Color coding: Green (excellent), Yellow (good), Red (poor)

### Performance Considerations
- Cache calculated metrics until ground truth changes
- Use efficient array operations for large document sets
- Consider lazy loading for metrics that aren't immediately visible

---

This specification ensures mathematically sound, consistent, and interpretable performance metrics for your AI model comparison system. 