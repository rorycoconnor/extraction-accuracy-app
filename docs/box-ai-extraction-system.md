# Box AI Extraction System Documentation

## Overview

The Box AI Extraction System is a sophisticated metadata extraction platform that leverages Box's AI capabilities to extract structured data from documents. This system features a unique **dual-mode extraction approach** with advanced prompt engineering capabilities, making it ideal for accuracy testing and model comparison.

## 🎯 **Unique Architecture: Dual-Mode Extraction**

### **Two Extraction Modes**

#### **1. Prompted Extraction (Primary Mode)**
- **Purpose**: Custom instruction-based extraction for optimized accuracy
- **Implementation**: Uses Box AI `/ai/extract_structured` endpoint with custom prompts
- **Field Structure**:
```json
{
  "key": "counterPartyName",
  "type": "string",
  "displayName": "Counter Party Name",
  "prompt": "Extract the counter party name from the contract. Add USA to the end of the counter party name. For example if the counter party is IBM, Inc. output the name as IBM, Inc. USA"
}
```

#### **2. Fallback Mode (Non-Prompted)**
- **Purpose**: Baseline extraction without custom instructions
- **Implementation**: Same API endpoint but with prompts stripped from fields
- **Field Structure**:
```json
{
  "key": "counterPartyName",
  "type": "string",
  "displayName": "Counter Party Name"
  // No prompt field
}
```

### **Why This Approach is Unique**

1. **Real-time Comparison**: Instantly compare prompted vs non-prompted results
2. **Accuracy Measurement**: Quantify the impact of custom prompts on extraction quality
3. **Fallback Safety**: Graceful degradation when prompts cause issues
4. **Model Testing**: Test different AI models with identical prompts

## 🔧 **Technical Implementation**

### **Core Architecture**

```typescript
// Main extraction runner
export function useModelExtractionRunner() {
  const processJobs = async (extractionJobs: ExtractionJob[]) => {
    // Determine extraction mode
    const isNoPromptModel = modelName.endsWith('_no_prompt');
    
    // Build field definitions
    const fieldsForExtraction = accuracyData.fields.map(field => ({
      key: field.key,
      type: field.type,
      displayName: field.name,
      prompt: field.prompt, // ✅ Correct field name
      ...(field.type === 'enum' && { options: field.options })
    }));
    
    // Strip prompts for no-prompt models
    const fieldsToShow = isNoPromptModel ? 
      fieldsForExtraction.map(field => {
        const { prompt, ...fieldWithoutPrompt } = field;
        return fieldWithoutPrompt;
      }) : fieldsForExtraction;
    
    // Make Box AI request
    const response = await boxExtractStructuredMetadata({
      fileId: job.fileResult.id,
      fields: fieldsToShow,
      model: actualModelName
    });
  };
}
```

### **Box AI API Integration**

#### **Service Configuration**
```typescript
// Authentication (supports both methods)
BOX_CONFIG_JSON_BASE64=your_service_account_config_base64_here
BOX_DEVELOPER_TOKEN=your_box_developer_token_here

// Token management with automatic refresh
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
```

#### **Request Structure**
```typescript
// Box AI Extract Structured API call
const requestBody = {
  items: [{ id: fileId, type: 'file' }],
  fields: [
    {
      key: 'counterPartyName',
      type: 'string',
      displayName: 'Counter Party Name',
      prompt: 'Extract the counter party name...' // Custom instruction
    }
  ],
  model: 'google__gemini_2_0_flash_001' // Optional model override
};
```

### **Supported AI Models**

| Model | Provider | Capabilities |
|-------|----------|-------------|
| `box_ai_default` | Box | Standard extraction |
| `google__gemini_2_0_flash_001` | Google | Fast, cost-effective |
| `google__gemini_2_5_pro_001` | Google | High accuracy |
| `aws__claude_3_7_sonnet` | AWS | Advanced reasoning |

## 🔄 **Prompt Versioning System**

### **Version Management**
```typescript
type PromptVersion = {
  id: string;
  prompt: string;
  version: number;
  createdAt: Date;
  performance?: Metrics;
  isFavorite?: boolean;
};

type AccuracyField = {
  key: string;
  name: string;
  type: FieldType;
  prompt: string;
  promptHistory: PromptVersion[];
};
```

### **Prompt Update Flow**
```typescript
const handleUpdatePrompt = (fieldKey: string, newPrompt: string) => {
  // 1. Save current prompt to history
  const currentPrompt = field.prompt;
  const newVersion: PromptVersion = {
    id: generateId(),
    prompt: currentPrompt,
    version: field.promptHistory.length + 1,
    createdAt: new Date()
  };
  
  // 2. Update field with new prompt
  field.prompt = newPrompt;
  field.promptHistory.push(newVersion);
  
  // 3. Persist to localStorage and JSON
  setAccuracyData(newAccuracyData);
  saveAccuracyData(newAccuracyData);
};
```

### **Persistence Strategy**
- **localStorage**: Immediate client-side storage
- **JSON Files**: Backup persistence in `data/accuracyData.json`
- **Automatic Sync**: Changes propagate to both storage mechanisms

## 📊 **Results Processing**

### **Response Structure**
```typescript
type BoxAIResponse = {
  answer: Record<string, any>;
  ai_agent_info: {
    processor: string;
    models: Array<{
      name: string;
      provider: string;
    }>;
  };
  created_at: string;
  completion_reason: string;
};
```

### **Data Extraction Pipeline**
```typescript
// 1. Raw API Response
const rawResponse = await boxExtractStructuredMetadata(params);

// 2. Extract answer field
const extractedData = rawResponse.answer;

// 3. Store with metadata
const result: ExtractionResult = {
  fileId: job.fileResult.id,
  fileName: job.fileResult.name,
  modelName: job.modelName,
  extractedData,
  timestamp: new Date(),
  processingTime: endTime - startTime
};
```

## 🚀 **Usage Examples**

### **Basic Extraction**
```typescript
// Extract metadata with prompts
const results = await extractMetadata({
  fileId: '1918860970908',
  templateKey: 'contract_template',
  models: ['google__gemini_2_0_flash_001']
});

// Results include both prompted and non-prompted extractions
console.log(results.prompted.counterPartyName);    // "Noko Industries USA"
console.log(results.fallback.counterPartyName);    // "Noko Industries"
```

### **Prompt Testing**
```typescript
// Test different prompt versions
const promptVersions = [
  "Extract the counter party name",
  "Extract the counter party name. Add USA to the end",
  "Extract the counter party name from the contract. Look for company names..."
];

for (const prompt of promptVersions) {
  const results = await testPrompt(fileId, fieldKey, prompt);
  console.log(`Prompt: ${prompt} -> Result: ${results.extractedValue}`);
}
```

## 🔍 **Debugging & Monitoring**

### **Console Logging**
```typescript
// Extraction debugging
console.log(`🔍 Debug setup for model: ${modelName}`);
console.log(`📝 Sample field:`, {
  key: field.key,
  hasPrompt: !!field.prompt,
  promptPreview: field.prompt?.substring(0, 50) + '...'
});

// API request logging
console.log('Box AI Request:', JSON.stringify(requestBody, null, 2));
console.log('Box AI Raw Response:', response);
```

### **Performance Monitoring**
```typescript
// Request timing
const startTime = performance.now();
const response = await boxExtractStructuredMetadata(params);
const duration = performance.now() - startTime;

console.log(`✅ Extraction completed in ${duration}ms`);
```

## 🛠️ **Configuration**

### **Environment Variables**
```bash
# Box API Authentication
BOX_CONFIG_JSON_BASE64=your_service_account_config
BOX_DEVELOPER_TOKEN=your_developer_token

# Application Settings
NEXT_PUBLIC_BOX_FOLDER_ID=329136417488
NEXT_PUBLIC_PORT=9002
```

### **Field Type Definitions**
```typescript
export const FIELD_TYPES = {
  STRING: 'string',
  DATE: 'date',
  ENUM: 'enum',
  NUMBER: 'number',
  MULTI_SELECT: 'multiSelect'
} as const;
```

## 🎯 **Best Practices**

### **Prompt Engineering**
1. **Be Specific**: Include exact formatting requirements
2. **Provide Context**: Explain what to look for in the document
3. **Handle Edge Cases**: Define fallback behavior
4. **Test Iteratively**: Use version control to track improvements

### **Error Handling**
```typescript
try {
  const result = await boxExtractStructuredMetadata(params);
  return result;
} catch (error) {
  console.error('Box AI extraction failed:', error);
  // Fallback to alternative extraction method
  return await fallbackExtraction(params);
}
```

### **Performance Optimization**
- **Parallel Processing**: Run multiple extractions simultaneously
- **Caching**: Cache token and template data
- **Batch Operations**: Process multiple files in batches
- **Progress Tracking**: Provide real-time feedback to users

## 📈 **Metrics & Analytics**

### **Success Metrics**
- **Extraction Accuracy**: Compare against ground truth
- **Response Time**: Track API performance
- **Success Rate**: Monitor extraction completion rates
- **Prompt Effectiveness**: Measure improvement with custom prompts

### **Monitoring Dashboard**
```typescript
// Real-time extraction stats
const stats = {
  totalExtractions: 150,
  successRate: 94.7,
  averageResponseTime: 2.3,
  promptImprovement: 23.5 // % accuracy increase with prompts
};
```

## 🔐 **Security Considerations**

### **Authentication**
- **Service Account**: Production-ready JWT authentication
- **Developer Token**: Development and testing
- **Token Rotation**: Automatic refresh every 55 minutes

### **Data Protection**
- **Encryption**: All API communications over HTTPS
- **Access Control**: Box folder-level permissions
- **Audit Trail**: Complete extraction history logging

## 🚀 **Deployment**

### **Development Setup**
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Box credentials

# Start development server
npm run dev
```

### **Production Deployment**
```bash
# Build application
npm run build

# Start production server
npm start
```

## 📚 **API Reference**

### **Box AI Extract Structured Endpoint**
- **URL**: `https://api.box.com/2.0/ai/extract_structured`
- **Method**: POST
- **Documentation**: [Box AI Extract Structured](https://developer.box.com/reference/post-ai-extract-structured/)

### **Key Parameters**
- `items`: Array of file objects to process
- `fields`: Array of field definitions with prompts
- `model`: Optional AI model override
- `ai_agent`: Optional agent configuration

This documentation provides a comprehensive guide for programming leads to understand and maintain the Box AI extraction system's unique architecture and capabilities. 