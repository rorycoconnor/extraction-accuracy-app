# Mockups & Design Assets

This directory contains design mockups, wireframes, and visual assets for the Box Accuracy Optimizer application.

## Structure

### Current Implementation Screenshots
- Located in `../../Product Screenshots/` (root level)
- These show the current working implementation
- Used for reference in PDR documentation

### Design Mockups
- `wireframes/` - Low-fidelity wireframes and sketches
- `ui-mockups/` - High-fidelity UI mockups (future designs)
- `user-flows/` - User journey diagrams and flow charts
- `design-system/` - Design tokens, color palettes, typography

## Purpose

### For Designers
- Place new mockups and design iterations here
- Organize by feature area or user flow
- Include design rationale and specifications
- **Note:** Current implementation screenshots stay in `Product Screenshots/`

### For Developers
- Reference for implementation details
- Visual specifications for UI components
- User flow validation

### For Stakeholders
- Visual representation of requirements
- Before/after comparisons with current implementation
- Design evolution tracking

## Naming Convention

### Mockup Files
```
[feature]-[version]-[date].png
[user-flow]-[step]-[description].png
[component]-[state]-[variant].png
```

### Examples
- `home-dashboard-v2-2024-07-10.png`
- `prompt-studio-flow-step3-edit.png`
- `extraction-table-empty-state.png`

## Integration with PDR

When referencing mockups in the PDR documentation:

```markdown
# Current implementation
![Current Home Page](../Product Screenshots/Home Page.png)

# Future designs
![Proposed Dashboard](./mockups/ui-mockups/home-dashboard-v2.png)
![User Flow Diagram](./mockups/user-flows/authentication-flow.png)
```

## Version Control

- Keep mockups in version control for design history
- Use descriptive commit messages for design changes
- Tag major design iterations with version numbers 