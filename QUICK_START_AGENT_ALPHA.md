# Agent-Alpha Quick Start Guide

## What is Agent-Alpha?
An agentic approach to generating high-quality extraction prompts using iterative refinement and Gemini best practices.

---

## Quick Test (5 Minutes)

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Load Data
- Open http://localhost:9002
- Select **Contracts** template
- Add **8 documents** with ground truth

### 3. Run Comparison
- Select **2 models** (e.g., Gemini 2.5 Flash + Enhanced Extract Agent)
- Click **"Run Comparison"**
- Wait for results (should see some fields < 100%)

### 4. Run Agent-Alpha
- Select **test model** from dropdown (e.g., Gemini 2.5 Flash)
- Click **"Agent - Alpha"** button
- Confirm in dialog
- **Watch progress modal** (shows current field, iteration, time)

### 5. Review & Accept
- **Preview modal** opens with generated prompts
- Review improvements (old vs new prompts)
- Click **"Apply All Prompts"** to save

### 6. Verify
- Open **Prompt Studio** for a field
- Look for new version with **"Gen w/Agent"** badge

---

## What to Expect

### Progress Modal Shows:
- ✅ Current field being processed
- ✅ Iteration count (e.g., "Iteration 2/5")
- ✅ Progress (e.g., "3 / 12 Fields")
- ✅ Estimated vs elapsed time
- ✅ List of 3 sampled documents

### Preview Modal Shows:
- ✅ Run summary (fields optimized, avg improvement)
- ✅ Timing comparison (estimated vs actual)
- ✅ Test documents table
- ✅ Field updates with old/new prompts side-by-side

### Generated Prompts Include:
- ✅ Explicit output format ("Extract 'Yes' if...")
- ✅ Search scope ("Search entire document")
- ✅ Synonym variations ("for convenience", "without cause")
- ✅ Negative guidance ("Do NOT classify X as Y")
- ✅ Clear decision logic (if-then rules)

---

## Performance

- **Target**: 12 fields in 1-2 minutes
- **Documents**: 3 sampled (most failures)
- **Iterations**: Up to 5 per field
- **Model**: Google Gemini 2.5 Pro for prompt generation

---

## Debugging

### Console Logs (F12)
```
🤖 Agent-Alpha: Preparing work plan...
📊 Found 5 field(s) to optimize
📄 Selected 3 document(s) for testing
🔄 Agent-Alpha: [1/5] Testing field "Contract Type"
   Accuracy: 66.7%
   🤖 Generating improved prompt...
   ✨ New Prompt: "..."
```

### Common Issues

**"No comparison results"**
- Run comparison first before Agent-Alpha

**"Select Model"**
- Choose a test model from dropdown

**Slow performance**
- Check network connection
- Verify Box AI API is responding

---

## Key Features

### ✅ Iterative Refinement
- Tests prompt → Analyzes failures → Generates improved prompt → Repeats

### ✅ Smart Sampling
- Selects 3 documents with most field failures
- Maximizes coverage, minimizes API calls

### ✅ Gemini Best Practices
- 7 extraction prompt rules
- Example-driven approach
- Field-type specific guidance

### ✅ Human-in-the-Loop
- Preview all changes before saving
- Accept or discard as a batch

### ✅ Separate from Core App
- No impact on existing features
- Can be disabled/removed easily

---

## Key Files

- **`src/lib/agent-alpha-prompts.ts`** - Prompt generation logic
- **`src/components/agent-alpha/agent-alpha-modal.tsx`** - Progress & preview UI
- **`src/hooks/use-agent-alpha-runner.ts`** - React integration
- **`docs/architecture/agent-alpha-gemini-improvements.md`** - Detailed Gemini best practices
- **`docs/architecture/agent-alpha-prompt-improvements.md`** - V2 prompt generation design

---

## Success Metrics

- **Prompt Quality**: More specific, comprehensive, actionable
- **Convergence Speed**: Fewer iterations needed (< 5)
- **Accuracy Improvement**: Higher final accuracy vs initial
- **Time**: 1-2 minutes for 12 fields

