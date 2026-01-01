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

// Query params for filtering transactions
export const transactionQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type CategorisationSource = z.infer<typeof categorisationSourceSchema>;
