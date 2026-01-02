/**
 * Import Types
 *
 * TypeScript types for CSV import functionality including sessions,
 * formats, column mapping, parsing, and validation.
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type DuplicateStrategy = 'strict' | 'fuzzy' | 'dateRange';

export type DuplicateMatchType = 'exact' | 'likely' | 'possible';

export const IMPORT_STATUS = {
  PENDING: 'pending' as const,
  PROCESSING: 'processing' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
};

// =============================================================================
// DATABASE TYPES (match schema)
// =============================================================================

/**
 * Import session record - tracks each import attempt
 */
export interface ImportSession {
  id: string;
  filename: string;
  format_id: string | null;
  account_id: string | null;
  status: ImportStatus;
  total_rows: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  error_details: ImportErrorDetails | null;
  raw_data: RawImportData | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * Import format configuration - predefined or custom
 */
export interface ImportFormat {
  id: string;
  name: string;
  provider: string;
  is_system: boolean;
  column_mapping: ColumnMapping;
  date_format: string;
  decimal_separator: '.' | ',';
  has_header: boolean;
  skip_rows: number;
  amount_in_single_column: boolean;
  amount_column: string | null;
  debit_column: string | null;
  credit_column: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hash record for duplicate detection
 */
export interface ImportedTransactionHash {
  id: string;
  transaction_id: string;
  import_session_id: string;
  hash: string;
  raw_data: Record<string, string>;
  created_at: string;
}

// =============================================================================
// COLUMN MAPPING
// =============================================================================

/**
 * Column mapping configuration
 * Maps our standard field names to CSV column names/indices
 */
export interface ColumnMapping {
  /** Date column name or index */
  date: string;
  /** Description column name or index */
  description: string;
  /** Amount configuration - either single column or separate debit/credit */
  amount?: string;
  /** Debit column (used with credit when amount is not set) */
  debit?: string;
  /** Credit column (used with debit when amount is not set) */
  credit?: string;
  /** Optional reference/transaction ID column */
  reference?: string;
  /** Optional balance column */
  balance?: string;
  /** Optional category column (for formats that include it) */
  category?: string;
}

/**
 * Validated column mapping with amount resolution
 */
export interface ResolvedColumnMapping extends Omit<ColumnMapping, 'amount' | 'debit' | 'credit'> {
  /** Either single amount column or separate columns */
  amountConfig:
    | { type: 'single'; column: string }
    | { type: 'separate'; debitColumn: string; creditColumn: string };
}

// =============================================================================
// PARSING TYPES
// =============================================================================

/**
 * Options for CSV parsing
 */
export interface ParseOptions {
  encoding?: string;
  delimiter?: string;
  hasHeader?: boolean;
  skipRows?: number;
}

/**
 * Result of CSV parsing
 */
export interface ParseResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
  encoding: string;
  delimiter: string;
}

/**
 * Raw import data stored in session
 */
export interface RawImportData {
  headers: string[];
  rows: string[][];
  parsedAt: string;
}

/**
 * A single row after parsing but before validation
 */
export interface ParsedRow {
  rowNumber: number;
  rawValues: Record<string, string>;
  date: string | null;
  amount: number | null;
  description: string | null;
  reference?: string | null;
  balance?: number | null;
}

/**
 * A validated transaction ready for import
 */
export interface ParsedTransaction {
  rowNumber: number;
  date: string;  // ISO format YYYY-MM-DD
  amount: number;
  description: string;
  reference?: string;
  balance?: number;
  rawData: Record<string, string>;
}

// =============================================================================
// FORMAT DETECTION
// =============================================================================

/**
 * Result of format detection
 */
export interface FormatDetectionResult {
  format: ImportFormat | null;
  confidence: number;
  matchedColumns: string[];
  unmatchedRequired: string[];
  allFormats: FormatMatch[];
}

/**
 * Individual format match result
 */
export interface FormatMatch {
  format: ImportFormat;
  score: number;
  confidence: number;
  matchedColumns: string[];
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Validation error for a specific row
 */
export interface ValidationError {
  rowNumber: number;
  field: string;
  value: string | null;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Warning during validation (non-blocking)
 */
export interface ValidationWarning {
  rowNumber?: number;
  type: 'future_date' | 'old_date' | 'large_amount' | 'same_sign' | 'zero_amount' | 'other';
  message: string;
}

/**
 * Result of validating a single row
 */
export interface RowValidationResult {
  isValid: boolean;
  transaction: ParsedTransaction | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Aggregate validation for entire import
 */
export interface ImportValidation {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  dateRange: {
    min: string;
    max: string;
  } | null;
  totalCredits: number;
  totalDebits: number;
  totalAmount: number;
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

/**
 * Found duplicate match
 */
export interface DuplicateMatch {
  importRowNumber: number;
  importTransaction: ParsedTransaction;
  existingTransaction: {
    id: string;
    date: string;
    amount: number;
    description: string;
    account_id: string;
  };
  matchType: DuplicateMatchType;
  similarity: number;
}

/**
 * Result of duplicate check
 */
export interface DuplicateCheckResult {
  duplicates: DuplicateMatch[];
  uniqueCount: number;
  duplicateCount: number;
}

// =============================================================================
// IMPORT RESULTS
// =============================================================================

/**
 * Error details stored in import session
 */
export interface ImportErrorDetails {
  errors: Array<{
    rowNumber: number;
    error: string;
    rawData?: Record<string, string>;
  }>;
  summary?: string;
}

/**
 * Final import execution result
 */
export interface ImportResult {
  success: boolean;
  sessionId: string;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
  dateRange?: {
    min: string;
    max: string;
  };
  totalAmount?: number;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Upload endpoint response
 */
export interface UploadResponse {
  sessionId: string;
  filename: string;
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  detectedFormat: {
    id: string;
    name: string;
    confidence: number;
  } | null;
  suggestedMapping: ColumnMapping | null;
}

/**
 * Preview endpoint request
 */
export interface PreviewRequest {
  sessionId: string;
  formatId?: string;
  customMapping?: ColumnMapping;
}

/**
 * Preview endpoint response
 */
export interface PreviewResponse {
  transactions: ParsedTransaction[];
  validation: ImportValidation;
}

/**
 * Duplicate check request
 */
export interface DuplicateCheckRequest {
  sessionId: string;
  transactions?: ParsedTransaction[];
  strategy: DuplicateStrategy;
}

/**
 * Execute import request
 */
export interface ExecuteImportRequest {
  sessionId: string;
  transactions: ParsedTransaction[];
  accountId: string;
  skipDuplicates: boolean;
  duplicateRowsToSkip?: number[];
}

/**
 * Create custom format request
 */
export interface CreateFormatRequest {
  name: string;
  provider: string;
  columnMapping: ColumnMapping;
  dateFormat: string;
  hasHeader: boolean;
  skipRows?: number;
  amountInSingleColumn: boolean;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

/**
 * Wizard step
 */
export type ImportWizardStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

/**
 * Wizard state
 */
export interface ImportWizardState {
  currentStep: ImportWizardStep;
  sessionId: string | null;
  uploadResult: UploadResponse | null;
  selectedFormat: ImportFormat | null;
  customMapping: ColumnMapping | null;
  previewData: PreviewResponse | null;
  duplicateCheckResult: DuplicateCheckResult | null;
  selectedAccountId: string | null;
  skipRowNumbers: number[];
  importResult: ImportResult | null;
}
