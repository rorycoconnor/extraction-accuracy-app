# Box Optimizer

A comprehensive tool for optimizing AI model accuracy in metadata extraction from Box documents.

## Features

### Core Functionality
- **Multi-Model AI Testing**: Compare results across 15+ models from Google, Anthropic, OpenAI, and Box (Gemini 2.5 Flash/Pro, Claude 3.7/4/4.5 Sonnet, GPT-4.1/5/5.1, OpenAI O3, Enhanced Extract Agent)
- **Metadata Extraction**: Extract structured metadata from contracts and documents stored in Box
- **Ground Truth Management**: Create and manage ground truth data with side-by-side document preview
- **Performance Metrics**: Calculate accuracy, precision, recall, and F1 scores for model comparison
- **Template Management**: Configure extraction templates with custom fields and prompts
- **Real-time Progress Tracking**: Live progress updates as extractions complete with ~10x speedup via server-side parallel processing
- **Comparison Types**: Configure per-field comparison strategies (exact, near-exact, semantic, LLM-as-judge)
- **Semantic Matching**: Intelligent value matching with acronym expansion and bidirectional matching

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
- **Prompt Library**: Save and reuse successful prompts across fields and templates

## Technology Stack

- **Frontend**: Next.js 15.3.6 with TypeScript and React 19
- **UI Framework**: Radix UI components with Tailwind CSS
- **AI Integration**: Box AI Enterprise models (multi-vendor: Google, Anthropic, OpenAI, Azure)
- **Box Integration**: Box Node SDK with OAuth, Service Account, and Developer Token authentication
- **Styling**: Tailwind CSS with custom design system and dark mode support
- **Testing**: Vitest with React Testing Library
- **Development**: Hot reload with comprehensive error handling

## Getting Started

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

## Usage

### Quick Start
1. **Configure Settings**: Add your Box Developer Token, Service Account, or connect via OAuth
2. **Select Template**: Choose from pre-configured templates or create custom ones
3. **Run Extraction**: Select documents and AI models to compare
4. **Review Results**: Analyze extraction results and performance metrics
5. **Set Ground Truth**: Add accurate metadata for training and validation

### Key Workflows

#### Document Extraction
- Browse and select documents from any Box folder
- Choose AI models for comparison (with or without custom prompts)
- Configure extraction templates with custom fields
- Run parallel extractions with real-time progress (~10x speedup)
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

## Architecture

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
├── features/             # Feature modules
│   └── prompt-library/              # Cross-template prompt management
├── lib/                  # Utilities and constants
│   ├── actions/                     # Server actions (Box API, storage, settings)
│   ├── agent-alpha-*.ts             # Agent Alpha config, types, prompts, sampling
│   ├── compare-engine.ts            # Comparison strategies
│   ├── concurrency.ts               # Parallel processing utilities
│   ├── error-handler.ts             # Error classification and retry
│   └── types.ts                     # Core type definitions
├── services/             # External service integration
│   ├── box.ts                       # Box API (extraction, templates, files)
│   └── oauth.ts                     # OAuth token management
├── store/                # State management
│   └── AccuracyDataStore.tsx        # Zustand-style context + reducer store
├── ai/                   # AI flows and prompts
│   └── flows/
│       ├── batch-metadata-extraction.ts  # Parallel batch extraction
│       ├── agent-alpha-*.ts              # Agent Alpha iteration logic
│       └── llm-comparison.ts             # LLM-as-judge comparison
└── hooks/                # Custom React hooks
    ├── use-agent-alpha-runner.ts    # Agent Alpha orchestration
    └── use-model-extraction-runner.tsx  # Batch extraction runner
```

### Key Technical Highlights
- **Parallel Extraction**: Server-side batch processing with 10 concurrent requests (~10x speedup)
- **Error Resilience**: Structured error classification with retry logic and exponential backoff
- **Type Safety**: Comprehensive TypeScript types with Zod schemas for runtime validation
- **State Management**: Unified store with React Context + useReducer pattern
- **Prompt Versioning**: Full history tracking with metrics, source tracking, and cross-template storage

## Configuration

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

## Performance Metrics

The application calculates comprehensive metrics:
- **Accuracy**: Overall correctness of extractions
- **Precision**: Relevance of extracted information
- **Recall**: Completeness of extraction
- **F1 Score**: Harmonic mean of precision and recall

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Documentation

- [Documentation Index](./docs/README.md) - Full documentation navigation
- [User Guide](./docs/USER_GUIDE.md) - Comprehensive guide for Agent Alpha and Prompt Studio
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Quick Start: Agent Alpha](./QUICK_START_AGENT_ALPHA.md) - Get started in 5 minutes
- [Architecture](./docs/architecture/) - System architecture, AI prompt design, and data flows
- [Testing](./docs/testing/) - Testing strategy and implementation plans
- [Features](./docs/features/) - Feature-specific documentation

## Links

- [Box Developer Documentation](https://developer.box.com/)
- [Box AI Enterprise](https://www.box.com/ai/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Radix UI Components](https://www.radix-ui.com/)
