# Box.com Storage Schema

## Folder Structure

```
📁 extraction-accuracy-data/
├── 📁 {templateName}/ (e.g., "contracts", "invoices", "digital-assets")
│   ├── 📁 documents/                    # References to original files
│   │   └── 📄 {fileId}.ref.json         # File reference metadata
│   └── 📁 annotations/                  # Accuracy testing data  
│       └── 📁 {fileId}/                 # Per-document folder
│           ├── 📄 ground-truth.json     # Human-verified data
│           ├── 📄 extraction-results.json # AI model results with citations
│           ├── 📄 model-accuracy.json   # Calculated metrics
│           └── 📄 prompt-history.json   # Versioned prompts
```

## File Schemas

### 1. `ground-truth.json` - Human-Verified Annotations
```json
{
  "fileId": "1920031763042",
  "fileName": "DIVERSINETCORP_03_01_2012-EX-4-RESELLER AGREEMENT.pdf",
  "templateKey": "contracts",
  "lastModified": "2025-01-15T10:30:00Z",
  "annotatedBy": "user@company.com",
  "annotations": {
    "agreement_date": {
      "value": "2011-01-11",
      "confidence": "high",
      "notes": "Date clearly stated in opening paragraph"
    },
    "contract_title": {
      "value": "RESELLER AGREEMENT", 
      "confidence": "high"
    },
    "party_names": [
      {
        "value": "Diversinet Corp.",
        "role": "licensor"
      },
      {
        "value": "2205925 Ontario Limited", 
        "role": "reseller"
      }
    ]
  }
}
```

### 2. `extraction-results.json` - AI Model Results with Citations
```json
{
  "fileId": "1920031763042",
  "fileName": "DIVERSINETCORP_03_01_2012-EX-4-RESELLER AGREEMENT.pdf", 
  "templateKey": "contracts",
  "lastModified": "2025-01-15T10:30:00Z",
  "extractionRuns": [
    {
      "runId": "run-2025-01-15-001",
      "timestamp": "2025-01-15T10:30:00Z",
      "promptVersions": {
        "agreement_date": "v2",
        "contract_title": "v1"
      },
      "results": {
        "google__gemini_2_0_flash_001": {
          "agreement_date": {
            "value": "2011-01-11",
            "citations": [
              "IN WITNESS WHEREOF the Parties have signed this Agreement, as of the date first written above",
              "January 11, 2011"
            ],
            "confidence": 0.95,
            "extractionTime": 1250,
            "tokenUsage": {
              "input": 12000,
              "output": 15
            }
          },
          "contract_title": {
            "value": "RESELLER AGREEMENT",
            "citations": ["RESELLER AGREEMENT"],
            "confidence": 0.99,
            "extractionTime": 1100
          }
        },
        "aws__claude_3_7_sonnet": {
          "agreement_date": {
            "value": "2011-01-11", 
            "citations": ["January 11, 2011"],
            "confidence": 0.92,
            "extractionTime": 2100
          }
        }
      }
    }
  ]
}
```

### 3. `model-accuracy.json` - Calculated Performance Metrics
```json
{
  "fileId": "1920031763042",
  "templateKey": "contracts",
  "lastCalculated": "2025-01-15T10:35:00Z",
  "metrics": {
    "google__gemini_2_0_flash_001": {
      "agreement_date": {
        "accuracy": 1.0,
        "precision": 1.0, 
        "recall": 1.0,
        "f1": 1.0,
        "exactMatch": true,
        "semanticMatch": true
      },
      "contract_title": {
        "accuracy": 1.0,
        "precision": 1.0,
        "recall": 1.0, 
        "f1": 1.0
      },
      "overall": {
        "accuracy": 0.95,
        "precision": 0.94,
        "recall": 0.96,
        "f1": 0.95,
        "totalFields": 25,
        "extractedFields": 24,
        "correctFields": 23
      }
    },
    "aws__claude_3_7_sonnet": {
      "overall": {
        "accuracy": 0.87,
        "precision": 0.85,
        "recall": 0.89,
        "f1": 0.87
      }
    }
  }
}
```

### 4. `prompt-history.json` - Versioned Prompts per Template
```json
{
  "templateKey": "contracts",
  "lastModified": "2025-01-15T10:30:00Z",
  "prompts": {
    "agreement_date": {
      "activeVersion": "v2",
      "versions": [
        {
          "id": "v1",
          "prompt": "Extract the agreement date from this contract",
          "createdAt": "2025-01-10T09:00:00Z",
          "performance": {
            "avgAccuracy": 0.85,
            "testedFiles": 10
          }
        },
        {
          "id": "v2", 
          "prompt": "Extract the agreement execution date, looking for phrases like 'as of the date first written above' or explicit dates",
          "createdAt": "2025-01-15T10:30:00Z",
          "performance": {
            "avgAccuracy": 0.95,
            "testedFiles": 15
          }
        }
      ]
    }
  }
}
```

### 5. `{fileId}.ref.json` - Document References
```json
{
  "originalFileId": "1920031763042",
  "fileName": "DIVERSINETCORP_03_01_2012-EX-4-RESELLER AGREEMENT.pdf",
  "templateKey": "contracts", 
  "addedToAccuracyTesting": "2025-01-15T09:00:00Z",
  "documentType": "contract",
  "pageCount": 15,
  "fileSize": 245760,
  "status": "annotated" // "pending", "annotated", "verified"
}
```

## Benefits of Box.com Storage

1. **🔗 Co-location**: Data stored next to source documents
2. **👥 Collaboration**: Multiple users can access and annotate
3. **🔒 Security**: Enterprise-grade security and permissions
4. **📈 Scalability**: No local storage limits
5. **💾 Backup**: Automatic backup and versioning
6. **🔍 Searchability**: Box's search can find annotations
7. **📋 Audit Trail**: Full history of changes and who made them

## Implementation Plan

Would you like me to:

1. **Create Box API functions** for folder creation and file upload?
2. **Build a Box storage service** that implements this schema?
3. **Design a migration tool** to move existing data to Box?
4. **Update the UI** to show Box storage status?

What part should I start with, or would you like to refine the folder structure first? 