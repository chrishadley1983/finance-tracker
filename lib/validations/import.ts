/**
 * Import Validation Schemas
 *
 * Zod schemas for CSV import functionality including formats,
 * column mapping, and API requests.
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const importStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type ImportStatus = z.infer<typeof importStatusSchema>;

export const duplicateStrategySchema = z.enum(['strict', 'fuzzy', 'dateRange']);
export type DuplicateStrategy = z.infer<typeof duplicateStrategySchema>;

export const duplicateMatchTypeSchema = z.enum(['exact', 'likely', 'possible']);
export type DuplicateMatchType = z.infer<typeof duplicateMatchTypeSchema>;

// =============================================================================
// COLUMN MAPPING
// =============================================================================

// Base column mapping schema (without refine for use in partial scenarios)
export const columnMappingBaseSchema = z.object({
  date: z.string().min(1, 'Date column is required'),
  description: z.string().min(1, 'Description column is required'),
  amount: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  reference: z.string().optional(),
  balance: z.string().optional(),
  category: z.string().optional(),
});

// Full column mapping with validation (for API requests that need complete mapping)
export const columnMappingSchema = columnMappingBaseSchema.refine(
  (data) => data.amount || (data.debit && data.credit),
  { message: 'Either amount column or both debit and credit columns are required' }
);

export type ColumnMapping = z.infer<typeof columnMappingBaseSchema>;

// =============================================================================
// IMPORT FORMAT
// =============================================================================

// Column mapping stored in database can be partial or a generic record
const storedColumnMappingSchema = columnMappingBaseSchema.partial().or(z.record(z.string(), z.string()));

export const importFormatSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  provider: z.string().min(1),
  is_system: z.boolean(),
  column_mapping: storedColumnMappingSchema,
  date_format: z.string().min(1),
  decimal_separator: z.enum(['.', ',']),
  has_header: z.boolean(),
  skip_rows: z.number().int().min(0),
  amount_in_single_column: z.boolean(),
  amount_column: z.string().nullable(),
  debit_column: z.string().nullable(),
  credit_column: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ImportFormat = z.infer<typeof importFormatSchema>;

export const createImportFormatSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.string().min(1, 'Provider is required'),
  columnMapping: columnMappingSchema,
  dateFormat: z.string().min(1).default('DD/MM/YYYY'),
  hasHeader: z.boolean().default(true),
  skipRows: z.number().int().min(0).default(0),
  amountInSingleColumn: z.boolean(),
  amountColumn: z.string().optional(),
  debitColumn: z.string().optional(),
  creditColumn: z.string().optional(),
});

export type CreateImportFormat = z.infer<typeof createImportFormatSchema>;

// =============================================================================
// IMPORT SESSION
// =============================================================================

export const importSessionSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1),
  format_id: z.string().uuid().nullable(),
  account_id: z.string().uuid().nullable(),
  status: importStatusSchema,
  total_rows: z.number().int().min(0),
  imported_count: z.number().int().min(0),
  duplicate_count: z.number().int().min(0),
  error_count: z.number().int().min(0),
  error_details: z.any().nullable(),
  raw_data: z.any().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
});

export type ImportSession = z.infer<typeof importSessionSchema>;

// =============================================================================
// PARSED TRANSACTION
// =============================================================================

export const parsedTransactionSchema = z.object({
  rowNumber: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  amount: z.number(),
  description: z.string().min(1),
  reference: z.string().optional(),
  balance: z.number().optional(),
  rawData: z.record(z.string(), z.string()),
});

export type ParsedTransaction = z.infer<typeof parsedTransactionSchema>;

// =============================================================================
// API REQUESTS
// =============================================================================

const previewRequestBaseSchema = z.object({
  sessionId: z.string().uuid(),
  formatId: z.string().uuid().optional(),
  customMapping: columnMappingBaseSchema.optional(),
});

export const previewRequestSchema = previewRequestBaseSchema.refine(
  (data) => data.formatId || data.customMapping,
  { message: 'Either formatId or customMapping is required' }
);

export type PreviewRequest = z.infer<typeof previewRequestSchema>;

export const duplicateCheckRequestSchema = z.object({
  sessionId: z.string().uuid(),
  transactions: z.array(parsedTransactionSchema).optional(),
  strategy: duplicateStrategySchema.default('fuzzy'),
});

export type DuplicateCheckRequest = z.infer<typeof duplicateCheckRequestSchema>;

export const executeImportRequestSchema = z.object({
  sessionId: z.string().uuid(),
  transactions: z.array(parsedTransactionSchema).min(1, 'At least one transaction is required'),
  accountId: z.string().uuid('Valid account ID is required'),
  skipDuplicates: z.boolean().default(true),
  duplicateRowsToSkip: z.array(z.number().int().positive()).optional(),
});

export type ExecuteImportRequest = z.infer<typeof executeImportRequestSchema>;

// =============================================================================
// VALIDATION ERROR
// =============================================================================

export const validationErrorSchema = z.object({
  rowNumber: z.number().int().positive(),
  field: z.string(),
  value: z.string().nullable(),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
});

export type ValidationError = z.infer<typeof validationErrorSchema>;

export const validationWarningSchema = z.object({
  rowNumber: z.number().int().positive().optional(),
  type: z.enum(['future_date', 'old_date', 'large_amount', 'same_sign', 'zero_amount', 'other']),
  message: z.string(),
});

export type ValidationWarning = z.infer<typeof validationWarningSchema>;

// =============================================================================
// QUERY PARAMS
// =============================================================================

export const importFormatsQuerySchema = z.object({
  provider: z.string().optional(),
  includeSystem: z.coerce.boolean().default(true),
});

export type ImportFormatsQuery = z.infer<typeof importFormatsQuerySchema>;

export const importSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  status: importStatusSchema.optional(),
});

export type ImportSessionsQuery = z.infer<typeof importSessionsQuerySchema>;
