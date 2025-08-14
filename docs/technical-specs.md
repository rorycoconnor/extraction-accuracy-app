# Technical Specifications - Accuracy App

## Overview
The Accuracy App enables users to test and compare AI model performance for metadata extraction from documents, with a focus on iterative prompt refinement workflows.

## Core Architecture

### Data Management System

#### Unified Data Store (`src/store/AccuracyDataStore.tsx`)
**Purpose:** Centralized state management for all accuracy data, session tracking, and model selection.

**Key Features:**
- **Session-based tracking:** Each comparison session maintains its own runs and history
- **Result versioning:** Each comparison run is preserved with full results and metrics
- **Atomic updates:** Prevents race conditions and data overwrites
- **Auto-save:** Debounced persistence to localStorage and JSON files
- **Backward compatibility:** Seamless migration from legacy data structures

**State Structure:**
```typescript
interface UnifiedAccuracyData extends AccuracyData {
  currentSessionId?: string;
  sessions: ComparisonSession[];
  shownColumns: Record<string, boolean>; // Preserves model selection
  lastModified: string;
}

interface ComparisonSession {
  id: string;
  name: string;
  createdAt: string;
  lastModified: string;
  templateKey: string;
  baseModel: string;
  runs: ComparisonRun[];
}

interface ComparisonRun {
  id: string;
  sessionId: string;
  name: string;
  timestamp: string;
  promptVersions: Record<string, string>; // fieldKey -> promptVersionId
  results: FileResult[];
  averages: Record<string, any>;
  apiResults: ApiExtractionResult[];
  isActive: boolean;
}
```

**Key Actions:**
- `UPDATE_PROMPT`: Creates versioned prompt history
- `TOGGLE_COLUMN`: Manages model visibility
- `START_COMPARISON_RUN`: Initializes new comparison run
- `COMPLETE_COMPARISON_RUN`: Atomically stores results

#### Enhanced Comparison Runner (`src/hooks/use-enhanced-comparison-runner.tsx`)
**Purpose:** Handles comparison execution with proper versioning and atomic result processing.

**Key Features:**
- **Atomic result processing:** Prevents partial updates and overwrites
- **Model preservation:** Maintains existing results when running subset of models
- **Ground truth protection:** Keeps ground truth separate from API results
- **Progress tracking:** Real-time updates during comparison execution

**Critical Fix Applied:**
```typescript
// BEFORE: Race condition - ground truth could overwrite API results
const newData = JSON.parse(JSON.stringify(accuracyData));
// ... multiple async operations that could interfere

// AFTER: Atomic processing with explicit preservation
const processedResults = processExtractionResults(accuracyData, apiResults, runId, sessionId);
dispatch({ type: 'COMPLETE_COMPARISON_RUN', payload: processedResults });
```

### Data Flow Architecture

#### Legacy System (Backward Compatibility)
```typescript
// Old system still available as fallback
const fallbackData = useAccuracyData();
```

#### New System (Primary)
```typescript
// New unified system
const { state, dispatch } = useAccuracyDataStore();
const compatData = useAccuracyDataCompat();
```

#### Hybrid Integration (Current Production State)
```typescript
// Smart fallback ensures stability
const accuracyData = compatData?.accuracyData ?? fallbackAccuracyData;
const shownColumns = compatData?.shownColumns ?? fallbackShownColumns;
```

### Critical Bug Fixes Implemented

#### 1. Model Selection Persistence Bug
**Problem:** Selected models disappeared when saving prompts.

**Root Cause:** 
```typescript
// PROBLEMATIC CODE (Fixed)
function migrateToUnifiedData(legacyData: AccuracyData): UnifiedAccuracyData {
  return {
    ...legacyData,
    shownColumns: { 'Ground Truth': true }, // 🚨 WIPED OUT SELECTIONS
  };
}
```

**Solution:**
```typescript
// FIXED CODE
function migrateToUnifiedData(legacyData: AccuracyData): UnifiedAccuracyData {
  const preservedShownColumns = (legacyData as any).shownColumns || { 'Ground Truth': true };
  return {
    ...legacyData,
    shownColumns: preservedShownColumns, // ✅ PRESERVES SELECTIONS
  };
}
```

#### 2. Redundant Migration Prevention
**Problem:** Each prompt save created new duplicate sessions.

**Solution:**
```typescript
case 'SET_ACCURACY_DATA': {
  const isAlreadyUnified = state.data && 'sessions' in state.data;
  
  if (isAlreadyUnified) {
    // Update existing unified data without migration
    return { ...state.data!, ...action.payload };
  } else {
    // Only migrate if truly legacy data
    return migrateToUnifiedData(action.payload);
  }
}
```

### API Integration

#### Box AI Integration
- **Endpoint:** `/api/box-ai/extract_structured`
- **Models Supported:** 
  - `google__gemini_2_0_flash_001`
  - `enhanced_extract_agent` 
  - `aws__claude_3_7_sonnet`
  - `_no_prompt` variants for A/B testing

#### Concurrency Management
```typescript
const CONCURRENCY_LIMIT = 5;
await processWithConcurrency(extractionJobs, CONCURRENCY_LIMIT, extractionProcessor);
```

### Performance Characteristics

#### Memory Usage
- **State Size:** ~50KB for typical session (10 files, 5 models, 10 fields)
- **Session Storage:** Automatic cleanup of old sessions (configurable)
- **Debounced Saves:** 1000ms delay prevents excessive disk writes

#### Network Efficiency
- **Parallel Processing:** 5 concurrent Box AI API calls
- **Smart Caching:** Results preserved across prompt iterations
- **Partial Updates:** Only runs selected models, preserves others

### Error Handling

#### Comprehensive Error Boundaries
```typescript
interface ExtractionError {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  fileId?: string;
  modelName?: string;
  originalError?: Error;
  timestamp: Date;
}
```

#### Retry Logic
- **Max Retries:** 3 attempts
- **Backoff Strategy:** Exponential with jitter
- **Retryable Errors:** Network, timeout, rate-limit

### Security Considerations

#### Data Privacy
- **No Server Storage:** All data remains in browser localStorage
- **Box Authentication:** Secure token-based API access
- **No Data Transmission:** Results never sent to external servers

#### Input Validation
- **Template Validation:** Ensures Box template compatibility
- **File Validation:** Checks file accessibility before processing
- **Prompt Sanitization:** Prevents injection in prompts

### Testing Strategy

#### Integration Testing
```typescript
// Critical paths tested
✅ Model selection persistence through prompt changes
✅ Atomic result processing during concurrent operations  
✅ Session creation and management
✅ Backward compatibility with legacy data
```

#### Error Scenario Testing
```typescript
✅ API failures during comparison
✅ Concurrent ground truth updates
✅ Network interruptions
✅ Invalid template configurations
```

### Deployment Architecture

#### Production Readiness
- **Zero-downtime deployment:** Backward compatibility ensures smooth upgrades
- **Progressive enhancement:** New features activate automatically
- **Rollback safety:** Can disable new system via feature flag

#### Monitoring Points
```typescript
// Key metrics to track
- Comparison completion rates
- Error rates by model/template
- Session duration and iteration patterns  
- Performance metrics (time per extraction)
```

### Future Architecture Considerations

#### Phase 2 Refactoring Opportunities
1. **Complete Migration:** Remove legacy `useAccuracyData` hook
2. **Type Safety:** Implement strict TypeScript mode
3. **Component Decomposition:** Break down large components
4. **State Normalization:** Flatten nested data structures

#### Phase 3 Advanced Features
1. **Real-time Collaboration:** Multi-user sessions
2. **Advanced Versioning:** Branch/merge for prompts  
3. **Analytics Integration:** ML-driven prompt suggestions
4. **Performance Optimization:** Memoization and selective rendering

### Configuration

#### Environment Variables
```env
NEXT_PUBLIC_BOX_CLIENT_ID=your_box_client_id
BOX_CLIENT_SECRET=your_box_client_secret  
BOX_ENTERPRISE_ID=your_enterprise_id
```

#### Feature Flags
```typescript
const FEATURES = {
  ENHANCED_COMPARISON: true,    // New comparison runner
  SESSION_TRACKING: true,       // Session management
  AUTO_SAVE: true,             // Debounced persistence
  LEGACY_FALLBACK: true,       // Backward compatibility
};
```

## Conclusion

The current architecture successfully addresses the core iterative workflow requirements while maintaining production stability. The hybrid approach provides immediate value while preserving future refactoring opportunities.

**Status:** ✅ Production Ready  
**Confidence:** High - Core functionality thoroughly tested  
**Recommendation:** Deploy with monitoring for user feedback 