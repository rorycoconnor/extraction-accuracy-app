# Prompt Studio System Documentation

## Overview

The Prompt Studio is a sophisticated prompt engineering interface that enables users to iteratively improve AI extraction accuracy through custom prompt development, versioning, and performance tracking. This system integrates seamlessly with the comparison runner to provide real-time feedback on prompt effectiveness.

## 🎯 **Complete User Workflow**

### **Step 1: Access Prompt Studio**
1. User navigates to the home page comparison grid
2. User clicks on any **prompt text** under a field header (e.g., "Contract Type", "Effective Date")
3. Prompt Studio opens as a side sheet modal

### **Step 2: View Current State**
- **Active Prompt Display**: Shows the currently active prompt for the selected field
- **Version History**: Displays all previous prompt versions with timestamps
- **Performance Metrics**: Shows top 2 performing models with F1, Accuracy, Precision, Recall scores
- **Visual Indicators**: 🏆 "Best" and 🥈 "2nd Best" badges for model ranking

### **Step 3: Edit & Improve Prompts**
- **Direct Editing**: Modify prompt text in the textarea
- **AI-Powered Generation**: Use "Generate Prompt" for AI-suggested prompts
- **Intelligent Improvement**: Use "Improve Prompt" with specific feedback instructions
- **Dynamic Save Button**: Bright blue "Save as New Version" button when text changes

### **Step 4: Save & Version Management**
- **Automatic Versioning**: Each save creates a new version with timestamp
- **History Preservation**: All previous versions remain accessible
- **Instant UI Updates**: Active prompt and version list update immediately

### **Step 5: Performance Testing**
- **Run Comparison**: Execute comparison with new prompt version
- **Automatic Metrics Linking**: System automatically associates results with the new prompt version
- **Performance Tracking**: View metrics progression across prompt versions

## 🔧 **Technical Implementation**

### **Core Components**

#### **1. Prompt Studio Sheet (`src/components/prompt-studio-sheet.tsx`)**
- Modal interface with advanced prompt editing capabilities
- Real-time version history display
- Integrated performance metrics visualization
- AI-powered prompt generation and improvement tools

#### **2. Data Handlers (`src/hooks/use-data-handlers.tsx`)**
- `handleUpdatePrompt`: Saves new prompt versions with automatic versioning
- `updatePromptVersionMetrics`: Links performance data to specific prompt versions
- Atomic data updates to prevent race conditions

#### **3. Enhanced Comparison Runner (`src/hooks/use-enhanced-comparison-runner.tsx`)**
- Automatically updates prompt version metrics after comparison completion
- Seamless integration between prompt changes and performance measurement
- Atomic state management for consistent data integrity

### **Key Features**

#### **Intelligent Model Ranking**
- Automatically sorts models by F1 score performance
- Displays top 2 models for focused optimization
- Color-coded performance indicators (Green >90%, Yellow >70%, Red <70%)

#### **Prompt Versioning System**
```typescript
interface PromptVersion {
  id: string;
  prompt: string;
  timestamp: string;
  metrics?: {
    modelMetrics: Record<string, ModelMetrics>;
    lastRunAt: string;
    filesCount: number;
  };
}
```

#### **Performance Metrics Integration**
- Automatic association of comparison results with prompt versions
- Historical performance tracking for prompt optimization
- Real-time metrics display with timestamp information

## 🛡️ **CRITICAL PROTECTION NOTICE**

### **⚠️ DO NOT MODIFY COMPARISON RUNNER WITHOUT APPROVAL**

**IMPORTANT**: The comparison runner system (`src/hooks/use-enhanced-comparison-runner.tsx` and related files) is mission-critical and has been carefully architected after extensive development and testing.

**STRICT REQUIREMENTS**:
1. **NO changes** to comparison runner logic without explicit approval
2. **MANDATORY code review** required for ANY modifications
3. **Enum handling**, **field processing**, and **metrics calculation** are working correctly
4. **Performance impact assessment** required for any proposed changes

**Why This Protection Exists**:
- Complex interaction between Box AI API, field processing, and metrics calculation
- Enum fields work correctly for contract documents (verified by testing)
- Invoice vs contract document types have different field requirements by design
- System stability depends on careful state management and atomic updates

**Before Making Changes**:
1. Document the specific problem with evidence
2. Propose solution with risk assessment
3. Get explicit approval from project lead
4. Conduct thorough testing across document types
5. Verify no regression in existing functionality

## 📊 **Performance Metrics Display**

### **Simplified Top 2 Models View**
The Prompt Studio displays a clean, focused metrics view:

```
🏆 Best Model: Google Gemini 2.0 Flash
┌─────────────┬──────────┬───────────┬────────┐
│ F1 Score    │ Accuracy │ Precision │ Recall │
│     92%     │    89%   │    95%    │   90%  │
└─────────────┴──────────┴───────────┴────────┘

🥈 2nd Best Model: Enhanced Extract Agent  
┌─────────────┬──────────┬───────────┬────────┐
│ F1 Score    │ Accuracy │ Precision │ Recall │
│     87%     │    85%   │    90%    │   85%  │
└─────────────┴──────────┴───────────┴────────┘
```

## 🔄 **Data Flow Architecture**

### **Prompt Update Flow**
1. User modifies prompt text
2. User clicks "Save as New Version"
3. `handleUpdatePrompt` creates new version with `metrics: undefined`
4. UI updates to show new active prompt and version history
5. User runs comparison
6. `updatePromptVersionMetrics` automatically links results to latest version
7. Prompt Studio displays updated performance metrics

### **Metrics Association Flow**
```
Comparison Run → Process Results → updatePromptVersionMetrics → 
Link to Active Prompt Version → Update UI Display
```

## 🎨 **UI/UX Features**

### **Visual Enhancements**
- **Dynamic Save Button**: Changes to bright blue when prompt text is modified
- **Performance Badges**: Clear model ranking with trophy/medal icons
- **Timestamp Display**: "Updated [time]" for metrics freshness
- **Color-coded Metrics**: Instant visual feedback on performance levels

### **Responsive Design**
- **Side Sheet Modal**: Non-intrusive overlay that doesn't disrupt main workflow
- **Scrollable History**: Accommodates unlimited prompt versions
- **Clean Typography**: Large, readable performance numbers with proper spacing

## 🧪 **Testing & Validation**

### **Verified Functionality**
✅ **Enum Fields**: Working correctly for contract documents  
✅ **Field Processing**: Proper handling of string, date, enum, and number fields  
✅ **Metrics Calculation**: Accurate F1, precision, recall, accuracy computation  
✅ **Version Management**: Reliable prompt versioning and history  
✅ **Performance Linking**: Automatic association of metrics with prompt versions  

### **Document Type Coverage**
- **Contract Documents**: Full enum field support with options arrays
- **Invoice Documents**: String/number fields (correct by design)
- **Mixed Templates**: Proper handling of different field type combinations

## 📝 **Best Practices**

### **For Users**
1. **Start Small**: Make incremental prompt improvements rather than complete rewrites
2. **Test Frequently**: Run comparisons after each significant prompt change
3. **Use AI Assistance**: Leverage "Generate" and "Improve" features for optimization ideas
4. **Track History**: Review version history to understand what improvements worked

### **For Developers**
1. **Preserve State**: Ensure atomic updates for data consistency
2. **Maintain Types**: Keep TypeScript interfaces updated with schema changes
3. **Test Thoroughly**: Verify enum handling across different document types
4. **Document Changes**: Update this documentation for any new features

## 🔗 **Integration Points**

### **Main Page Integration**
- Triggered by clicking prompt text in comparison grid
- Seamless modal overlay experience
- Real-time updates to main grid after prompt changes

### **Comparison Runner Integration**
- Automatic metrics linking after comparison completion
- Atomic state updates to prevent data corruption
- Performance data preservation across sessions

### **Data Persistence**
- JSON-based storage for prompt versions and metrics
- Automatic saving with debounced writes
- Session management for user workflow continuity

## 🚀 **Future Enhancements**

### **Short-term Improvements**
- **Enhanced Error Handling**: More detailed error messages for API failures
- **Bulk Operations**: Save multiple prompt versions simultaneously
- **Template Import/Export**: Share prompt templates between projects
- **Performance Optimizations**: Faster loading for large datasets

### **Major System Improvements**
- **Update Table Grid to be more robust with full page scroll**: Enhance the comparison grid to handle large datasets with better scrolling performance and viewport optimization
- **Evaluate moving the header to left nav**: Consider relocating the header to a left navigation panel to maximize space for the Table/Grid display area
- **Re-look at generate prompt and improve prompt**: Review and enhance the AI prompt generation and improvement algorithms for better accuracy and user experience

### **Advanced Features**
- **Real-time Collaboration**: Multiple users editing prompts simultaneously
- **A/B Testing Framework**: Compare multiple prompt versions side-by-side
- **Advanced Analytics**: Deeper insights into prompt performance patterns
- **Custom Model Integration**: Support for additional AI models beyond current providers

---

**Last Updated**: January 2025  
**System Status**: ✅ Fully Operational  
**Protection Level**: 🛡️ Critical System - Approval Required for Changes 