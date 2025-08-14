# Product Design Requirements (PDR)

This directory contains the Product Design Requirements documentation for the Box Accuracy App.

## Structure

- `pdr.md` - Main Product Design Requirements document
- `user-stories.md` - User stories and acceptance criteria
- `technical-specs.md` - Technical specifications and architecture decisions
- `mockups/` - Design mockups, wireframes, and visual assets

## Screenshots Reference

The application screenshots demonstrating the current implementation are located in the `Product Screenshots/` directory and include:

### Core Functionality
- `Home Page.png` - Main dashboard with extraction results
- `Run Comparison.png` - Document processing workflow
- `Select Documents Form.png` - File selection interface
- `Files added to Grid with Metadata Fields.png` - Results display

### Template Management
- `View Templates.png` - Template listing
- `Add new template from Box.png` - Template creation

### Ground Truth Management
- `Grount Truth Page - List Files from Box.png` - Ground truth interface
- `Edit Ground Truth.png` - Ground truth editing

### Prompt Engineering
- `Geneate a new prompt.png` - Prompt generation
- `Edit Prompt.png` - Prompt editing interface

### Settings & Configuration
- `Settings - Developer Token.png` - Developer token configuration
- `Setting - Service Account.png` - Service account setup

### Analytics & Metrics
- `View Metrics - F1 Score.png` - Performance metrics display
- `Select Models to run.png` - Model selection interface

## Mockups & Design Assets

The `mockups/` directory contains design assets organized by type:

### Design Organization
- `mockups/wireframes/` - Low-fidelity wireframes and sketches
- `mockups/ui-mockups/` - High-fidelity UI mockups
- `mockups/user-flows/` - User journey diagrams and flow charts
- `mockups/design-system/` - Design tokens, color palettes, typography

### Usage
When referencing screenshots in the PDR document, use relative paths like:
- Current implementation: `../Product Screenshots/[filename].png`
- Design mockups: `./mockups/[category]/[filename].png`

## Documentation Integration

### In PDR Documents
```markdown
![Current Implementation](../Product Screenshots/Home Page.png)
![Design Mockup](./mockups/ui-mockups/home-dashboard-v2.png)
![User Flow](./mockups/user-flows/priya-ground-truth-flow.png)
```

### Version Control
- Keep all design assets in version control
- Use descriptive commit messages for design changes
- Tag major design iterations with version numbers 