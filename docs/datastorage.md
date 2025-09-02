# Data Storage in Box.com

## Overview

The Extraction Accuracy App supports storing all your accuracy testing data directly in Box.com alongside your source documents. This provides better collaboration, security, and organization compared to local file storage.

## Why Box.com Storage?

### 🔗 **Co-location with Source Documents**
Your accuracy testing data is stored right next to the original documents you're testing, making it easy to find and reference.

### 👥 **Team Collaboration** 
Multiple team members can access, review, and annotate the same accuracy testing data simultaneously.

### 🔒 **Enterprise Security**
Leverage Box's enterprise-grade security, permissions, and compliance features for your sensitive testing data.

### 📈 **Scalability**
No limits on storage size - handle large-scale accuracy testing projects without local disk constraints.

### 💾 **Automatic Backup**
Box provides automatic versioning and backup - never lose your ground truth annotations or testing results.

### 🔍 **Advanced Search**
Use Box's search capabilities to find specific annotations, accuracy metrics, or prompt versions across all your testing data.

## Folder Structure

The Box.com storage system creates a structured hierarchy that organizes data by template and document:

```
📁 extraction-accuracy-data/              # Root folder for all accuracy testing
├── 📁 contracts/                         # Template-specific folder
│   ├── 📁 documents/                     # Original document references
│   │   ├── 📄 1920031763042.ref.json     # Document metadata
│   │   └── 📄 1823596213622.ref.json
│   └── 📁 annotations/                   # Accuracy testing data
│       ├── 📁 1920031763042/             # Per-document annotation folder
│       │   ├── 📄 ground-truth.json      # Human-verified annotations
│       │   ├── 📄 extraction-results.json # AI model results with citations
│       │   ├── 📄 model-accuracy.json    # Performance metrics
│       │   └── 📄 prompt-history.json    # Versioned prompts
│       └── 📁 1823596213622/
│           ├── 📄 ground-truth.json
│           ├── 📄 extraction-results.json
│           ├── 📄 model-accuracy.json
│           └── 📄 prompt-history.json
├── 📁 invoices/                          # Another template
├── 📁 digital-assets/                    # Another template
└── 📁 certificates/                      # Another template
```

## Data Schemas

### Ground Truth Data (`ground-truth.json`)

Contains human-verified annotations with confidence levels and notes:

```json
{
  "fileId": "1920031763042",
  "fileName": "contract-example.pdf",
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

### Extraction Results (`extraction-results.json`)

AI model results with citations and performance data:

```json
{
  "fileId": "1920031763042",
  "fileName": "contract-example.pdf",
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
          }
        }
      }
    }
  ]
}
```

### Model Accuracy (`model-accuracy.json`)

Performance metrics for each model and field:

```json
{
  "fileId": "1920031763042",
  "templateKey": "contracts",
  "lastCalculated": "2025-01-15T10:35:00Z",
  "metrics": {
    "google__gemini_2_0_flash_001": {
      "fields": {
        "agreement_date": {
          "accuracy": 1.0,
          "precision": 1.0,
          "recall": 1.0,
          "f1": 1.0,
          "exactMatch": true,
          "semanticMatch": true
        }
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
    }
  }
}
```

### Prompt History (`prompt-history.json`)

Versioned prompts with performance tracking:

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

## Getting Started

### Prerequisites

1. **Box Account Access**: Ensure your Box account has permissions to create folders in your target location
2. **Authentication**: Configure Box authentication in Settings (OAuth2.0, Service Account, or Developer Token)
3. **Existing Data**: Run some accuracy tests to have data available for migration

### Migration Process

1. **Navigate to Settings**
   - Go to the Settings page in your app
   - Click on the "Box Storage" tab

2. **Configure Root Folder**
   - Enter the Box folder ID where you want to create the `extraction-accuracy-data` folder
   - Default is your main documents folder (`329136417488`)

3. **Test Structure Creation**
   - Click "Test Folder Structure" to verify permissions
   - This creates the folder hierarchy without migrating data

4. **Migrate Existing Data**
   - Click "Migrate to Box" to transfer all local data to Box.com
   - The process shows progress and reports any errors

### What Gets Migrated

- ✅ **Ground Truth Annotations**: All human-verified field values
- ✅ **AI Model Results**: Extraction results from all tested models  
- ✅ **Accuracy Metrics**: Precision, recall, F1 scores for each model/field combination
- ✅ **Prompt History**: All prompt versions and their performance data
- ✅ **Template Configuration**: Field definitions and settings
- ✅ **File Metadata**: Document references and processing status

## Advanced Features

### Citation Preservation

The Box.com storage format preserves citations from AI model responses, showing exactly which text snippets supported each extracted value:

```json
"agreement_date": {
  "value": "2011-01-11",
  "citations": [
    "IN WITNESS WHEREOF the Parties have signed this Agreement, as of the date first written above",
    "January 11, 2011"
  ]
}
```

### Performance Tracking

Detailed performance metrics are stored for each extraction run:

- **Token Usage**: Input/output token counts for cost analysis
- **Extraction Time**: Processing time per field per model
- **Confidence Scores**: Model confidence in each extraction
- **Accuracy Trends**: Historical performance across prompt iterations

### Version Control

All changes are tracked with timestamps and user information:

- **Prompt Evolution**: See how prompts improved over time
- **Annotation History**: Track who made ground truth updates and when
- **Performance Trends**: Compare accuracy across different prompt versions

## API Integration

### Automatic Saving

When Box.com storage is enabled, the app automatically saves data to Box:

- **After each extraction run**: Results and accuracy metrics are saved
- **When ground truth is updated**: Annotations are immediately synced
- **On prompt changes**: New versions are tracked in Box

### Loading Data

The app seamlessly loads data from Box when available:

- **Ground truth annotations** are loaded from Box storage
- **Historical results** can be retrieved and displayed
- **Prompt history** is synchronized across team members

## Troubleshooting

### Common Issues

#### Migration Fails with "Folder not found"
**Cause**: Invalid folder ID or insufficient permissions
**Solution**: 
- Verify the root folder ID is correct
- Ensure your Box account has write permissions to the folder
- Try using a different parent folder

#### "Authentication failed" errors
**Cause**: Box API credentials are invalid or expired
**Solution**:
- Check your authentication method in Settings
- Re-authenticate if using OAuth2.0
- Verify service account configuration if using JSON config

#### Migration completes but files are missing
**Cause**: Partial migration due to API rate limits
**Solution**:
- Check the migration report for specific errors
- Wait a few minutes and try migrating again
- Contact support if issues persist

#### Cannot access migrated data
**Cause**: Box permissions or folder structure issues
**Solution**:
- Verify the folder structure exists in Box
- Check file permissions in the annotation folders
- Try refreshing your Box authentication

### Performance Considerations

#### Large Dataset Migration
- **Batch Size**: The system processes files in batches to avoid timeouts
- **Rate Limiting**: Automatic retry logic handles Box API rate limits
- **Progress Tracking**: Monitor migration progress in the UI

#### Ongoing Sync Performance
- **Parallel Uploads**: Multiple files are uploaded simultaneously
- **Incremental Updates**: Only changed data is uploaded to Box
- **Local Caching**: Frequently accessed data is cached locally

### Getting Help

#### Check Migration Logs
The migration UI shows detailed error messages for any failed operations. Common solutions:

1. **Permission errors**: Ensure Box app has folder access
2. **Network timeouts**: Retry migration after a few minutes  
3. **Storage quotas**: Verify Box account has sufficient storage

#### Contact Support
If you encounter persistent issues:

1. Note the specific error messages from the migration UI
2. Check the browser console for technical details
3. Provide your Box folder ID and authentication method
4. Include screenshots of any error messages

## Best Practices

### Folder Organization

- **Use meaningful folder IDs**: Choose a dedicated parent folder for accuracy testing
- **Consistent naming**: Template names should match your Box AI metadata templates
- **Regular cleanup**: Archive old testing data to maintain performance

### Data Management

- **Regular backups**: Export important ground truth data periodically  
- **Version control**: Use descriptive names for prompt versions
- **Team coordination**: Establish workflows for collaborative annotation

### Security

- **Access control**: Use Box's permission system to control data access
- **Data classification**: Mark sensitive testing data appropriately in Box
- **Audit trails**: Monitor access to ground truth annotations

## Migration Checklist

Before migrating to Box.com storage:

- [ ] **Box authentication configured and working**
- [ ] **Target folder ID identified and accessible** 
- [ ] **Current local data backed up** (optional but recommended)
- [ ] **Team permissions configured in Box**
- [ ] **Storage quota sufficient for all testing data**
- [ ] **Network connectivity stable for upload process**

After successful migration:

- [ ] **Verify folder structure created correctly**
- [ ] **Test loading ground truth data from Box**
- [ ] **Confirm extraction results are properly stored**
- [ ] **Validate accuracy metrics are preserved**
- [ ] **Check prompt history is complete**

## Future Enhancements

The Box.com storage system is designed for extensibility:

### Planned Features
- **Real-time collaboration**: Live updates when team members modify annotations
- **Advanced search**: Query accuracy data across all templates and documents
- **Data export**: Bulk export of accuracy testing data for analysis
- **Integration**: Direct connection to Box AI metadata templates

### API Extensions
- **Webhook integration**: Automatic processing when new documents are added
- **Bulk operations**: Mass import/export of testing data
- **Analytics dashboard**: Aggregate accuracy trends across all templates

---

## Support

For questions about Box.com data storage:

1. **Check this documentation** for common issues and solutions
2. **Review the migration UI** for specific error messages  
3. **Test with a small dataset** before migrating large amounts of data
4. **Contact your Box administrator** for permission and quota issues

The Box.com storage system provides a robust, collaborative foundation for large-scale accuracy testing workflows while maintaining the simplicity of the local development experience. 