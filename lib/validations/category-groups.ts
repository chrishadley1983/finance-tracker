import { z } from 'zod';

// Hex colour validation
const hexColourSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional();

export const categoryGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  display_order: z.number().int().min(0),
  colour: hexColourSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createCategoryGroupSchema = z.object({
  name: z.string().min(1).max(255),
  display_order: z.number().int().min(0).optional().default(0),
  colour: hexColourSchema,
});

export const updateCategoryGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  display_order: z.number().int().min(0).optional(),
  colour: hexColourSchema,
});

// Bulk reorder schema
export const reorderCategoryGroupsSchema = z.object({
  groups: z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number().int().min(0),
  })),
});

export type CategoryGroup = z.infer<typeof categoryGroupSchema>;
export type CreateCategoryGroup = z.infer<typeof createCategoryGroupSchema>;
export type UpdateCategoryGroup = z.infer<typeof updateCategoryGroupSchema>;
export type ReorderCategoryGroups = z.infer<typeof reorderCategoryGroupsSchema>;
