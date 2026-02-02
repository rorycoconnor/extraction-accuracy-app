# User Guide: Agent Alpha & Prompt Studio

This guide covers the two main prompt optimization features in Box Optimizer: **Agent Alpha** for automatic optimization and **Prompt Studio** for manual prompt engineering.

## Table of Contents

1. [Overview](#overview)
2. [Agent Alpha](#agent-alpha)
   - [Prerequisites](#agent-alpha-prerequisites)
   - [Configuration](#agent-alpha-configuration)
   - [Running the Agent](#running-the-agent)
   - [Understanding Results](#understanding-results)
   - [Applying Prompts](#applying-prompts)
3. [Prompt Studio](#prompt-studio)
   - [Opening Prompt Studio](#opening-prompt-studio)
   - [Generating Prompts](#generating-prompts)
   - [Testing Prompts](#testing-prompts)
   - [Version History](#version-history)
4. [System Prompts](#system-prompts)
5. [Best Practices](#best-practices)
6. [FAQ](#faq)

---

## Overview

Box Optimizer provides two complementary approaches to improving extraction accuracy:

| Feature | Use Case | Approach |
|---------|----------|----------|
| **Agent Alpha** | Bulk optimization of multiple fields | Automatic, AI-driven iteration |
| **Prompt Studio** | Fine-tuning individual fields | Manual, human-guided refinement |

Both features can use custom **System Prompts** to guide how prompts are generated and improved.

---

## Agent Alpha

Agent Alpha is an agentic prompt optimization system that automatically improves extraction prompts by:
1. Identifying fields below 100% accuracy
2. Analyzing extraction failures
3. Generating improved prompts iteratively
4. Validating improvements against holdout documents

### Agent Alpha Prerequisites

Before using Agent Alpha, ensure you have:

1. **Loaded Documents**: Select documents from your Box folder
2. **Run Comparison**: Execute at least one comparison to establish baseline accuracy
3. **Ground Truth Data**: Fields need ground truth values for accuracy measurement

### Agent Alpha Configuration

When you open Agent Alpha, you'll see the configuration panel with these options:

#### System Prompt Selection
- **Default**: Uses the built-in prompt generation instructions
- **Custom Versions**: Create specialized instructions for your use case

#### Model to Test With
Select which AI model to use for testing prompt effectiveness:
- Google Gemini 2.5 Flash (recommended for speed)
- Google Gemini 2.5 Pro (higher quality, slower)
- Other available models

#### Test Documents (1-25)
Number of documents to sample for testing. More documents = more reliable results but longer processing time.

**Recommendation**: Start with 5-8 documents for a balance of speed and reliability.

#### Max Attempts (1-10)
Maximum iterations per field before giving up. Each iteration:
1. Tests the current prompt
2. Analyzes failures
3. Generates an improved prompt
4. Re-tests the improved prompt

**Recommendation**: 5 attempts is usually sufficient.

#### Concurrent Fields (1-8)
Number of fields to process in parallel. Higher values = faster processing but may hit API rate limits.

**Recommendation**: 3-5 for most cases.

### Running the Agent

1. Click **Start Agent** to begin optimization
2. Watch the progress panel showing:
   - **Processing**: Fields currently being optimized
   - **Processed**: Completed fields with results
   - **Progress Bar**: Overall completion percentage

The agent will:
- Show initial accuracy for each field
- Display "Optimizing..." status during work
- Update final accuracy when complete
- Show the optimized prompt preview

### Understanding Results

After completion, you'll see:

#### Summary Statistics
- **Fields Processed**: Total fields optimized
- **Will Apply**: Fields with improved prompts
- **Will Skip**: Fields where optimization didn't help
- **Avg Improvement**: Average accuracy gain

#### Per-Field Results
For each field:
- **Previous Accuracy**: Starting accuracy percentage
- **New Accuracy**: Final accuracy after optimization
- **Percent Change**: Improvement amount
- **Original Prompt**: What you started with
- **Optimized Prompt**: The new AI-generated prompt
- **Tested On**: Documents used for validation

#### Result Categories
- **Optimized with Ground Truth**: Fields with measurable accuracy improvements
- **Prompt Generated (No Ground Truth)**: Fields without ground truth that received new prompts

### Applying Prompts

After reviewing results:

1. **Apply Prompts**: Saves all improved prompts to your template
2. **Cancel**: Discards all changes, keeps original prompts

Applied prompts are:
- Saved to your template configuration
- Added to version history with "Agent Alpha" source tag
- Available for further refinement in Prompt Studio

---

## Prompt Studio

Prompt Studio provides a focused environment for crafting and testing extraction prompts for individual fields.

### Opening Prompt Studio

Click the prompt icon (wand) on any field row in the extraction table to open Prompt Studio for that field.

### Generating Prompts

#### For Empty Fields
Click **Generate Prompt** to create an initial prompt based on:
- Field name and type
- Document context
- Active system prompt instructions

#### For Existing Prompts
1. Enter improvement feedback in the "What do you need this prompt to do better?" field
2. Click **Improve Prompt** to generate a refined version

Example feedback:
- "Extract the full legal entity name including LLC, Inc. suffixes"
- "Look for dates in the signature block, not the header"
- "Return 'Not Present' if the field is blank"

### Testing Prompts

1. Click **Test** button
2. Select up to 3 files from categorized lists:
   - **Mismatches**: Files where extraction failed
   - **Partial Matches**: Files with partial accuracy
   - **Matches**: Files with correct extraction
3. Click **Run Test** to execute extraction with your prompt
4. Review results comparing:
   - Ground Truth value
   - Model extraction with your prompt

### Version History

Prompt Studio automatically tracks all saved versions:

- **Version Number**: Sequential version identifier
- **Saved Date**: When the version was created
- **Source Badge**: How it was created (Manual, Agent Alpha, Generated)
- **Favorite**: Star important versions for easy access
- **Use Version**: Load a previous version as the active prompt
- **Delete**: Remove unwanted versions

### Prompt Library

Click **Library** to access the cross-field prompt library:
- Browse prompts saved from other fields
- Import successful prompts for similar field types
- Build a collection of reusable prompt templates

---

## System Prompts

System prompts control how Agent Alpha and Prompt Studio generate and improve prompts.

### Managing System Prompts

1. Click **System Prompt** button (gear icon) in Agent Alpha or Prompt Studio
2. View available versions in the dropdown
3. **Set as Active**: Use this version for prompt generation
4. **Create New Version**: Save modified instructions
5. **Delete**: Remove custom versions (cannot delete default)

### Creating Custom System Prompts

Customize instructions for specific use cases:

```
## COMPANY CONFIGURATION
Company Name: Acme Corporation
Company Address: 123 Main Street, Anytown, USA

## CUSTOM RULES
- Always identify the counter-party (not Acme Corporation)
- For addresses, include suite/unit numbers
- Return dates in YYYY-MM-DD format
```

### When to Use Custom System Prompts

- **Industry-Specific**: Legal contracts, healthcare forms, financial documents
- **Company-Specific**: When your company name appears in documents
- **Field-Specific**: Unique extraction requirements for specialized fields

---

## Best Practices

### For Agent Alpha

1. **Start with Ground Truth**: Ensure at least 5-10 documents have ground truth data
2. **Use Sufficient Documents**: 8+ documents provides reliable validation
3. **Review Before Applying**: Always check the optimized prompts make sense
4. **Iterate**: Run Agent Alpha multiple times if accuracy plateaus

### For Prompt Studio

1. **Be Specific**: Include locations, synonyms, and format requirements
2. **Test on Problem Files**: Focus testing on files that currently fail
3. **Save Frequently**: Create versions after each significant improvement
4. **Learn from Failures**: Analyze why extractions fail before modifying prompts

### Prompt Writing Guidelines

Effective prompts include:

1. **Location**: Where to look in the document
   - "Look in the signature block, first paragraph, or Notices section"

2. **Synonyms**: Alternative phrases to search for
   - "Look for 'effective date', 'commencement date', 'as of', 'dated'"

3. **Format**: Expected output format
   - "Return in YYYY-MM-DD format"

4. **Disambiguation**: What NOT to extract
   - "Do NOT confuse with the expiration date or signature date"

5. **Not Found Handling**: What to return when missing
   - "Return 'Not Present' if not found"

---

## FAQ

### Why isn't Agent Alpha improving accuracy?

- **Insufficient Ground Truth**: Need ground truth data to measure accuracy
- **Already Optimized**: Fields at 100% accuracy are skipped
- **Complex Fields**: Some fields may require manual prompt engineering
- **Document Quality**: OCR issues or unusual document formats

### How long does Agent Alpha take?

Processing time depends on:
- Number of fields below 100% accuracy
- Document count and complexity
- Model response times
- Max attempts setting

**Typical times**:
- 5 fields, 5 docs: ~2-5 minutes
- 10 fields, 8 docs: ~5-10 minutes

### Can I undo Agent Alpha changes?

Yes! Every prompt change is versioned:
1. Open Prompt Studio for the field
2. Find the previous version in history
3. Click **Use Version** to restore it

### Why are some fields skipped?

Agent Alpha skips fields when:
- Accuracy is already 100%
- Field is disabled in template configuration
- No ground truth data available
- Generated prompt performed worse than original

### How do I know if a prompt is good?

A good prompt achieves:
- High accuracy across diverse documents
- Consistent results on similar document types
- Appropriate "Not Present" handling for missing data

Test with the **Test** feature in Prompt Studio to validate before saving.
