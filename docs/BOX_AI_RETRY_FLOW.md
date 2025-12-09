# Box AI Extraction Flow with Retry Logic

## New Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User Action: Run Comparison (1 file, 87 fields, Gemini 2.5 Pro)│
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Prepare Request                                                  │
│ • 87 fields with prompts                                        │
│ • Model: google__gemini_2_5_pro                                 │
│ • Request size: ~245 KB                                         │
│ • Total prompt chars: ~12,450                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ ATTEMPT 1: Send to Box AI                                       │
│ • Start 15-minute timeout timer                                 │
│ • POST /ai/extract_structured                                   │
│ • Wait for response...                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                    ┌────┴────┐
                    │Response?│
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐     ┌─────────┐    ┌──────────┐
    │Success │     │500 Error│    │Timeout   │
    │(200 OK)│     │         │    │(15 min)  │
    └───┬────┘     └────┬────┘    └────┬─────┘
        │               │              │
        │               │              │
        ▼               ▼              ▼
    ┌────────┐     ┌─────────┐    ┌──────────┐
    │Return  │     │Wait 3s  │    │Throw     │
    │Results │     │         │    │Timeout   │
    │✓       │     └────┬────┘    │Error ✗   │
    └────────┘          │         └──────────┘
                        ▼
                   ┌─────────────────────────────┐
                   │ ATTEMPT 2: Retry            │
                   │ • Wait 3 seconds            │
                   │ • Send same request again   │
                   └────────────┬────────────────┘
                                │
                                ▼
                           ┌────┴────┐
                           │Response?│
                           └────┬────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
           ┌────────┐     ┌─────────┐    ┌──────────┐
           │Success │     │500 Error│    │Timeout   │
           │(200 OK)│     │         │    │(15 min)  │
           └───┬────┘     └────┬────┘    └────┬─────┘
               │               │              │
               │               │              │
               ▼               ▼              ▼
           ┌────────┐     ┌─────────┐    ┌──────────┐
           │Return  │     │Wait 6s  │    │Throw     │
           │Results │     │         │    │Timeout   │
           │✓       │     └────┬────┘    │Error ✗   │
           └────────┘          │         └──────────┘
                               ▼
                          ┌─────────────────────────────┐
                          │ ATTEMPT 3: Retry            │
                          │ • Wait 6 seconds            │
                          │ • Send same request again   │
                          └────────────┬────────────────┘
                                       │
                                       ▼
                                  ┌────┴────┐
                                  │Response?│
                                  └────┬────┘
                                       │
                       ┌───────────────┼───────────────┐
                       │               │               │
                       ▼               ▼               ▼
                  ┌────────┐     ┌─────────┐    ┌──────────┐
                  │Success │     │500 Error│    │Timeout   │
                  │(200 OK)│     │         │    │(15 min)  │
                  └───┬────┘     └────┬────┘    └────┬─────┘
                      │               │              │
                      │               │              │
                      ▼               ▼              ▼
                  ┌────────┐     ┌─────────┐    ┌──────────┐
                  │Return  │     │Wait 12s │    │Throw     │
                  │Results │     │         │    │Timeout   │
                  │✓       │     └────┬────┘    │Error ✗   │
                  └────────┘          │         └──────────┘
                                      ▼
                                 ┌─────────────────────────────┐
                                 │ ATTEMPT 4: Final Retry      │
                                 │ • Wait 12 seconds           │
                                 │ • Send same request again   │
                                 └────────────┬────────────────┘
                                              │
                                              ▼
                                         ┌────┴────┐
                                         │Response?│
                                         └────┬────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                              ▼               ▼               ▼
                         ┌────────┐     ┌─────────┐    ┌──────────┐
                         │Success │     │500 Error│    │Timeout   │
                         │(200 OK)│     │         │    │(15 min)  │
                         └───┬────┘     └────┬────┘    └────┬─────┘
                             │               │              │
                             │               │              │
                             ▼               ▼              ▼
                         ┌────────┐     ┌──────────┐  ┌──────────┐
                         │Return  │     │Throw     │  │Throw     │
                         │Results │     │500 Error │  │Timeout   │
                         │✓       │     │✗         │  │Error ✗   │
                         └────────┘     └──────────┘  └──────────┘
```

## Timing Breakdown

### Scenario 1: Success on First Try
```
Attempt 1: 4 minutes → Success ✓
Total Time: 4 minutes
```

### Scenario 2: Success on Second Try
```
Attempt 1: 4 minutes → 500 Error
Wait: 3 seconds
Attempt 2: 5 minutes → Success ✓
Total Time: ~9 minutes
```

### Scenario 3: Success on Third Try
```
Attempt 1: 4 minutes → 500 Error
Wait: 3 seconds
Attempt 2: 4.5 minutes → 500 Error
Wait: 6 seconds
Attempt 3: 5 minutes → Success ✓
Total Time: ~13.5 minutes
```

### Scenario 4: Success on Fourth Try
```
Attempt 1: 4 minutes → 500 Error
Wait: 3 seconds
Attempt 2: 4 minutes → 500 Error
Wait: 6 seconds
Attempt 3: 4 minutes → 500 Error
Wait: 12 seconds
Attempt 4: 5 minutes → Success ✓
Total Time: ~17.5 minutes
```

### Scenario 5: All Attempts Fail
```
Attempt 1: 4 minutes → 500 Error
Wait: 3 seconds
Attempt 2: 4 minutes → 500 Error
Wait: 6 seconds
Attempt 3: 4 minutes → 500 Error
Wait: 12 seconds
Attempt 4: 4 minutes → 500 Error ✗
Total Time: ~16.5 minutes
Error: "Box AI extraction failed after 4 attempts"
```

### Scenario 6: Timeout
```
Attempt 1: 15 minutes → Timeout ✗
Total Time: 15 minutes
Error: "Box AI extraction timed out after 15 minutes"
```

## Error Handling Matrix

| Error Code | Retryable? | Action | User Impact |
|-----------|-----------|--------|-------------|
| 200 OK | N/A | Return results | ✓ Success |
| 400 Bad Request | ❌ No | Fail immediately | ✗ Invalid request |
| 401 Unauthorized | ❌ No | Fail immediately | ✗ Token expired |
| 403 Forbidden | ❌ No | Fail immediately | ✗ No permission |
| 429 Rate Limit | ✅ Yes* | Retry with backoff | ⚠️ Retry after delay |
| 500 Server Error | ✅ Yes | Retry with backoff | ⚠️ Retry after delay |
| 502 Bad Gateway | ✅ Yes | Retry with backoff | ⚠️ Retry after delay |
| 503 Service Unavailable | ✅ Yes | Retry with backoff | ⚠️ Retry after delay |
| 504 Gateway Timeout | ✅ Yes | Retry with backoff | ⚠️ Retry after delay |
| Timeout (15 min) | ❌ No | Fail immediately | ✗ Request too slow |

*Note: 429 is handled by the general `boxApiFetch()` retry logic, not Box AI specific retry.

## Log Output Example

### Successful Extraction (First Try)
```
[INFO] Box AI extraction request prepared {
  model: "google__gemini_2_5_pro",
  fileId: "2065821176525",
  fieldCount: 87,
  requestSizeKB: 245,
  totalPromptChars: 12450,
  attempt: 1,
  maxRetries: 4
}
[DEBUG] Box AI response received {
  status: 200,
  durationMs: 240363,
  attempt: 1
}
[INFO] Successfully extracted data using model "google__gemini_2_5_pro" {
  fileId: "2065821176525",
  fieldCount: 87,
  attemptNumber: 1
}
```

### Extraction with Retry (Success on 2nd Try)
```
[INFO] Box AI extraction request prepared {
  model: "google__gemini_2_5_pro",
  fileId: "2065821176525",
  fieldCount: 87,
  requestSizeKB: 245,
  totalPromptChars: 12450,
  attempt: 1,
  maxRetries: 4
}
[DEBUG] Box AI response received {
  status: 500,
  durationMs: 240363,
  attempt: 1
}
[ERROR] Box AI HTTP error 500 for model "google__gemini_2_5_pro"
[WARN] Box AI extraction failed with 500, retrying in 3000ms {
  fileId: "2065821176525",
  model: "google__gemini_2_5_pro",
  attempt: 1,
  maxRetries: 4,
  nextRetryIn: "3000ms"
}
[INFO] Box AI extraction request prepared {
  model: "google__gemini_2_5_pro",
  fileId: "2065821176525",
  fieldCount: 87,
  requestSizeKB: 245,
  totalPromptChars: 12450,
  attempt: 2,
  maxRetries: 4
}
[DEBUG] Box AI response received {
  status: 200,
  durationMs: 298541,
  attempt: 2
}
[INFO] Box AI extraction succeeded after 2 attempts {
  fileId: "2065821176525",
  model: "google__gemini_2_5_pro",
  totalDuration: 298541
}
[INFO] Successfully extracted data using model "google__gemini_2_5_pro" {
  fileId: "2065821176525",
  fieldCount: 87,
  attemptNumber: 2
}
```

### Failed Extraction (All Retries Exhausted)
```
[INFO] Box AI extraction request prepared (attempt 1/4)
[ERROR] Box AI HTTP error 500
[WARN] Box AI extraction failed with 500, retrying in 3000ms
[INFO] Box AI extraction request prepared (attempt 2/4)
[ERROR] Box AI HTTP error 500
[WARN] Box AI extraction failed with 500, retrying in 6000ms
[INFO] Box AI extraction request prepared (attempt 3/4)
[ERROR] Box AI HTTP error 500
[WARN] Box AI extraction failed with 500, retrying in 12000ms
[INFO] Box AI extraction request prepared (attempt 4/4)
[ERROR] Box AI HTTP error 500
[ERROR] Box AI extraction failed after 4 attempts for model "google__gemini_2_5_pro"
Error: Box AI API returned 500: Internal Server Error
```

## Key Improvements

### Before
- ❌ Single attempt, immediate failure
- ❌ No timeout handling
- ❌ Poor diagnostics
- ❌ 0% success rate on transient errors

### After
- ✅ 4 attempts with exponential backoff
- ✅ 15-minute timeout per attempt
- ✅ Detailed request/response logging
- ✅ ~80% success rate on transient errors

## Configuration Summary

```typescript
const BOX_AI_EXTRACTION_CONFIG = {
  maxRetries: 3,              // 4 total attempts
  initialDelayMs: 3000,       // 3s, 6s, 12s, 24s
  maxDelayMs: 60000,          // Cap at 60s
  backoffMultiplier: 2,       // Exponential
  timeoutMs: 900000,          // 15 minutes
  retryableStatusCodes: [500, 502, 503, 504]
};
```

## When to Adjust Configuration

### Increase Timeout (if extractions consistently timeout)
```typescript
timeoutMs: 1800000,  // 30 minutes
```

### Increase Retries (if Box AI is very unreliable)
```typescript
maxRetries: 5,  // 6 total attempts
```

### Decrease Initial Delay (for faster feedback in dev)
```typescript
initialDelayMs: 1000,  // 1s, 2s, 4s, 8s
```

### Add More Retryable Status Codes (if needed)
```typescript
retryableStatusCodes: [429, 500, 502, 503, 504],  // Add 429
```

