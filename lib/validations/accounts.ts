import { z } from 'zod';

export const accountTypeSchema = z.enum([
  'current',
  'savings',
  'credit',
  'pension',
  'isa',
  'investment',
  'property',
  'other',
]);

export const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: accountTypeSchema,
  provider: z.string().max(100),
  is_active: z.boolean(),
  is_archived: z.boolean(),
  include_in_net_worth: z.boolean(),
  exclude_from_snapshots: z.boolean(),
  hsbc_account_id: z.string().nullable(),
  investment_provider: z.string().nullable(),
  investment_type: z.string().nullable(),
  notes: z.string().max(500).nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  sort_order: z.number(),
  last_import_at: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  type: accountTypeSchema,
  provider: z.string().max(100).optional().default(''),
  is_active: z.boolean().optional().default(true),
  is_archived: z.boolean().optional().default(false),
  include_in_net_worth: z.boolean().optional().default(true),
  exclude_from_snapshots: z.boolean().optional().default(false),
  notes: z.string().max(500).optional(),
  hsbc_account_id: z.string().nullable().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  type: accountTypeSchema.optional(),
  provider: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  include_in_net_worth: z.boolean().optional(),
  exclude_from_snapshots: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sort_order: z.number().optional(),
  hsbc_account_id: z.string().nullable().optional(),
});

export const reorderAccountsSchema = z.object({
  accounts: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number(),
  })),
});

export const reallocateTransactionsSchema = z.object({
  targetAccountId: z.string().uuid('Target account ID must be a valid UUID'),
});

export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
export type AccountType = z.infer<typeof accountTypeSchema>;
