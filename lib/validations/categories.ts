import { z } from 'zod';

// Hex colour validation
const hexColourSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional();

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  group_name: z.string().min(1).max(255),
  group_id: z.string().uuid().nullable(),
  is_income: z.boolean(),
  display_order: z.number().int().min(0),
  exclude_from_totals: z.boolean(),
  colour: hexColourSchema,
  created_at: z.string().datetime(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  group_name: z.string().min(1).max(255).optional(),
  group_id: z.string().uuid().nullable().optional(),
  is_income: z.boolean().optional().default(false),
  display_order: z.number().int().min(0).optional().default(0),
  exclude_from_totals: z.boolean().optional().default(false),
  colour: hexColourSchema,
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  group_name: z.string().min(1).max(255).optional(),
  group_id: z.string().uuid().nullable().optional(),
  is_income: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  exclude_from_totals: z.boolean().optional(),
  colour: hexColourSchema,
});

// Reassign transactions schema
export const reassignCategorySchema = z.object({
  target_category_id: z.string().uuid(),
});

export type Category = z.infer<typeof categorySchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
export type ReassignCategory = z.infer<typeof reassignCategorySchema>;
