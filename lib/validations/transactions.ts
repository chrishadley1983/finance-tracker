import { z } from 'zod';

export const categorisationSourceSchema = z.enum(['manual', 'rule', 'ai', 'import']);

export const transactionSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number(),
  description: z.string().min(1),
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  categorisation_source: categorisationSourceSchema,
  hsbc_transaction_id: z.string().nullable(),
  created_at: z.string().datetime(),
});

export const createTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  amount: z.number(),
  description: z.string().min(1),
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  categorisation_source: categorisationSourceSchema.optional().default('manual'),
  hsbc_transaction_id: z.string().nullable().optional(),
});

export const updateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().optional(),
  description: z.string().min(1).optional(),
  account_id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  categorisation_source: categorisationSourceSchema.optional(),
});

/**
 * Status filter for the transactions list:
 * - uncategorised: category_id is null
 * - needs_review: needs_review is true
 * - validated / unvalidated: is_validated true / false
 */
export const transactionStatusSchema = z.enum(['uncategorised', 'needs_review', 'validated', 'unvalidated']);

// Query params for filtering transactions
export const transactionQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sort_column: z.enum(['date', 'description', 'account', 'category', 'amount']).optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
  status: transactionStatusSchema.optional(),
  /** Legacy validation filter (?validated=validated|unvalidated). */
  validated: z.enum(['all', 'validated', 'unvalidated']).optional(),
  /** Pass totals=0 to skip computing the {out, in} totals. */
  totals: z.enum(['0', '1']).optional(),
});

// Bulk operation schemas
/** Most ids a single bulk request (and "select all matching") may carry. */
export const BULK_MAX_IDS = 2000;

export const bulkUpdateTransactionsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one transaction ID required').max(BULK_MAX_IDS),
  update: z.object({
    category_id: z.string().uuid().nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    categorisation_source: categorisationSourceSchema.optional(),
    is_validated: z.boolean().optional(),
    needs_review: z.boolean().optional(),
    account_id: z.string().uuid().optional(),
  }).refine(
    (data) => Object.values(data).some(v => v !== undefined),
    { message: 'At least one field to update is required' }
  ),
});

export const bulkDeleteTransactionsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one transaction ID required').max(BULK_MAX_IDS),
});

export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type CategorisationSource = z.infer<typeof categorisationSourceSchema>;
export type BulkUpdateTransactions = z.infer<typeof bulkUpdateTransactionsSchema>;
export type BulkDeleteTransactions = z.infer<typeof bulkDeleteTransactionsSchema>;
