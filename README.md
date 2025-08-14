# Box AI Accuracy Testing Application

A comprehensive tool for testing and optimizing AI model accuracy in metadata extraction from Box documents.

## 🚀 Features

### Core Functionality
- **Multi-Model AI Testing**: Compare results from Google Gemini 2.0 Flash, Enhanced Extract Agent, and other Box AI models
- **Metadata Extraction**: Extract structured metadata from contracts and documents stored in Box
- **Ground Truth Management**: Create and manage ground truth data with side-by-side document preview
- **Performance Metrics**: Calculate accuracy, precision, recall, and F1 scores for model comparison
- **Template Management**: Configure extraction templates with custom fields and prompts
- **Real-time Progress Tracking**: Enhanced progress indicators during extraction operations

### Recent Optimizations (2024)
- ✅ **Extract Constants**: Reduced 58+ hardcoded strings to 28 organized constants (74% reduction)
- ✅ **Enhanced Progress State**: Detailed progress tracking with time estimation and completion status
- 🔄 **Performance Optimization**: Real-time progress updates and improved user experience

## 🛠️ Technology Stack

- **Frontend**: Next.js 15.3.3 with TypeScript and React 18
- **UI Framework**: Radix UI components with Tailwind CSS
- **AI Integration**: Google Genkit with Box AI Enterprise models
- **Box Integration**: Box Node SDK with service account authentication
- **Styling**: Tailwind CSS with custom design system
- **Development**: Hot reload with comprehensive error handling

## 📦 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Box Developer Account with Enterprise AI access
- Box Service Account or Developer Token

### Installation

1. **Clone the repository**
   ```bash
   git clone [your-repo-url]
   cd "Accuracy App"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Edit with your Box credentials
   BOX_DEVELOPER_TOKEN=your_developer_token_here
   BOX_CONFIG_JSON_BASE64=your_service_account_config_base64
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:9002](http://localhost:9002)

## 🎯 Usage

### Quick Start
1. **Configure Settings**: Add your Box Developer Token or Service Account credentials
2. **Select Template**: Choose from pre-configured templates or create custom ones
3. **Run Extraction**: Select documents and AI models to compare
4. **Review Results**: Analyze extraction results and performance metrics
5. **Set Ground Truth**: Add accurate metadata for training and validation

### Key Workflows

#### Document Extraction
- Select documents from Box folder (ID: 329136417488)
- Choose AI models for comparison
- Configure extraction templates with custom fields
- Run parallel extractions with real-time progress
- View results in comprehensive comparison table

#### Ground Truth Management
- Side-by-side document preview using Box Elements
- Inline editing of metadata fields
- Version control for ground truth data
- Bulk operations for efficient data management

#### Performance Analysis
- Calculate accuracy metrics per model and field
- Compare model performance across document types
- Track improvement over time
- Export results for further analysis

## 🏗️ Architecture

### Component Structure
```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main dashboard (simplified component)
│   ├── templates/         # Template management
│   ├── ground-truth/      # Ground truth editor
│   └── settings/          # Configuration
├── components/            # Reusable UI components
│   ├── ui/               # Radix UI components
│   ├── extraction-table.tsx
│   ├── extraction-modal.tsx
│   └── prompt-studio-sheet.tsx
├── lib/                  # Utilities and constants
├── services/             # Box API integration
├── ai/                   # AI flows and prompts
└── hooks/                # Custom React hooks
```

### Key Optimizations
- **Constants Management**: Centralized string constants for maintainability
- **Progress Tracking**: Enhanced state management with detailed progress info
- **Type Safety**: Comprehensive TypeScript types and interfaces
- **Error Handling**: Robust error handling throughout the application

## 🔧 Configuration

### Box Setup
1. Create a Box Developer Account
2. Set up Service Account or Developer Token
3. Configure enterprise AI models access
4. Set folder permissions for document access

### Template Configuration
Templates are stored in localStorage and can be configured with:
- Custom metadata fields (string, date, enum, file)
- Field-specific extraction prompts
- Model-specific optimizations
- Validation rules and constraints

## 📊 Performance Metrics

The application calculates comprehensive metrics:
- **Accuracy**: Overall correctness of extractions
- **Precision**: Relevance of extracted information
- **Recall**: Completeness of extraction
- **F1 Score**: Harmonic mean of precision and recall

## 🚀 Recent Improvements

### Extract Constants Optimization (Completed)
- **Phase 1**: UI Labels - Centralized user-facing strings
- **Phase 2**: Field Types - Standardized data types
- **Phase 3**: Toast Messages - Consistent notification templates
- **Phase 4**: Enum Options - Reusable dropdown values

### Enhanced Progress State (Completed)
- Real-time progress tracking during extraction
- Detailed status messages with current operation context
- Time estimation and completion tracking
- Success/failure indicators with visual feedback

### Next Steps
- Real-time progress UI updates
- Custom hooks for complex logic extraction
- Performance optimization for large datasets
- Enhanced error handling and recovery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- Check the [documentation](./docs/) for detailed guides
- Report issues in the GitHub Issues section
- Contact the development team for enterprise support

## 🔗 Links

- [Box Developer Documentation](https://developer.box.com/)
- [Box AI Enterprise](https://www.box.com/ai/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Radix UI Components](https://www.radix-ui.com/)
