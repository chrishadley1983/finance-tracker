import { z } from 'zod';

export const budgetSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().min(0),
  created_at: z.string().datetime(),
});

export const createBudgetSchema = z.object({
  category_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().min(0),
});

export const updateBudgetSchema = z.object({
  category_id: z.string().uuid().optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  amount: z.number().min(0).optional(),
});

// Query params for filtering budgets
export const budgetQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  category_id: z.string().uuid().optional(),
});

export type Budget = z.infer<typeof budgetSchema>;
export type CreateBudget = z.infer<typeof createBudgetSchema>;
export type UpdateBudget = z.infer<typeof updateBudgetSchema>;
export type BudgetQuery = z.infer<typeof budgetQuerySchema>;
