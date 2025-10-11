# Documentation Organization

This document describes the current organization of the Box AI Accuracy Testing Application.

## 📁 Project Structure

### Root Level
The root directory contains only essential project files:
- **Configuration files**: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, etc.
- **Essential docs**: `README.md` - Main project documentation
- **Environment**: `env.local` - Environment configuration
- **Build files**: `.next/`, `node_modules/` (gitignored)

### Source Code (`src/`)
All application source code:
```
src/
├── app/              # Next.js App Router (pages and API routes)
├── components/       # React components
├── features/         # Feature-specific modules
├── hooks/           # Custom React hooks
├── lib/             # Utilities and constants
├── services/        # External service integrations
├── store/           # State management
└── __tests__/       # Test files
```

### Documentation (`docs/`)
All project documentation organized by category:

#### Core Documentation (`docs/`)
- `blueprint.md` - Application overview and features
- `box-ai-extraction-system.md` - AI extraction architecture
- `metrics-specification.md` - Performance metrics
- `NEXT_PRIORITIES.md` - Development roadmap
- `CHANGELOG.md` - Version history
- `ENVIRONMENT.md` - Environment setup
- `README.md` - Documentation index

#### Product Requirements (`docs/product-requirements/`)
- `pdr.md` - Product Design Requirements
- `user-stories.md` - User stories and acceptance criteria
- `technical-specs.md` - Technical specifications
- `mockups/` - Design assets and mockups

#### Testing (`docs/testing/`)
- `TESTING_STRATEGY.md` - Overall testing approach
- `TESTING_IMPLEMENTATION_PLAN.md` - Implementation details
- `TESTING_MIGRATION_BASELINE.md` - Migration status
- `FRONTEND_TESTING_PLAN.md` - Frontend testing
- `CRITICAL_TESTING_GAPS.md` - Known gaps and priorities

#### Features (`docs/features/`)
- `DASHBOARD_SIDEBAR_FEATURE.md` - Dashboard sidebar
- `PROMPT_LIBRARY_UPGRADE_PLAN.md` - Prompt library enhancements
- `MODAL_STATE_DEBUG_GUIDE.md` - Modal troubleshooting

#### Implementation (`docs/implementation/`)
- `TANSTACK_MIGRATION_PLAN.md` - TanStack Table migration
- `TANSTACK_IMPLEMENTATION_SUMMARY.md` - Implementation status
- `MIGRATION_READY_STATUS.md` - Migration readiness

#### Meta (`docs/meta/`)
- `DOCUMENTATION_SUMMARY.md` - Documentation overview
- `DOCUMENTATION_UPDATE_SUMMARY.md` - Recent changes

#### Screenshots (`docs/screenshots/`)
- All product screenshots and demos
- Referenced in product requirements documents

### Data (`data/`)
Application data files:
- `accuracyData.json` - Accuracy test results
- `configuredTemplates.json` - Extraction templates
- `fileMetadataStore.json` - File metadata cache
- `promptsStore.json` - Prompt library
- `test-import.csv` - Test data

### Other Directories
- `contract-tests/` - Contract testing files
- `patches/` - Package patches
- `node_modules/` - Dependencies (gitignored)

## 📋 Documentation Navigation

### For New Developers
1. Start with the main [README.md](../README.md)
2. Read the [Blueprint](./blueprint.md) for application overview
3. Review [Box AI Extraction System](./box-ai-extraction-system.md) for technical details
4. Check [Testing Strategy](./testing/TESTING_STRATEGY.md) for testing approach

### For Feature Work
1. Review [Product Requirements](./product-requirements/README.md)
2. Check [Feature Documentation](./features/) for specific features
3. See [Screenshots](./screenshots/) for current UI reference

### For Testing
1. [Testing Strategy](./testing/TESTING_STRATEGY.md) - Overall approach
2. [Testing Implementation Plan](./testing/TESTING_IMPLEMENTATION_PLAN.md) - Detailed plan
3. [Critical Testing Gaps](./testing/CRITICAL_TESTING_GAPS.md) - Known issues

### For Implementation
1. [TanStack Migration Plan](./implementation/TANSTACK_MIGRATION_PLAN.md)
2. [Implementation Summaries](./implementation/)
3. [Technical Specifications](./product-requirements/technical-specs.md)

## 🔄 Recent Changes

### October 2024 - Documentation Reorganization
- **Moved 16 documentation files** from root to organized subdirectories
- **Created 4 new documentation categories**: testing, features, implementation, meta
- **Moved screenshots** from `Product Screenshots/` to `docs/screenshots/`
- **Moved test data** from root `test-import.csv` to `data/`
- **Removed build artifacts** from root level
- **Updated all references** in documentation files to reflect new paths

### Benefits of New Organization
- ✅ **Cleaner root directory** - Only essential files at root level
- ✅ **Better discoverability** - Related docs grouped together
- ✅ **Easier maintenance** - Clear structure for adding new docs
- ✅ **Improved navigation** - Logical hierarchy for different user needs

## 📝 Contributing Documentation

When adding new documentation:

### Choose the Right Location
- **Core system docs** → `docs/` (root level)
- **Testing docs** → `docs/testing/`
- **Feature docs** → `docs/features/`
- **Implementation/migration docs** → `docs/implementation/`
- **Meta docs** → `docs/meta/`
- **Screenshots** → `docs/screenshots/`

### Naming Conventions
- Use UPPER_CASE for status/plan documents: `TESTING_STRATEGY.md`
- Use kebab-case for system documentation: `box-ai-extraction-system.md`
- Use Title Case for feature names in uppercase format: `DASHBOARD_SIDEBAR_FEATURE.md`

### Update the Index
When adding new documentation:
1. Add entry to appropriate section in `docs/README.md`
2. Update this `ORGANIZATION.md` if structure changes
3. Link from main `README.md` if it's a key resource

## 🔗 Quick Links

- [Main README](../README.md)
- [Documentation Index](./README.md)
- [Testing Documentation](./testing/)
- [Feature Documentation](./features/)
- [Implementation Documentation](./implementation/)
- [Product Screenshots](./screenshots/)

