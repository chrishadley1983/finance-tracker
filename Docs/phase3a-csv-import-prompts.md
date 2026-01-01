# Phase 3a: Core CSV Import

**Implementation Prompts for Claude Code**  
**Version:** 1.0  
**Date:** January 2026  
**Prerequisite:** Phases 0-2 complete (agent infrastructure, data layer, core UI)

---

## Overview

Phase 3a implements robust CSV import functionality for the personal finance application. This replaces the originally planned Enable Banking integration due to UK Open Banking restrictions for personal use.

### Goals

1. **Format Detection** - Automatically recognise HSBC, Monzo, Amex, and other common formats
2. **Flexible Parsing** - Handle various CSV structures, date formats, and encoding
3. **Preview & Validation** - Show parsed data before committing with clear error highlighting
4. **Duplicate Detection** - Multiple strategies to identify already-imported transactions
5. **Clean Import Flow** - Intuitive UI from upload through to confirmation

### User Flow

```
Upload CSV → Format Detection → Column Mapping → Preview → Duplicate Check → Import → Summary
```

---

## Prompt 3a.1: Database Schema & Types

### Context

We need database tables to track import sessions and store format templates for known bank exports. We also need comprehensive TypeScript types for the import pipeline.

### File Structure

```
src/
├── lib/
│   └── types/
│       └── import.ts           # Import-related types
├── supabase/
│   └── migrations/
│       └── 20260101_import_tables.sql
```

### Prompt

```
I need to add CSV import functionality to my personal finance app. Create the database schema and TypeScript types for tracking imports.

## Database Tables Required

### import_sessions
Track each import attempt for audit and debugging:
- id: uuid PK
- filename: text (original filename)
- format_id: uuid FK nullable (reference to detected/selected format)
- status: enum ('pending', 'processing', 'completed', 'failed')
- total_rows: int (rows in CSV)
- imported_count: int (successfully imported)
- duplicate_count: int (skipped as duplicates)
- error_count: int (rows with errors)
- error_details: jsonb nullable (structured error information)
- started_at: timestamptz
- completed_at: timestamptz nullable
- created_at: timestamptz

### import_formats
Store known CSV format configurations:
- id: uuid PK
- name: text (e.g., "HSBC Current Account", "Monzo")
- provider: text (bank/institution name)
- is_system: boolean (true for built-in, false for user-created)
- column_mapping: jsonb (maps CSV columns to our fields)
- date_format: text (e.g., "DD/MM/YYYY", "YYYY-MM-DD")
- decimal_separator: text default '.'
- has_header: boolean default true
- skip_rows: int default 0 (rows to skip before header)
- amount_in_single_column: boolean default true
- amount_column: text nullable (if single column)
- debit_column: text nullable (if separate columns)
- credit_column: text nullable (if separate columns)
- notes: text nullable
- created_at: timestamptz
- updated_at: timestamptz

### imported_transaction_hashes
Track imported transaction hashes to prevent duplicates across sessions:
- id: uuid PK
- transaction_id: uuid FK (reference to transactions table)
- import_session_id: uuid FK
- hash: text (computed hash for deduplication)
- raw_data: jsonb (original CSV row data)
- created_at: timestamptz

Add unique index on hash column.

## TypeScript Types (src/lib/types/import.ts)

Create comprehensive types including:

1. ImportSession - matches DB table
2. ImportFormat - matches DB table with typed column_mapping
3. ColumnMapping - structure for mapping config:
   - date: string (column name/index)
   - amount: string | { debit: string, credit: string }
   - description: string
   - reference?: string
   - balance?: string
4. ParsedRow - single parsed CSV row before import
5. ParsedTransaction - validated transaction ready for import
6. ImportPreview - preview data structure with rows and validation
7. ImportResult - final result with counts and errors
8. DuplicateMatch - found duplicate with similarity score
9. ImportError - structured error with row number and details

Also create Zod schemas for validation where appropriate.

## Seed Data

Add seed data for these known formats:

### HSBC Current Account
- Columns: Date, Type, Description, Paid Out, Paid In, Balance
- Date format: DD/MM/YYYY
- Separate debit (Paid Out) and credit (Paid In) columns

### HSBC Credit Card  
- Columns: Date, Description, Amount
- Date format: DD/MM/YYYY
- Single amount column (positive = charge, negative = payment)

### Monzo
- Columns: Transaction ID, Date, Time, Type, Name, Emoji, Category, Amount, Currency, Local amount, Local currency, Notes and #tags, Address, Receipt, Description, Category split, Money Out, Money In
- Date format: DD/MM/YYYY
- Amount column is primary, but Money Out/Money In available

### Amex UK
- Columns: Date, Description, Amount
- Date format: DD/MM/YYYY
- Single amount column

### Generic CSV
- Auto-detect columns
- Fallback format with flexible mapping

## Verification

After implementation:
1. Run migration: `supabase db push`
2. Verify tables exist with correct columns
3. Verify seed data inserted for known formats
4. Verify TypeScript types compile without errors
5. Export types from index file

## Do NOT

- Add any UI components in this prompt
- Create API routes yet
- Modify existing transactions table (we'll use the existing structure)
```

---

## Prompt 3a.2: CSV Parsing Service

### Context

Build a robust CSV parsing service that handles various formats, encodings, and edge cases. This service sits between raw file upload and the preview/validation stage.

### File Structure

```
src/
├── lib/
│   └── import/
│       ├── parser.ts           # Core CSV parsing
│       ├── format-detector.ts  # Auto-detect format
│       ├── normalizers.ts      # Date, amount normalization
│       └── validators.ts       # Row validation
```

### Prompt

```
I need a robust CSV parsing service for importing bank transactions. The service should handle various bank export formats gracefully.

## File: src/lib/import/parser.ts

Core CSV parsing functionality:

### parseCSV(file: File, options?: ParseOptions): Promise<ParseResult>

Options:
- encoding?: string (default: 'utf-8', try 'windows-1252' on failure)
- delimiter?: string (auto-detect from ',', ';', '\t')
- hasHeader?: boolean (default: true)
- skipRows?: number (default: 0)

Result:
- headers: string[]
- rows: string[][]
- totalRows: number
- encoding: string (detected/used)
- delimiter: string (detected/used)

Implementation notes:
- Use PapaParse library for robust CSV parsing
- Handle BOM (byte order mark) at start of file
- Auto-detect delimiter by analysing first few lines
- Handle quoted fields with embedded commas/newlines
- Trim whitespace from all values
- Handle empty rows gracefully (skip them)

### detectEncoding(buffer: ArrayBuffer): string

Detect file encoding:
- Check for UTF-8 BOM
- Check for UTF-16 BOM
- Try UTF-8 first, fall back to windows-1252 (common for UK bank exports)

## File: src/lib/import/format-detector.ts

### detectFormat(headers: string[], sampleRows: string[][], formats: ImportFormat[]): DetectionResult

Result:
- format: ImportFormat | null
- confidence: number (0-1)
- matchedColumns: string[]
- unmatchedRequired: string[]

Detection logic:
1. Normalise headers (lowercase, trim, remove special chars)
2. For each known format, score based on:
   - Exact header matches (+3 per match)
   - Partial header matches (+1 per match)
   - Required columns present (+5 per required)
   - Missing required columns (-10 per missing)
3. Return format with highest score above threshold (0.6)
4. Return null if no confident match

### Known format signatures to detect:

HSBC Current Account:
- Required: date, description, (paid out OR paid in OR balance)
- Signature headers: "Paid Out", "Paid In", "Balance"

HSBC Credit Card:
- Required: date, description, amount
- Signature: single "Amount" column, no "Paid Out"/"Paid In"

Monzo:
- Required: date, name OR description, amount
- Signature headers: "Transaction ID", "Emoji", "Category"

Amex UK:
- Required: date, description, amount
- Signature: exactly 3 columns, simple format

## File: src/lib/import/normalizers.ts

### normalizeDate(value: string, format?: string): Date | null

Handle various date formats:
- DD/MM/YYYY (UK standard)
- DD-MM-YYYY
- YYYY-MM-DD (ISO)
- MM/DD/YYYY (US - detect and warn)
- DD MMM YYYY (e.g., "15 Jan 2025")
- Timestamp formats

Return null for unparseable dates (don't throw).

### normalizeAmount(value: string, options?: AmountOptions): number | null

Options:
- decimalSeparator?: '.' | ','
- isDebit?: boolean (should result be negative)

Handle:
- Currency symbols (£, $, €) - strip them
- Thousand separators (comma or space)
- Negative formats: -100, (100), 100-, 100 DR
- Positive formats: 100, +100, 100 CR
- Empty/null values (return null)

### normalizeDescription(value: string): string

Clean up description:
- Trim whitespace
- Collapse multiple spaces
- Remove excessive special characters
- Truncate to reasonable length (500 chars)
- Preserve meaningful content

## File: src/lib/import/validators.ts

### validateRow(row: Record<string, string>, mapping: ColumnMapping): ValidationResult

Result:
- isValid: boolean
- transaction: ParsedTransaction | null
- errors: ValidationError[]

Validation rules:
1. Date is required and must parse
2. Amount is required and must be numeric
3. Description is required and non-empty
4. If debit/credit columns, exactly one must have value
5. Amount cannot be zero (warn, don't fail)

### validateImport(rows: ParsedTransaction[]): ImportValidation

Aggregate validation:
- totalRows: number
- validRows: number
- invalidRows: number
- errors: ValidationError[] (with row numbers)
- warnings: ValidationWarning[]
- dateRange: { min: Date, max: Date }
- totalAmount: number

Warnings to generate:
- Future-dated transactions
- Very old transactions (>5 years)
- Unusually large amounts (>£10,000)
- All amounts same sign (no debits or no credits)

## Install Dependencies

```bash
npm install papaparse
npm install -D @types/papaparse
```

## Verification

Create a test file with sample data and verify:
1. HSBC format CSV parses correctly
2. Date normalization handles DD/MM/YYYY
3. Amount normalization handles "£1,234.56" and "(£50.00)"
4. Format detection identifies HSBC with high confidence
5. Validation catches missing dates and invalid amounts

## Do NOT

- Create any API routes (next prompt)
- Create any UI components
- Connect to database yet
- Import actual transactions
```

---

## Prompt 3a.3: Import API Routes

### Context

Create API routes for file upload, format detection, preview generation, and import execution.

### File Structure

```
src/
├── app/
│   └── api/
│       └── import/
│           ├── upload/route.ts      # File upload & initial parse
│           ├── formats/route.ts     # List/manage formats
│           ├── preview/route.ts     # Generate preview with mapping
│           ├── duplicates/route.ts  # Check for duplicates
│           └── execute/route.ts     # Perform import
```

### Prompt

```
I need API routes for the CSV import functionality. These routes handle the import workflow from upload to execution.

## Route: POST /api/import/upload

Handle file upload and initial parsing.

Request: FormData with 'file' field (CSV file)

Response:
```typescript
{
  sessionId: string,           // Created import session ID
  filename: string,
  headers: string[],
  sampleRows: string[][],      // First 5 rows for preview
  totalRows: number,
  detectedFormat: {
    id: string,
    name: string,
    confidence: number
  } | null,
  suggestedMapping: ColumnMapping | null
}
```

Implementation:
1. Parse uploaded file using parser service
2. Create import_session record with status='pending'
3. Run format detection
4. Store raw parsed data in session (temporary storage or cache)
5. Return detection results

Use server-side temp storage for the parsed data - we'll need it for preview and execute steps. Consider using a simple in-memory cache with session ID as key, or store in database as JSONB.

## Route: GET /api/import/formats

List available import formats.

Query params:
- provider?: string (filter by provider)
- includeSystem?: boolean (default true)

Response:
```typescript
{
  formats: ImportFormat[]
}
```

## Route: POST /api/import/formats

Create custom format.

Request:
```typescript
{
  name: string,
  provider: string,
  columnMapping: ColumnMapping,
  dateFormat: string,
  hasHeader: boolean,
  skipRows?: number
}
```

## Route: POST /api/import/preview

Generate preview with specific column mapping.

Request:
```typescript
{
  sessionId: string,
  formatId?: string,           // Use existing format
  customMapping?: ColumnMapping // Or provide custom mapping
}
```

Response:
```typescript
{
  transactions: ParsedTransaction[], // All parsed transactions
  validation: {
    totalRows: number,
    validRows: number,
    invalidRows: number,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    dateRange: { min: string, max: string },
    totalCredits: number,
    totalDebits: number
  }
}
```

Implementation:
1. Retrieve parsed CSV data from session storage
2. Apply column mapping to extract fields
3. Normalize dates and amounts
4. Validate each row
5. Return parsed transactions with validation summary

## Route: POST /api/import/duplicates

Check for potential duplicates against existing transactions.

Request:
```typescript
{
  sessionId: string,
  transactions: ParsedTransaction[], // Or use session data
  strategy: 'strict' | 'fuzzy' | 'dateRange'
}
```

Strategies:
- **strict**: Exact match on date + amount + description hash
- **fuzzy**: Same date, similar amount (±£0.01), similar description (Levenshtein)
- **dateRange**: Any transaction within ±1 day with same amount

Response:
```typescript
{
  duplicates: {
    importRow: number,
    importTransaction: ParsedTransaction,
    existingTransaction: Transaction,
    matchType: 'exact' | 'likely' | 'possible',
    similarity: number
  }[],
  uniqueCount: number,
  duplicateCount: number
}
```

Implementation:
1. For each transaction in import:
   - Generate hash (date + amount + normalised description)
   - Check imported_transaction_hashes table
   - If not found, query transactions table based on strategy
2. Return matched pairs with similarity scores

## Route: POST /api/import/execute

Execute the import after user confirmation.

Request:
```typescript
{
  sessionId: string,
  transactions: ParsedTransaction[], // Transactions to import
  accountId: string,                  // Target account
  skipDuplicates: boolean,           // Skip identified duplicates
  duplicateRowsToSkip?: number[]     // Specific rows to skip
}
```

Response:
```typescript
{
  success: boolean,
  imported: number,
  skipped: number,
  failed: number,
  errors: { row: number, error: string }[],
  importSessionId: string
}
```

Implementation:
1. Update session status to 'processing'
2. For each transaction:
   - Skip if in duplicateRowsToSkip
   - Generate hash
   - Check for duplicates one more time
   - Insert into transactions table
   - Insert hash into imported_transaction_hashes
3. Update session with final counts
4. Update session status to 'completed' or 'failed'
5. Return summary

Use database transaction for atomicity.

## Session Storage

For storing parsed CSV data between requests, create a simple in-memory store:

```typescript
// src/lib/import/session-store.ts
const sessionStore = new Map<string, {
  data: string[][],
  headers: string[],
  createdAt: Date
}>();

// Clean up sessions older than 1 hour periodically
```

Or store in database as JSONB in the import_sessions table.

## Verification

1. Upload a test CSV and verify session is created
2. Check format detection returns expected format
3. Generate preview with default mapping
4. Run duplicate check against existing data
5. Execute import and verify transactions created
6. Verify import_session is updated with counts

## Do NOT

- Create UI components
- Handle file storage beyond the import session
- Implement auto-categorisation (Phase 3b)
- Add scheduling or automation
```

---

## Prompt 3a.4: Import UI - Upload & Mapping

### Context

Build the first part of the import UI: file upload dropzone and column mapping interface.

### File Structure

```
src/
├── app/
│   └── import/
│       └── page.tsx            # Import page
├── components/
│   └── import/
│       ├── ImportWizard.tsx    # Main wizard container
│       ├── UploadStep.tsx      # File upload dropzone
│       ├── MappingStep.tsx     # Column mapping UI
│       └── ColumnMapper.tsx    # Individual column mapping
```

### Prompt

```
I need the first part of the CSV import UI: file upload and column mapping. This should be a wizard-style interface.

## Page: src/app/import/page.tsx

Simple page that renders the ImportWizard component.
- Title: "Import Transactions"
- Brief description of what user can do
- Render ImportWizard

## Component: ImportWizard.tsx

Multi-step wizard container managing import state.

Props: none (self-contained)

State:
- currentStep: 'upload' | 'mapping' | 'preview' | 'import' | 'complete'
- sessionId: string | null
- uploadResult: UploadResult | null
- selectedFormat: ImportFormat | null
- customMapping: ColumnMapping | null
- previewData: PreviewResult | null
- importResult: ImportResult | null

Steps indicator at top showing: Upload → Map Columns → Preview → Import → Done

Render appropriate step component based on currentStep.

## Component: UploadStep.tsx

File upload with drag-and-drop.

Props:
- onUploadComplete: (result: UploadResult) => void

Features:
1. Drag-and-drop zone with visual feedback
   - Dashed border, changes color on drag over
   - Icon and text: "Drop CSV file here or click to browse"
   - Accept only .csv files
   
2. File selection via click
   - Hidden file input triggered by zone click
   
3. Upload progress
   - Show spinner while uploading
   - Show filename and size
   
4. Upload result display
   - Success: "Parsed X rows from filename.csv"
   - Detected format badge if found
   - Show sample data (first 3 rows in a mini table)
   
5. Error handling
   - File type validation (must be .csv)
   - Size limit (10MB)
   - Parse errors displayed clearly

On successful upload:
- Call POST /api/import/upload
- Pass result to onUploadComplete
- Wizard advances to mapping step

Use react-dropzone for drag-and-drop handling:
```bash
npm install react-dropzone
```

## Component: MappingStep.tsx

Column mapping interface.

Props:
- sessionId: string
- headers: string[]
- sampleRows: string[][]
- detectedFormat: ImportFormat | null
- onMappingComplete: (mapping: ColumnMapping) => void
- onBack: () => void

Layout:
1. Format Selection (top)
   - If format detected: "Detected: HSBC Current Account" with checkmark
   - Dropdown to change format or select "Custom Mapping"
   - "Use detected format" button if confident match
   
2. Column Mapping Grid
   - Left side: Our required fields (Date, Amount, Description)
   - Right side: Dropdown to select CSV column
   - Show sample value from first row next to each mapping
   
3. Sample Preview Table
   - Show first 5 rows of CSV
   - Highlight columns that are mapped
   - Headers row highlighted differently
   
4. Amount Configuration
   - Radio: "Single amount column" vs "Separate debit/credit columns"
   - If separate: show two dropdowns for debit and credit columns
   
5. Date Format
   - Auto-detected format shown
   - Option to override if dates look wrong
   - Show parsed date preview: "15/01/2025 → January 15, 2025"

6. Navigation
   - "Back" button (secondary)
   - "Continue to Preview" button (primary, disabled until valid mapping)

Validation:
- Date column must be selected
- Amount column(s) must be selected
- Description column must be selected
- Show warning if mapping seems wrong (e.g., text in amount column)

## Component: ColumnMapper.tsx

Individual column mapping row.

Props:
- fieldName: string (e.g., "Date", "Amount")
- required: boolean
- availableColumns: string[]
- selectedColumn: string | null
- sampleValue: string | null
- onSelect: (column: string | null) => void
- validationError?: string

Render:
- Field label with required indicator (*)
- Dropdown with column options
- Sample value chip showing what data looks like
- Validation error below if present

## Styling Notes

Use existing shadcn/ui components:
- Card for wizard container
- Button for navigation
- Select for dropdowns
- Badge for format detection
- Alert for errors/warnings
- Table for sample data preview

Responsive:
- On mobile, mapping grid stacks vertically
- Sample table scrolls horizontally

## Verification

1. Navigate to /import
2. Drag a CSV file onto the dropzone
3. See file upload and parsing
4. See detected format (if applicable)
5. Column mapping UI shows with dropdowns
6. Select columns and see sample values
7. Continue button enables when mapping valid

## Do NOT

- Implement preview step (next prompt)
- Implement actual import execution
- Add auto-categorisation features
- Connect to category selection
```

---

## Prompt 3a.5: Import UI - Preview & Execute

### Context

Build the preview and execution steps of the import wizard: reviewing parsed data, handling duplicates, and executing the import.

### File Structure

```
src/
├── components/
│   └── import/
│       ├── PreviewStep.tsx      # Data preview with validation
│       ├── DuplicateReview.tsx  # Duplicate handling UI
│       ├── ImportProgress.tsx   # Import execution progress
│       └── ImportComplete.tsx   # Success/summary screen
```

### Prompt

```
I need the preview and import execution steps for the CSV import wizard.

## Component: PreviewStep.tsx

Preview parsed transactions before import.

Props:
- sessionId: string
- mapping: ColumnMapping
- onImportReady: (transactions: ParsedTransaction[], skipRows: number[]) => void
- onBack: () => void

Features:

1. Load Preview Data
   - Call POST /api/import/preview on mount
   - Show loading state while fetching
   
2. Validation Summary (top cards)
   - Total rows card with count
   - Valid rows card (green) with count
   - Invalid rows card (red) with count and "View errors" link
   - Date range: "Jan 1, 2025 - Jan 31, 2025"
   - Total: "£X,XXX in, £X,XXX out"

3. Warnings Alert
   - If any warnings (future dates, large amounts, etc.)
   - Expandable to show details
   - Checkbox: "I've reviewed the warnings"

4. Transaction Preview Table
   - Columns: Row #, Date, Description, Amount, Status
   - Status shows: ✓ Valid, ⚠ Warning, ✗ Error
   - Sortable by any column
   - Filterable: All / Valid only / Errors only / Warnings only
   - Pagination (50 per page)
   - Click row to see full details in modal

5. Error Details
   - For invalid rows, show error message inline
   - "15 rows have errors. Fix in source file and re-upload, or continue without them."

6. Account Selection
   - Dropdown: "Import to account:"
   - List all active accounts from database
   - Required before continuing

7. Duplicate Check Button
   - "Check for duplicates" button
   - Triggers duplicate detection
   - Shows count: "Found X potential duplicates"
   - Opens DuplicateReview modal

8. Navigation
   - "Back to Mapping" button
   - "Import X Transactions" button (shows count)
   - Import button disabled until account selected

## Component: DuplicateReview.tsx

Modal/dialog for reviewing potential duplicates.

Props:
- sessionId: string
- transactions: ParsedTransaction[]
- onConfirm: (skipRows: number[]) => void
- onCancel: () => void

Features:

1. Strategy Selection (tabs or radio)
   - Strict: Exact matches only
   - Fuzzy: Similar transactions (default)
   - Date Range: Same amount within ±1 day

2. Duplicate List
   - Grouped by import row
   - For each potential duplicate:
     - Import row data (from CSV)
     - → arrow
     - Existing transaction data (from database)
     - Match confidence: "Exact Match" / "95% Similar" / "Possible Match"
     - Checkbox to skip this row
   
3. Bulk Actions
   - "Skip all exact matches" button
   - "Skip all likely matches" button
   - "Import all anyway" button

4. Summary
   - "Skipping X duplicates, importing Y new transactions"

5. Actions
   - "Cancel" - close modal
   - "Confirm" - apply selections and close

## Component: ImportProgress.tsx

Import execution with progress indication.

Props:
- sessionId: string
- transactions: ParsedTransaction[]
- accountId: string
- skipRows: number[]
- onComplete: (result: ImportResult) => void

Features:

1. Progress Display
   - Circular or linear progress bar
   - "Importing... X of Y"
   - Estimated time remaining (for large imports)

2. Live Status
   - Show last imported transaction description
   - Running count: imported / skipped / errors

3. Cancel Option
   - "Cancel Import" button (only in first few seconds)
   - Confirms before canceling
   - Note: Already imported transactions remain

4. Error Handling
   - If errors occur, collect them
   - Don't stop on single row error (continue import)
   - Show error count accumulating

5. Completion
   - Auto-advance to ImportComplete when done

Implementation:
- Call POST /api/import/execute
- For large imports (>500 rows), consider streaming updates via polling
- Or simply wait for completion - most imports should be <30 seconds

## Component: ImportComplete.tsx

Success screen with summary.

Props:
- result: ImportResult
- onNewImport: () => void
- onViewTransactions: () => void

Features:

1. Success Animation
   - Checkmark icon or animation
   - "Import Complete!"

2. Summary Cards
   - Imported: X transactions (green)
   - Skipped duplicates: X (yellow)
   - Errors: X (red, if any)
   - Total amount: £X,XXX net

3. Date Range
   - "Transactions from Jan 1 to Jan 31, 2025"

4. Error Details (if any)
   - Expandable list of failed rows
   - Row number and error message
   - "Download error report" link (CSV of failed rows)

5. Actions
   - "View Imported Transactions" button (primary)
     - Navigate to /transactions with date filter for imported range
   - "Import Another File" button (secondary)
     - Reset wizard to upload step
   - "Go to Dashboard" link

6. Import Session Info
   - Small text: "Import session: abc-123"
   - Useful for debugging if needed

## Additional Updates

Update ImportWizard.tsx to handle new steps:
- 'preview' step renders PreviewStep
- 'importing' step renders ImportProgress  
- 'complete' step renders ImportComplete

Handle transitions:
- PreviewStep → onImportReady → set transactions and advance to 'importing'
- ImportProgress → onComplete → set result and advance to 'complete'
- ImportComplete → onNewImport → reset all state and go to 'upload'

## Verification

1. Complete upload and mapping steps
2. Preview shows parsed transactions correctly
3. Validation summary accurate
4. Can filter by valid/error status
5. Duplicate check works and shows matches
6. Can select account for import
7. Import executes with progress
8. Completion screen shows accurate summary
9. Can start new import or view transactions

## Do NOT

- Add auto-categorisation (Phase 3b)
- Add bulk editing features (Phase 3b)
- Implement import templates saving (Phase 3b)
- Add AI features
```

---

## Prompt 3a.6: Import Integration & Polish

### Context

Final integration work: add import to navigation, handle edge cases, and ensure robust error handling throughout the flow.

### Prompt

```
I need to integrate the CSV import feature into the main application and add polish for edge cases.

## Navigation Update

Add "Import" to the sidebar navigation:
- Icon: Upload or FileUp from lucide-react
- Label: "Import"
- Path: /import
- Position: After "Transactions" in the nav order

## Transaction List Integration

On the transactions list page, add an "Import" button:
- Position: Top right, next to any existing action buttons
- Style: Secondary button with upload icon
- Action: Navigate to /import

## Account Selector Enhancement

The account dropdown in PreviewStep needs to:
- Fetch accounts from GET /api/accounts
- Show account name and type
- Group by account type if many accounts
- Show current balance if available
- Default to most recently used import account (store in localStorage)

## Edge Cases to Handle

### Upload Step
1. Empty file: Show error "File is empty"
2. Too large (>10MB): Show error before upload
3. Wrong encoding: Auto-retry with windows-1252, show notice if detected
4. No data rows: "File contains headers but no data"
5. Network error: Retry button with "Upload failed, please try again"

### Mapping Step
1. No headers detected: Show "Treat first row as data" checkbox
2. Duplicate column names: Append numbers (Description, Description_2)
3. Very wide CSV (>20 columns): Collapse unmapped columns
4. Very long values: Truncate in preview with tooltip for full value

### Preview Step
1. All rows invalid: Block import, show clear guidance
2. All rows duplicates: Show message "All transactions appear to already exist"
3. Mix of valid/invalid: Allow partial import with confirmation
4. Very large import (>1000): Show warning about time, suggest breaking up

### Import Step
1. Session expired: Show message and restart button
2. Database error: Rollback transaction, show specific error
3. Account deleted: Re-fetch accounts, show selection
4. Duplicate detected during import: Skip and count (already handled)

### Complete Step
1. All rows failed: Show error state, not success
2. Partial success: Show yellow/warning state
3. Full success: Show green/success state

## Error Boundaries

Wrap ImportWizard in an error boundary:
- Catch any unhandled errors
- Show friendly error message
- "Something went wrong" with retry button
- Log error details for debugging

## Loading States

Ensure every async operation has loading state:
- Upload: "Uploading and parsing..."
- Format detection: "Detecting format..."
- Preview generation: "Preparing preview..."
- Duplicate check: "Checking for duplicates..."
- Import execution: Progress bar with count

## Empty States

If user navigates to /import with no previous imports:
- Show welcome message explaining the feature
- List supported formats (HSBC, Monzo, etc.)
- Drag-drop zone prominent

## Mobile Responsiveness

Ensure import works on tablet/mobile:
- Dropzone full width
- Mapping table scrolls horizontally
- Preview table has horizontal scroll
- Buttons stack on small screens
- Modal dialogs are full-screen on mobile

## Accessibility

- Dropzone accessible via keyboard (Enter/Space to trigger file picker)
- Progress announced to screen readers
- Error messages linked to inputs
- Skip links for long tables
- Sufficient color contrast for status indicators

## Import History (Optional but recommended)

Add a small section showing recent imports:
- Below the upload zone (collapsed by default)
- "Recent imports" with last 5 sessions
- Show: filename, date, row count, status
- Click to view session details

API route needed:
GET /api/import/sessions?limit=5

## Verification Checklist

1. [ ] Import in sidebar navigation
2. [ ] Import button on transactions page
3. [ ] Upload handles all error cases gracefully
4. [ ] Large file shows progress
5. [ ] Column mapping works with various CSV formats
6. [ ] Preview shows validation errors clearly
7. [ ] Duplicate detection finds existing transactions
8. [ ] Import executes reliably
9. [ ] Success screen is informative
10. [ ] Mobile layout works
11. [ ] Keyboard navigation works throughout

## Do NOT

- Add AI categorisation features
- Add bulk editing
- Implement template saving
- Add scheduling/automation
```

---

## Summary

Phase 3a delivers a complete, robust CSV import system:

| Prompt | Focus | Key Deliverables |
|--------|-------|------------------|
| 3a.1 | Database & Types | import_sessions, import_formats tables, TypeScript types |
| 3a.2 | Parsing Service | CSV parser, format detector, normalizers, validators |
| 3a.3 | API Routes | Upload, formats, preview, duplicates, execute endpoints |
| 3a.4 | UI: Upload & Mapping | Dropzone, format detection, column mapping interface |
| 3a.5 | UI: Preview & Execute | Transaction preview, duplicate review, import progress |
| 3a.6 | Integration & Polish | Navigation, error handling, edge cases, accessibility |

### After Phase 3a

You'll have a working import system that:
- Accepts CSV files via drag-and-drop
- Auto-detects HSBC, Monzo, Amex formats
- Allows custom column mapping
- Previews data with validation
- Detects duplicates before import
- Executes import with progress feedback
- Shows clear success/error summaries

Phase 3b will add AI-powered enhancements: smart column mapping for unknown formats, automatic categorisation, bulk editing, and saved templates.
