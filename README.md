# Box Optimizer

A comprehensive tool for optimizing AI model accuracy in metadata extraction from Box documents.

## 🚀 Features

### Core Functionality
- **Multi-Model AI Testing**: Compare results from Google Gemini 2.0 Flash, Enhanced Extract Agent, and other Box AI models
- **Metadata Extraction**: Extract structured metadata from contracts and documents stored in Box
- **Ground Truth Management**: Create and manage ground truth data with side-by-side document preview
- **Performance Metrics**: Calculate accuracy, precision, recall, and F1 scores for model comparison
- **Template Management**: Configure extraction templates with custom fields and prompts
- **Real-time Progress Tracking**: Enhanced progress indicators during extraction operations

### Agent Alpha - Agentic Prompt Optimization
Agent Alpha is an intelligent prompt optimization system that automatically improves extraction prompts to achieve higher accuracy:

- **Automatic Optimization**: Analyzes extraction failures and iteratively improves prompts until reaching target accuracy
- **Multi-Field Processing**: Processes multiple fields in parallel for faster optimization
- **Smart Document Sampling**: Uses holdout validation to prevent overfitting
- **Configurable Settings**: Customize test model, document count, max attempts, and concurrency
- **System Prompt Customization**: Create and manage custom system prompt versions for different use cases
- **Real-time Progress**: Live progress tracking with field-by-field status updates
- **Preview & Apply**: Review generated prompts before applying them to your template

### Prompt Studio - Manual Prompt Engineering
Prompt Studio provides a comprehensive environment for manually crafting and testing extraction prompts:

- **AI-Assisted Generation**: Generate initial prompts using AI based on field type and context
- **Iterative Improvement**: Provide feedback to improve prompts incrementally
- **Version History**: Track all prompt versions with metrics and favorites
- **Live Testing**: Test prompts against selected documents with real-time results
- **System Prompt Integration**: Use custom system prompts to guide prompt generation
- **Prompt Library**: Save and reuse successful prompts across fields

### Recent Optimizations (2024-2025)
- ✅ **Agent Alpha**: Agentic prompt optimization with parallel processing and holdout validation
- ✅ **Prompt Studio**: AI-assisted prompt engineering with version history and testing
- ✅ **System Prompt Management**: Customizable system prompts for Agent Alpha and Prompt Studio
- ✅ **Extract Constants**: Reduced 58+ hardcoded strings to 28 organized constants (74% reduction)
- ✅ **Enhanced Progress State**: Detailed progress tracking with time estimation and completion status

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
   cd box-optimizer
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

#### Agent Alpha - Automatic Prompt Optimization
1. **Run Initial Comparison**: First run a comparison to generate accuracy metrics
2. **Launch Agent Alpha**: Click the Agent Alpha button in the toolbar
3. **Configure Settings**:
   - Choose a System Prompt (or use default)
   - Select the model to test with
   - Set number of test documents (1-25)
   - Configure max attempts per field (1-10)
   - Set concurrent field processing (1-8)
4. **Start Optimization**: Click "Start Agent" to begin
5. **Monitor Progress**: Watch real-time progress as fields are optimized
6. **Review Results**: Preview optimized prompts with accuracy improvements
7. **Apply Changes**: Click "Apply Prompts" to save improvements

#### Prompt Studio - Manual Prompt Engineering
1. **Open Prompt Studio**: Click the prompt icon on any field in the extraction table
2. **Generate Initial Prompt**: Click "Generate Prompt" for AI-assisted creation
3. **Refine the Prompt**: Edit manually or provide improvement feedback
4. **Test Your Prompt**: Select up to 3 files and click "Test" to validate
5. **Save Version**: Click "Save as New Version" to preserve your changes
6. **Access Library**: Browse saved prompts from the Prompt Library

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
│   ├── ui/               # Radix UI components (Radix + shadcn/ui)
│   ├── agent-alpha/      # Agent Alpha optimization modal
│   │   ├── agent-alpha-modal.tsx    # Main modal container
│   │   ├── views/                   # Configure, Running, Preview views
│   │   ├── components/              # Shared components
│   │   └── types.ts                 # TypeScript interfaces
│   ├── prompt-studio/    # Prompt Studio engineering interface
│   │   ├── prompt-studio-sheet.tsx  # Main sheet component
│   │   ├── panels/                  # File selection, test results
│   │   └── components/              # Version history card
│   ├── extraction-table.tsx
│   └── extraction-modal.tsx
├── lib/                  # Utilities and constants
│   ├── agent-alpha-config.ts        # Agent Alpha configuration
│   ├── agent-alpha-types.ts         # Type definitions
│   └── system-prompt-storage.ts     # System prompt persistence
├── services/             # Box API integration
├── ai/                   # AI flows and prompts
│   └── flows/
│       ├── agent-alpha-prepare.ts   # Work plan preparation
│       ├── agent-alpha-process-field.ts  # Field optimization
│       └── agent-alpha-iteration.ts # Iteration logic
└── hooks/                # Custom React hooks
    └── use-agent-alpha-runner.ts    # Agent Alpha orchestration
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
  - [User Guide](./docs/USER_GUIDE.md) - Comprehensive guide for Agent Alpha and Prompt Studio
  - [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and solutions
  - [Quick Start](./QUICK_START_AGENT_ALPHA.md) - Get started with Agent Alpha in 5 minutes
  - [Architecture](./docs/architecture/) - System architecture and data flows
  - [Testing Documentation](./docs/testing/) - Testing strategy and implementation
  - [Feature Documentation](./docs/features/) - Feature-specific guides
  - [Implementation Guides](./docs/implementation/) - Migration and implementation plans
- Report issues in the GitHub Issues section
- Contact the development team for enterprise support

## 🔗 Links

- [Box Developer Documentation](https://developer.box.com/)
- [Box AI Enterprise](https://www.box.com/ai/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Radix UI Components](https://www.radix-ui.com/)
