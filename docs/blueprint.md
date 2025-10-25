# **App Name**: Box Optimizer

## Core Features:

- Main Navigation: A one-page application featuring a top navigation bar with 'Home,' 'Templates,' 'Ground Truth,' and 'Settings' links.
- **Advanced Box AI Extraction**: Dual-mode extraction system with prompted and non-prompted modes for comprehensive accuracy testing (see [Box AI Extraction System Documentation](./box-ai-extraction-system.md))
- Metadata Extraction Table: On the Home Page, a table displays file names from a specified Box folder (folder ID: 329136417488), along with metadata extraction results from various AI models. Columns include file name, prompt, AI model outputs (Gemini 2.0 Flash, Gemini 2.5 Pro, Claude, OpenAI), and ground truth data.
- Document Upload and Template Selection: Modal for selecting templates and documents from a specified Box folder using the folder ID https://appworld.app.box.com/folder/329136417488.
- **Prompt Versioning System**: Advanced prompt management with version control, history tracking, and performance metrics for iterative prompt optimization.
- **Automated Prompt Generation**: AI-powered prompt generation using Google's Power Prompts techniques, with automatic reasoning about document content and template requirements.
- **Multi-Model AI Integration**: Support for multiple AI models (Box AI Default, Google Gemini 2.0 Flash, Gemini 2.5 Pro, AWS Claude 3.5 Sonnet) with real-time comparison capabilities.
- Ground Truth Interface: Ground Truth Management interface where users can add, edit, and delete ground truth for file metadata, including a side-by-side view with Box document preview (using Box Element Preview).
- Performance Metrics Calculation: Calculate and display metrics (Accuracy, Precision, Recall, F1 Score) for each document or metadata field extracted to evaluate the AI model performance.

## Current Implementation Status:

### ✅ Completed Features
- **Main Dashboard**: Simplified component architecture (752 lines, 58% reduction from original)
- **Dual-Mode Box AI Integration**: Prompted vs non-prompted extraction with real-time comparison
- **Multi-Model AI Testing**: Google Gemini 2.0 Flash, Gemini 2.5 Pro, AWS Claude 3.5 Sonnet, Enhanced Extract Agent
- **Box API Integration**: Service account and developer token authentication with automatic token refresh
- **Template Management**: Configurable extraction templates with localStorage persistence
- **Ground Truth Management**: Inline editing with validation and document preview
- **Performance Metrics**: Accuracy, precision, recall, F1 score calculations
- **Prompt Versioning**: Complete version control system with history tracking and favorites
- **Constants Management**: Centralized string constants (74% reduction in hardcoded strings)
- **Enhanced Progress State**: Real-time progress tracking with time estimation

### 🔄 In Progress
- Real-time progress UI updates with visual indicators
- Custom hooks architecture for complex logic extraction

### 📋 Planned Improvements
- Performance optimization for large datasets
- Enhanced error handling and recovery mechanisms
- Database migration from localStorage to Firestore
- Advanced prompt engineering features

## 🚀 **Latest Features (2024)**

### **Box AI Extraction System (Completed)**
- **Dual-Mode Architecture**: Unique approach supporting both prompted and non-prompted extraction
- **Real-time Comparison**: Side-by-side results showing impact of custom prompts
- **Prompt Engineering**: Advanced prompt versioning with history and performance tracking
- **Multi-Model Support**: Seamless switching between AI models (Gemini, Claude, OpenAI)
- **Fallback System**: Graceful degradation when prompts cause issues
- **API Compliance**: Full compliance with Box AI `/ai/extract_structured` endpoint

### **Prompt Versioning System (Completed)**
- **Version Control**: Save, restore, and compare prompt versions
- **History Tracking**: Complete audit trail of prompt changes
- **Performance Metrics**: Track accuracy improvements with each version
- **Favorites System**: Mark best-performing prompts as favorites
- **Persistence**: Dual storage in localStorage and JSON files

### **Enhanced Model Management (Completed)**
- **Model Variants**: Support for `_no_prompt` model variants for baseline testing
- **Dynamic Model Selection**: Runtime model switching for A/B testing
- **Performance Monitoring**: Real-time extraction timing and success rates
- **Debug Logging**: Comprehensive logging for troubleshooting

## Recent Optimizations (2024):

### Extract Constants Optimization (Completed)
- **Phase 1**: UI Labels - Centralized user-facing strings
- **Phase 2**: Field Types - Standardized data type definitions
- **Phase 3**: Toast Messages - Consistent notification templates
- **Phase 4**: Enum Options - Reusable dropdown values
- **Result**: 74% reduction in hardcoded strings with zero breaking changes

### Enhanced Progress State (Completed)
- Real-time progress tracking during extraction operations
- Smart time estimation with ETA calculations
- Detailed context showing current file, model, and operation
- Success/failure tracking with visual indicators (✅/❌)
- Completion tracking for files and models

### **Box AI Integration Fix (Completed)**
- **Critical Fix**: Changed `instruction` to `prompt` field name for Box AI API compliance
- **Schema Update**: Updated `BoxAIFieldSchema` to match Box AI specification
- **Persistence Fix**: Added proper `saveAccuracyData` calls for prompt version persistence
- **Validation**: Confirmed working with live Box AI API responses

## 🎯 **Technical Architecture**

### **Core Components**
- `useModelExtractionRunner`: Main extraction orchestration
- `useDataHandlers`: Data persistence and management
- `usePromptVersioning`: Prompt history and version control
- `BoxAIExtractService`: Box AI API integration layer

### **Data Flow**
1. **Template Selection**: User selects template and documents
2. **Prompt Engineering**: Custom prompts created/edited with version control
3. **Dual Extraction**: Both prompted and non-prompted extractions run in parallel
4. **Results Comparison**: Real-time comparison of extraction results
5. **Ground Truth Validation**: Compare against manually verified data
6. **Metrics Calculation**: Accuracy, precision, recall, F1 scores computed

### **Unique Features**
- **Prompt Impact Analysis**: Quantify how custom prompts improve accuracy
- **Model Performance Comparison**: A/B test different AI models with identical prompts
- **Fallback Safety**: Graceful degradation when advanced features fail
- **Version-Controlled Prompts**: Full history of prompt iterations with performance data

## Style Guidelines:

- Primary color: HSL(210, 75%, 50%) - RGB(21, 125, 214). This bright, saturated blue suggests technological focus, information access, and optimized solutions.
- Background color: HSL(210, 20%, 95%) - RGB(242, 245, 247). Very light desaturated blue provides a neutral backdrop that conveys objectivity.
- Accent color: HSL(180, 65%, 50%) - RGB(33, 191, 191). This contrasting cyan can highlight key actions and metrics, implying the freshness and clarity of insight.
- Body text: 'Inter' sans-serif; a neutral font that emphasizes the objectivity of the displayed data
- Headline Font: 'Space Grotesk', for an elegant modern style that compliments the sans-serif choice for body text
- Use minimalist, geometric icons to represent different metadata fields and functions. Icons should be consistent with the overall modern and clean design.
- Maintain a clean, well-spaced layout for the data table. Use clear visual hierarchy to distinguish between file names, metadata fields, and extraction results.

## 📚 **Documentation**

- **[Box AI Extraction System](./box-ai-extraction-system.md)**: Comprehensive technical documentation for the dual-mode extraction architecture
- **[Technical Specifications](./product-requirements/technical-specs.md)**: Overall system architecture and deployment
- **[Metrics Specification](./metrics-specification.md)**: Performance measurement and calculation details