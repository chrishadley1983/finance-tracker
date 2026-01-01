# Phase 3b: AI-Powered Import Enhancements

**Implementation Prompts for Claude Code**  
**Version:** 1.0  
**Date:** January 2026  
**Prerequisite:** Phase 3a complete (core CSV import working)

---

## Overview

Phase 3b adds intelligent features to the CSV import system, leveraging Claude API and existing transaction data to make imports faster and more accurate.

### Goals

1. **AI Column Mapping** - Claude analyses unknown CSV formats and suggests mappings
2. **Smart Categorisation** - Auto-categorise imports using existing transaction patterns
3. **Bulk Edit Mode** - Edit multiple transactions before committing
4. **Import Templates** - Save and reuse custom mappings
5. **Learning System** - User corrections improve future categorisation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Import Pipeline                          │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   Upload     │   AI Mapper  │  AI Categorize│  Bulk Edit   │
│   (3a done)  │   (3b.1)     │   (3b.2-3)    │  (3b.4)      │
└──────────────┴──────────────┴──────────────┴───────────────┘
                      │                │
                      ▼                ▼
              ┌──────────────┐  ┌──────────────┐
              │ Claude API   │  │ Existing     │
              │              │  │ Transactions │
              └──────────────┘  └──────────────┘
```

---

## Prompt 3b.1: AI Column Mapping Service

### Context

When the format detector fails to recognise a CSV, use Claude to analyse the headers and sample data to suggest appropriate column mappings.

### File Structure

```
src/
├── lib/
│   └── import/
│       ├── ai-mapper.ts        # Claude-powered column mapping
│       └── prompts/
│           └── column-mapping.ts  # Prompt templates
├── app/
│   └── api/
│       └── import/
│           └── ai-suggest/route.ts  # AI suggestion endpoint
```

### Prompt

```
I need an AI-powered column mapping service that uses Claude to analyse unknown CSV formats and suggest appropriate mappings.

## File: src/lib/import/prompts/column-mapping.ts

Define the prompt template for column mapping analysis:

```typescript
export const COLUMN_MAPPING_PROMPT = `You are analysing a CSV file to identify which columns contain financial transaction data.

The CSV has the following headers:
{headers}

Here are the first 5 rows of data:
{sampleRows}

Identify which columns map to these required fields:
1. **date** - Transaction date (required)
2. **amount** - Transaction amount (required). Note if amounts are in a single column or split into debit/credit columns.
3. **description** - Transaction description/narrative (required)
4. **reference** - Reference number or transaction ID (optional)
5. **balance** - Running balance after transaction (optional)

Also identify:
- Date format used (e.g., DD/MM/YYYY, YYYY-MM-DD)
- Whether amounts use comma or period as decimal separator
- Whether debits are negative or in a separate column
- Any other observations about the format

Respond in JSON format:
{
  "mapping": {
    "date": "column_name or null",
    "description": "column_name or null",
    "amount": "column_name or null",
    "debit": "column_name or null (if separate)",
    "credit": "column_name or null (if separate)",
    "reference": "column_name or null",
    "balance": "column_name or null"
  },
  "dateFormat": "detected format string",
  "decimalSeparator": "." or ",",
  "amountStyle": "single" or "separate",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of your analysis",
  "warnings": ["any concerns about the data"]
}`;
```

## File: src/lib/import/ai-mapper.ts

Service for AI-powered column mapping:

### suggestColumnMapping(headers: string[], sampleRows: string[][]): Promise<AIMappingResult>

Implementation:
1. Format the prompt with headers and sample data
2. Call Claude API (claude-sonnet-4-20250514 for speed/cost balance)
3. Parse JSON response
4. Validate suggested mapping makes sense
5. Return structured result

```typescript
interface AIMappingResult {
  mapping: ColumnMapping;
  dateFormat: string;
  decimalSeparator: string;
  amountStyle: 'single' | 'separate';
  confidence: number;
  reasoning: string;
  warnings: string[];
}
```

Error handling:
- If Claude response isn't valid JSON, retry once
- If mapping is incomplete (missing required fields), return with low confidence
- Timeout after 30 seconds

Cost control:
- Only call AI when format detection fails (confidence < 0.6)
- Cache results by headers hash (same headers = same mapping)
- Limit to 10 AI mapping calls per day (configurable)

## File: src/app/api/import/ai-suggest/route.ts

API endpoint for AI mapping suggestions.

### POST /api/import/ai-suggest

Request:
```typescript
{
  sessionId: string,
  headers: string[],
  sampleRows: string[][]
}
```

Response:
```typescript
{
  suggestion: AIMappingResult,
  usedCache: boolean,
  rateLimitRemaining: number
}
```

Implementation:
1. Check rate limit (stored in database or KV)
2. Check cache for this header combination
3. If not cached, call AI mapper service
4. Cache result
5. Return suggestion

## UI Integration

Update MappingStep.tsx to use AI suggestions:

1. When format detection fails (confidence < 0.6):
   - Show "Unknown format" message
   - Display "✨ Get AI suggestion" button
   - Button has magic wand icon

2. On clicking AI suggestion button:
   - Show loading state: "Analysing format..."
   - Call POST /api/import/ai-suggest
   - Show result with confidence indicator

3. Display AI suggestion:
   - Pre-fill column dropdowns with suggested mapping
   - Show confidence badge: "AI Confidence: 85%"
   - Show reasoning in expandable section
   - Show any warnings from AI
   - User can accept or modify suggestions

4. Cost indicator:
   - Small text: "3 AI suggestions remaining today"
   - Encourage accepting suggestions to save quota

## Caching Strategy

Create a simple cache table:

```sql
CREATE TABLE ai_mapping_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headers_hash text UNIQUE,
  headers jsonb,
  result jsonb,
  created_at timestamptz DEFAULT now(),
  hits int DEFAULT 0
);
```

Headers hash: SHA256 of sorted, normalized headers joined.

## Verification

1. Upload a CSV with unknown format
2. Format detection shows "Unknown format"
3. Click AI suggestion button
4. Claude analyses and returns mapping
5. Mapping fields are pre-filled
6. Can modify and continue
7. Second upload with same headers uses cache

## Do NOT

- Use AI for known formats (HSBC, Monzo, etc.)
- Call AI on every upload automatically
- Store raw CSV data in AI prompts beyond samples
- Send sensitive transaction details to AI
```

---

## Prompt 3b.2: Categorisation Engine

### Context

Build a categorisation engine that uses multiple strategies: exact match rules, pattern matching, similar transaction lookup, and Claude API as fallback.

### File Structure

```
src/
├── lib/
│   └── categorisation/
│       ├── engine.ts           # Main categorisation orchestrator
│       ├── rule-matcher.ts     # Exact and pattern matching
│       ├── similar-lookup.ts   # Find similar transactions
│       ├── ai-categoriser.ts   # Claude API categorisation
│       └── prompts/
│           └── categorise.ts   # Prompt templates
```

### Prompt

```
I need a multi-strategy categorisation engine that can automatically categorise imported transactions using rules, patterns, similar transactions, and AI fallback.

## File: src/lib/categorisation/engine.ts

Main orchestrator for categorisation:

### categoriseTransaction(transaction: ParsedTransaction): Promise<CategorisationResult>

Strategy priority:
1. **Exact rule match** - category_mappings table with match_type='exact'
2. **Pattern match** - category_mappings with match_type='contains' or 'regex'
3. **Similar transaction** - Find existing transaction with similar description
4. **AI categorisation** - Claude API as final fallback

```typescript
interface CategorisationResult {
  categoryId: string | null;
  categoryName: string | null;
  source: 'rule_exact' | 'rule_pattern' | 'similar' | 'ai' | 'none';
  confidence: number;  // 0-1
  matchDetails: string;  // What triggered this match
  alternatives?: {
    categoryId: string;
    categoryName: string;
    confidence: number;
  }[];
}
```

Implementation:
1. Try exact rule match first
2. If no exact match, try pattern rules
3. If no pattern match, look for similar transactions
4. If no similar match (or low confidence), try AI
5. Return result with source and confidence

### categoriseMultiple(transactions: ParsedTransaction[]): Promise<CategorisationResult[]>

Batch categorisation with optimizations:
- Batch similar description lookups
- Group AI calls (up to 10 transactions per prompt)
- Return results in same order as input

## File: src/lib/categorisation/rule-matcher.ts

### matchExactRule(description: string): Promise<RuleMatch | null>

Query category_mappings where match_type='exact' and pattern matches description exactly (case-insensitive).

### matchPatternRule(description: string): Promise<RuleMatch | null>

Query category_mappings where:
- match_type='contains' and description includes pattern
- match_type='regex' and description matches regex

Order by confidence DESC, return first match.

## File: src/lib/categorisation/similar-lookup.ts

### findSimilarTransactions(description: string, limit?: number): Promise<SimilarMatch[]>

Find existing transactions with similar descriptions:

1. Normalize description (lowercase, remove special chars)
2. Extract key tokens (split on space, filter stopwords)
3. Query transactions with category_id IS NOT NULL
4. Score by:
   - Exact token matches (+2 per token)
   - Partial token matches (+1 per token)
   - Same category frequency boost
5. Return top matches with scores

SQL approach using trigram similarity (if pg_trgm extension available):
```sql
SELECT t.*, c.name as category_name,
       similarity(description, $1) as sim_score
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.category_id IS NOT NULL
  AND similarity(description, $1) > 0.3
ORDER BY sim_score DESC
LIMIT 5;
```

Alternative without extension: fetch recent categorised transactions and score in application code.

### SimilarMatch interface:
```typescript
{
  transactionId: string;
  description: string;
  categoryId: string;
  categoryName: string;
  similarity: number;  // 0-1
  date: Date;
}
```

## File: src/lib/categorisation/ai-categoriser.ts

### categoriseWithAI(transaction: ParsedTransaction, categories: Category[]): Promise<AICategorisationResult>

Single transaction categorisation via Claude.

### categoriseBatchWithAI(transactions: ParsedTransaction[], categories: Category[]): Promise<AICategorisationResult[]>

Batch categorisation (up to 10 at once for efficiency).

## File: src/lib/categorisation/prompts/categorise.ts

```typescript
export const SINGLE_CATEGORISE_PROMPT = `You are categorising a financial transaction.

Transaction:
- Date: {date}
- Description: {description}
- Amount: {amount}

Available categories:
{categoriesList}

Select the most appropriate category for this transaction. Consider:
- The merchant or payee name in the description
- Common transaction patterns
- Amount (positive = income, negative = expense)

Respond in JSON:
{
  "categoryId": "uuid of best match",
  "categoryName": "name for verification",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation",
  "alternatives": [
    {"categoryId": "uuid", "categoryName": "name", "confidence": 0.X}
  ]
}`;

export const BATCH_CATEGORISE_PROMPT = `You are categorising multiple financial transactions.

Transactions:
{transactionsList}

Available categories:
{categoriesList}

For each transaction, select the most appropriate category.

Respond in JSON array:
[
  {
    "index": 0,
    "categoryId": "uuid",
    "categoryName": "name",
    "confidence": 0.0 to 1.0,
    "reasoning": "brief explanation"
  },
  ...
]`;
```

## Database Updates

Ensure categories table is accessible and has good data.

Consider adding a categorisation_confidence column to transactions:
```sql
ALTER TABLE transactions 
ADD COLUMN categorisation_confidence decimal(3,2);
```

## Verification

Test with various transaction descriptions:
1. "TESCO STORES" → should match grocery rule or similar transaction
2. "DIRECT DEBIT - SKY" → should match entertainment or pattern rule
3. "Amazon.co.uk" → should find similar or use AI
4. Completely novel description → should use AI

## Do NOT

- Call AI for every transaction (expensive)
- Override existing manual categorisations
- Store full transaction details in AI prompts unnecessarily
- Categorise transfers between own accounts
```

---

## Prompt 3b.3: Import Categorisation UI

### Context

Integrate the categorisation engine into the import preview step, allowing users to review, modify, and learn from categorisations.

### File Structure

```
src/
├── components/
│   └── import/
│       ├── CategorisedPreview.tsx    # Enhanced preview with categories
│       ├── CategoryCell.tsx          # Category display/edit cell
│       ├── CategoryConfidence.tsx    # Confidence indicator
│       └── BulkCategorise.tsx        # Bulk categorisation actions
```

### Prompt

```
I need UI components for reviewing and editing auto-categorised transactions during import.

## Component: CategorisedPreview.tsx

Enhanced preview step that includes categorisation.

This replaces/extends the PreviewStep from Phase 3a to include category information.

Features:

1. Auto-categorise on Load
   - After preview data loads, trigger categorisation
   - Show progress: "Categorising transactions... 45/100"
   - Use categoriseMultiple from engine

2. Category Column in Preview Table
   - Add "Category" column after Amount
   - Show category name with confidence indicator
   - Click to edit category

3. Confidence Indicators
   - High (>0.8): Green dot, solid text
   - Medium (0.5-0.8): Yellow dot, normal text
   - Low (<0.5): Red dot, italic text with "?"
   - None: Gray "Uncategorised" text

4. Category Source Badges
   - Small badge showing source: "rule", "similar", "AI"
   - Tooltip explains what matched

5. Filter by Categorisation
   - Add filter: All / Categorised / Uncategorised / Low confidence
   - Quick action: "Show only uncategorised"

6. Summary Stats
   - "87 categorised, 13 need review"
   - Progress bar showing categorisation coverage
   
Props additions to PreviewStep:
- enableCategorisation: boolean (default true)
- onCategorisationComplete: (results: CategorisationResult[]) => void

## Component: CategoryCell.tsx

Interactive category cell for the preview table.

Props:
```typescript
{
  categoryId: string | null;
  categoryName: string | null;
  confidence: number;
  source: string;
  alternatives?: Alternative[];
  onChange: (categoryId: string) => void;
}
```

Features:

1. Display Mode
   - Category name or "Uncategorised"
   - Confidence dot indicator
   - Source badge (hover to see details)

2. Edit Mode (click to activate)
   - Dropdown with all categories
   - Search/filter categories
   - Recent categories at top
   - Alternative suggestions shown first
   - "Create new category" option at bottom

3. Quick Actions
   - If alternatives exist, show as quick-select chips
   - "Same as above" option if previous row has category

## Component: CategoryConfidence.tsx

Visual confidence indicator.

Props:
```typescript
{
  confidence: number;
  source: string;
  showLabel?: boolean;
}
```

Renders:
- Colored dot (green/yellow/red/gray)
- Optional percentage label
- Tooltip with source explanation:
  - "rule_exact": "Matched exact rule: 'TESCO' → Groceries"
  - "rule_pattern": "Matched pattern: contains 'AMAZON'"
  - "similar": "Similar to transaction from Jan 15"
  - "ai": "AI suggestion (85% confident)"

## Component: BulkCategorise.tsx

Toolbar for bulk categorisation actions.

Props:
```typescript
{
  selectedRows: number[];
  transactions: ParsedTransaction[];
  onBulkCategorise: (rows: number[], categoryId: string) => void;
  onSelectUncategorised: () => void;
  onSelectLowConfidence: () => void;
}
```

Features:

1. Selection Info
   - "X rows selected" or "No selection"

2. Bulk Category Assignment
   - Dropdown: "Set category to..."
   - Apply button
   - Only enabled when rows selected

3. Quick Selection
   - "Select all uncategorised" button
   - "Select low confidence" button
   - "Select all" / "Select none"

4. AI Assistance
   - "✨ Re-categorise selected with AI" button
   - Useful for batch of uncategorised items
   - Shows AI usage indicator

## State Management

Add to import wizard state:
```typescript
{
  categorisationResults: Map<number, CategorisationResult>,
  selectedRows: Set<number>,
  categoryOverrides: Map<number, string>,  // User changes
}
```

Category overrides take precedence over auto-categorisation.

## Learning Integration

When user changes a category:
1. Store the correction
2. Check if this creates a new rule opportunity:
   - If description exactly matches, suggest creating exact rule
   - If multiple similar transactions exist, suggest pattern rule
3. Show subtle prompt: "Create rule for future 'TESCO' transactions?"

Store learning data:
```typescript
interface CategoryCorrection {
  originalCategoryId: string | null;
  correctedCategoryId: string;
  description: string;
  source: string;  // What we used before
  timestamp: Date;
}
```

## API Updates

### POST /api/import/categorise

Trigger categorisation for import session.

Request:
```typescript
{
  sessionId: string,
  transactions: ParsedTransaction[]
}
```

Response:
```typescript
{
  results: CategorisationResult[],
  stats: {
    categorised: number,
    uncategorised: number,
    highConfidence: number,
    lowConfidence: number,
    aiUsed: number
  }
}
```

## Verification

1. Upload CSV and proceed to preview
2. See "Categorising..." progress
3. Categories appear in preview table
4. Confidence indicators match expectations
5. Can click to edit individual categories
6. Can select multiple and bulk assign
7. Low confidence items highlighted
8. Filter to show only uncategorised works

## Do NOT

- Force users to categorise everything before import
- Make categorisation blocking (can import without)
- Store corrections as permanent rules automatically (suggest only)
- Call AI for every category change
```

---

## Prompt 3b.4: Bulk Edit Mode

### Context

Add a powerful bulk editing interface for reviewing and modifying multiple transactions before import.

### File Structure

```
src/
├── components/
│   └── import/
│       ├── BulkEditMode.tsx      # Main bulk edit interface
│       ├── EditableCell.tsx      # Inline editable cell
│       ├── BulkEditToolbar.tsx   # Bulk action toolbar
│       └── TransactionSplitter.tsx  # Split transaction dialog
```

### Prompt

```
I need a bulk editing mode for the import preview that allows users to modify multiple transactions before committing the import.

## Component: BulkEditMode.tsx

Full-featured editing interface for import preview.

Props:
```typescript
{
  transactions: ParsedTransaction[];
  categorisations: Map<number, CategorisationResult>;
  onTransactionsChange: (transactions: ParsedTransaction[]) => void;
  onComplete: () => void;
}
```

Features:

1. Enhanced Table View
   - All columns editable (Date, Description, Amount, Category)
   - Row selection checkboxes
   - Row numbers for reference
   - Sortable columns
   - Virtual scrolling for large imports (react-virtual or tanstack-virtual)

2. Inline Editing
   - Click any cell to edit
   - Tab to move to next cell
   - Enter to confirm, Escape to cancel
   - Visual indicator for modified cells (yellow background)

3. Selection Model
   - Shift+click for range select
   - Ctrl/Cmd+click for multi-select
   - Checkbox column for selection
   - "Selected: X rows" indicator

4. Keyboard Shortcuts
   - Ctrl+A: Select all
   - Delete: Mark selected for skip
   - Ctrl+Z: Undo last change
   - Ctrl+D: Duplicate selected row
   - Ctrl+E: Edit selected cell

5. Modified Tracking
   - Track which rows/cells are modified
   - "X rows modified" indicator
   - "Reset all changes" button
   - Undo/redo stack (last 20 actions)

6. Row Actions
   - Skip row (won't be imported)
   - Duplicate row (for splitting)
   - Delete row from import
   - Reset row to original

## Component: EditableCell.tsx

Inline editable cell component.

Props:
```typescript
{
  value: string | number | Date;
  type: 'text' | 'number' | 'date' | 'category';
  isEditing: boolean;
  isModified: boolean;
  onChange: (value: any) => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
}
```

Cell types:
- **text**: Simple text input
- **number**: Number input with formatting
- **date**: Date picker
- **category**: Category dropdown (reuse CategoryCell)

Visual states:
- Normal: Default styling
- Editing: Input field, focused
- Modified: Yellow/amber background
- Error: Red border, error tooltip
- Skipped: Strikethrough, grayed out

## Component: BulkEditToolbar.tsx

Toolbar with bulk actions.

Props:
```typescript
{
  selectedCount: number;
  totalCount: number;
  modifiedCount: number;
  onBulkEdit: (field: string, value: any) => void;
  onBulkDelete: () => void;
  onBulkSkip: () => void;
  onResetAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
```

Layout:
```
[Select All] [X selected of Y] | [Set Date ▼] [Set Category ▼] [Set Amount ▼] | [Skip] [Delete] | [Undo] [Redo] [Reset]
```

Bulk edit dropdowns:
- **Set Date**: Date picker, applies to all selected
- **Set Category**: Category dropdown
- **Set Amount**: Number input (useful for corrections)
- **Adjust Amount**: Add/subtract from current (e.g., +10%, -£5)

## Component: TransactionSplitter.tsx

Dialog for splitting one transaction into multiple.

Props:
```typescript
{
  transaction: ParsedTransaction;
  onSplit: (transactions: ParsedTransaction[]) => void;
  onCancel: () => void;
}
```

Use case: Tesco shop where you got cashback, split into:
- Groceries: -£45.00
- Cashback: +£20.00
- Net: -£25.00 (original amount)

Features:
1. Original transaction shown at top
2. "Add split" button to add rows
3. Each split row has: Description, Amount, Category
4. Running total shown: "Original: -£25.00, Splits total: -£25.00 ✓"
5. Validation: splits must equal original amount
6. "Split" button to confirm

## Integration with Preview

Add "Edit Mode" toggle to PreviewStep:
- Toggle button: "📝 Edit Mode"
- When enabled, renders BulkEditMode instead of read-only table
- Warning: "You're in edit mode. Changes will be imported."

State management:
```typescript
{
  isEditMode: boolean;
  editedTransactions: ParsedTransaction[];  // Working copy
  modifications: Map<number, Modification>;  // Track changes
  undoStack: Action[];
  redoStack: Action[];
}
```

## Virtual Scrolling

For large imports (>500 rows), implement virtual scrolling:

```bash
npm install @tanstack/react-virtual
```

Only render visible rows plus buffer. This is critical for performance.

## Verification

1. Toggle edit mode in preview
2. Click cell to edit inline
3. Tab through cells
4. Select multiple rows with shift+click
5. Bulk set category on selection
6. Split a transaction into two
7. Undo/redo works
8. Large import (1000+ rows) scrolls smoothly
9. Modified cells visually indicated
10. Can reset changes

## Do NOT

- Save changes to database until final import
- Lose original data (always keep reference)
- Make editing mandatory (can skip edit mode)
- Block UI during edits (all client-side)
```

---

## Prompt 3b.5: Import Templates

### Context

Allow users to save and reuse custom column mappings as templates, especially useful for bank formats that change or aren't pre-configured.

### File Structure

```
src/
├── components/
│   └── import/
│       ├── TemplateManager.tsx    # Template list/management
│       ├── SaveTemplateDialog.tsx # Save current mapping as template
│       └── TemplateSelector.tsx   # Quick template selection
├── app/
│   └── api/
│       └── import/
│           └── templates/
│               ├── route.ts       # List/create templates
│               └── [id]/route.ts  # Get/update/delete template
```

### Prompt

```
I need a template system for saving and reusing column mappings in the CSV import.

## Database Update

The import_formats table (from 3a.1) already supports user-created formats with is_system=false. We'll use this for templates.

Add a few more fields if not present:
```sql
ALTER TABLE import_formats
ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
ADD COLUMN IF NOT EXISTS use_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS sample_headers jsonb;  -- Store headers this template works with
```

## Component: SaveTemplateDialog.tsx

Dialog to save current mapping as a reusable template.

Props:
```typescript
{
  isOpen: boolean;
  currentMapping: ColumnMapping;
  headers: string[];
  dateFormat: string;
  onSave: (template: ImportFormat) => void;
  onClose: () => void;
}
```

Features:

1. Form Fields
   - Name*: "My Bank Export" (required)
   - Provider: "Bank Name" (optional, for grouping)
   - Notes: "Downloaded from online banking, includes..." (optional)

2. Mapping Preview
   - Show current mapping in read-only view
   - "Date column: Transaction Date"
   - "Amount column: Debit/Credit (separate)"
   - "Description column: Narrative"

3. Validation
   - Name is required
   - Name must be unique (warn if exists, offer to update)

4. Actions
   - "Save Template" button
   - "Cancel" button

On save:
- POST to /api/import/templates
- Set is_system=false
- Store sample_headers for future matching

## Component: TemplateSelector.tsx

Dropdown/combobox for selecting a template.

Props:
```typescript
{
  templates: ImportFormat[];
  selectedId: string | null;
  headers: string[];  // Current file headers for matching
  onChange: (template: ImportFormat | null) => void;
}
```

Features:

1. Smart Sorting
   - Templates matching current headers at top
   - Recently used templates next
   - Then alphabetically by name

2. Match Indicator
   - "✓ Headers match" badge for compatible templates
   - "⚠ Partial match" if some headers different
   - "✗ Different format" if headers don't match

3. Groups
   - "Matching templates" section
   - "Recent templates" section
   - "All templates" section

4. Quick Actions
   - Search/filter by name
   - "Create new" option at bottom

## Component: TemplateManager.tsx

Full template management interface.

Props: none (fetches own data)

Features:

1. Template List
   - Name, provider, last used, use count
   - System templates vs user templates
   - Sort by name, last used, use count

2. Actions per Template
   - Edit (user templates only)
   - Duplicate
   - Delete (user templates only)
   - View details

3. Create New
   - "Create Template" button
   - Opens dialog (without current file context)

4. Import/Export
   - "Export templates" - download as JSON
   - "Import templates" - upload JSON file
   - Useful for backup or sharing

This could be a separate page (/import/templates) or a modal accessible from the mapping step.

## API Routes

### GET /api/import/templates

List all templates.

Query params:
- provider?: string
- includeSystem?: boolean (default true)

Response:
```typescript
{
  templates: ImportFormat[],
  userCount: number,
  systemCount: number
}
```

### POST /api/import/templates

Create new template.

Request:
```typescript
{
  name: string;
  provider?: string;
  columnMapping: ColumnMapping;
  dateFormat: string;
  hasHeader: boolean;
  skipRows?: number;
  notes?: string;
  sampleHeaders?: string[];
}
```

### GET /api/import/templates/[id]

Get single template.

### PATCH /api/import/templates/[id]

Update template (user templates only).

### DELETE /api/import/templates/[id]

Delete template (user templates only).

### POST /api/import/templates/[id]/use

Record template usage (updates last_used_at, increments use_count).

## Integration with MappingStep

Update MappingStep.tsx:

1. Template Selection at Top
   - Show TemplateSelector above manual mapping
   - When template selected, populate all mapping fields
   - "Using template: HSBC Personal"

2. Save Template Option
   - After successful manual mapping
   - "Save as template for next time" checkbox
   - If checked, show SaveTemplateDialog before continuing

3. Modify Detection Logic
   - Check user templates before system formats
   - User templates take priority for matching

## Verification

1. Complete manual mapping for a CSV
2. Check "Save as template"
3. Enter template name and save
4. Upload same CSV format again
5. Template appears in selector
6. Selecting template fills mapping
7. Template manager shows all templates
8. Can edit/delete user templates
9. Cannot modify system templates

## Do NOT

- Allow deletion of system templates
- Store actual transaction data in templates
- Make templates user-specific (single-user app)
- Require templates (manual mapping always available)
```

---

## Prompt 3b.6: Category Learning System

### Context

Build a learning system that improves categorisation accuracy over time based on user corrections.

### File Structure

```
src/
├── lib/
│   └── categorisation/
│       ├── learning.ts         # Learning and rule suggestion
│       └── rules-manager.ts    # Category rules CRUD
├── components/
│   └── import/
│       └── RuleSuggestion.tsx  # UI for rule creation prompts
├── app/
│   └── api/
│       └── categories/
│           └── rules/
│               └── route.ts    # Rules management API
```

### Prompt

```
I need a learning system that captures user corrections during import and suggests new categorisation rules.

## Database Table

Create a table to track corrections:

```sql
CREATE TABLE category_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,          -- Transaction description
  original_category_id uuid REFERENCES categories(id),
  corrected_category_id uuid NOT NULL REFERENCES categories(id),
  original_source text,               -- How we categorised it
  import_session_id uuid REFERENCES import_sessions(id),
  created_rule_id uuid REFERENCES category_mappings(id),
  created_at timestamptz DEFAULT now()
);

-- Index for finding patterns
CREATE INDEX idx_corrections_description ON category_corrections(description);
CREATE INDEX idx_corrections_corrected ON category_corrections(corrected_category_id);
```

## File: src/lib/categorisation/learning.ts

### recordCorrection(correction: CategoryCorrection): Promise<void>

Record when user changes a category:
1. Insert into category_corrections table
2. Check if rule creation is warranted

### analyseCorrections(description: string): Promise<RuleSuggestion | null>

Check if we should suggest a rule:

1. Look for existing corrections with similar descriptions
2. If 3+ corrections to same category for similar descriptions:
   - Suggest pattern rule
3. If exact description corrected:
   - Suggest exact match rule

```typescript
interface RuleSuggestion {
  type: 'exact' | 'pattern';
  pattern: string;
  categoryId: string;
  categoryName: string;
  confidence: number;
  basedOn: {
    correctionCount: number;
    similarDescriptions: string[];
  };
}
```

### findPatterns(): Promise<RuleSuggestion[]>

Batch analysis to find rule opportunities:
1. Group corrections by category
2. Within each category, find common tokens
3. Suggest patterns that would catch multiple corrections

Run periodically or on-demand.

## File: src/lib/categorisation/rules-manager.ts

### createRule(rule: NewRule): Promise<CategoryMapping>

Create a new category mapping rule:
```typescript
interface NewRule {
  pattern: string;
  categoryId: string;
  matchType: 'exact' | 'contains' | 'regex';
  confidence?: number;
}
```

Validation:
- Pattern not empty
- Category exists
- No duplicate exact match rules
- Regex is valid (if regex type)

### updateRule(id: string, updates: Partial<NewRule>): Promise<CategoryMapping>

### deleteRule(id: string): Promise<void>

### testRule(pattern: string, matchType: string): Promise<TestResult>

Test a rule against existing transactions:
```typescript
interface TestResult {
  matchCount: number;
  sampleMatches: {
    description: string;
    currentCategory: string | null;
    date: Date;
  }[];
  wouldRecategorise: number;  // Already has different category
}
```

## Component: RuleSuggestion.tsx

Toast/notification for suggesting rule creation.

Props:
```typescript
{
  suggestion: RuleSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  onNeverAsk: () => void;
}
```

Display:
```
┌─────────────────────────────────────────────────────┐
│ 💡 Create a rule?                                    │
│                                                      │
│ You've categorised "TESCO" transactions as          │
│ Groceries 3 times. Create a rule to do this         │
│ automatically?                                       │
│                                                      │
│ [Create Rule]  [Not Now]  [Don't Ask Again]         │
└─────────────────────────────────────────────────────┘
```

Trigger conditions:
- User manually changes category
- Similar corrections have been made before
- Or: specific correction count threshold reached

## Integration Points

### During Import Preview

When user changes category in CategorisedPreview:

1. Record correction via API
2. Check for rule suggestion
3. If suggestion returned, show RuleSuggestion toast
4. User can accept (creates rule) or dismiss

### Rules Management Page

Add /settings/rules page:

1. List all category_mappings rules
2. Filter: System / User-created / All
3. For each rule show:
   - Pattern
   - Category
   - Match type
   - Created date
   - Match count (how many transactions matched)
4. Actions: Edit, Delete, Test
5. "Add Rule" button

### Re-categorisation Tool

Option to apply new rules to existing transactions:

1. Select rule or category
2. "Find uncategorised matches" button
3. Show matching transactions
4. "Apply to all" or select specific ones
5. Bulk update

## API Routes

### GET /api/categories/rules

List all rules (category_mappings).

### POST /api/categories/rules

Create new rule.

### PATCH /api/categories/rules/[id]

Update rule.

### DELETE /api/categories/rules/[id]

Delete rule.

### POST /api/categories/rules/test

Test a rule pattern:
```typescript
Request: { pattern: string, matchType: string }
Response: TestResult
```

### POST /api/categories/corrections

Record a correction:
```typescript
Request: CategoryCorrection
Response: { recorded: true, suggestion?: RuleSuggestion }
```

## Verification

1. Import transactions with auto-categorisation
2. Manually change a category
3. Change same description again
4. After 3rd change, see rule suggestion
5. Accept suggestion
6. New rule appears in rules list
7. Next import auto-categorises correctly
8. Can manually create/edit/delete rules

## Do NOT

- Auto-create rules without user consent
- Create rules that would conflict with existing rules
- Suggest rules for one-off corrections
- Store personal data in rule patterns
```

---

## Summary

Phase 3b delivers AI-powered import enhancements:

| Prompt | Focus | Key Deliverables |
|--------|-------|------------------|
| 3b.1 | AI Column Mapping | Claude-powered format detection for unknown CSVs |
| 3b.2 | Categorisation Engine | Multi-strategy categorisation (rules, similar, AI) |
| 3b.3 | Categorisation UI | Auto-categorise preview, confidence indicators, editing |
| 3b.4 | Bulk Edit Mode | Inline editing, bulk actions, transaction splitting |
| 3b.5 | Import Templates | Save/reuse custom mappings, template management |
| 3b.6 | Category Learning | Correction tracking, rule suggestions, rules management |

### After Phase 3b

The complete import system will:
- Auto-detect any CSV format (known or AI-analysed)
- Auto-categorise transactions with confidence scoring
- Allow powerful bulk editing before commit
- Save templates for repeated imports
- Learn from corrections to improve accuracy

### Dependencies

```bash
# Phase 3b additional dependencies
npm install @tanstack/react-virtual  # Virtual scrolling for bulk edit
```

### AI Cost Management

- AI column mapping: ~$0.01 per analysis (10/day limit)
- AI categorisation: ~$0.02-0.05 per batch of 10 transactions
- Consider caching aggressively to minimize API calls
- Rules and similar matching should handle 80%+ of categorisation without AI
