import { z } from 'zod';

export const accountTypeSchema = z.enum([
  'current',
  'savings',
  'pension',
  'isa',
  'investment',
  'property',
]);

export const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: accountTypeSchema,
  provider: z.string().min(1).max(255),
  is_active: z.boolean(),
  hsbc_account_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createAccountSchema = z.object({
  name: z.string().min(1).max(255),
  type: accountTypeSchema,
  provider: z.string().min(1).max(255),
  is_active: z.boolean().optional().default(true),
  hsbc_account_id: z.string().nullable().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: accountTypeSchema.optional(),
  provider: z.string().min(1).max(255).optional(),
  is_active: z.boolean().optional(),
  hsbc_account_id: z.string().nullable().optional(),
});

export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
export type AccountType = z.infer<typeof accountTypeSchema>;
