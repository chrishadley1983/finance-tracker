import { z } from 'zod';

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  group_name: z.string().min(1).max(255),
  is_income: z.boolean(),
  display_order: z.number().int().min(0),
  created_at: z.string().datetime(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  group_name: z.string().min(1).max(255),
  is_income: z.boolean().optional().default(false),
  display_order: z.number().int().min(0).optional().default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  group_name: z.string().min(1).max(255).optional(),
  is_income: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
});

export type Category = z.infer<typeof categorySchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
