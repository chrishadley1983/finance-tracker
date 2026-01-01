import { z } from 'zod';

export const matchTypeSchema = z.enum(['exact', 'contains', 'regex']);

export const categoryMappingSchema = z.object({
  id: z.string().uuid(),
  pattern: z.string().min(1).max(500),
  category_id: z.string().uuid(),
  match_type: matchTypeSchema,
  confidence: z.number().min(0).max(1),
  created_at: z.string().datetime(),
});

export const createCategoryMappingSchema = z.object({
  pattern: z.string().min(1).max(500),
  category_id: z.string().uuid(),
  match_type: matchTypeSchema.optional().default('contains'),
  confidence: z.number().min(0).max(1).optional().default(1.0),
});

export const updateCategoryMappingSchema = z.object({
  pattern: z.string().min(1).max(500).optional(),
  category_id: z.string().uuid().optional(),
  match_type: matchTypeSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type CategoryMapping = z.infer<typeof categoryMappingSchema>;
export type CreateCategoryMapping = z.infer<typeof createCategoryMappingSchema>;
export type UpdateCategoryMapping = z.infer<typeof updateCategoryMappingSchema>;
export type MatchType = z.infer<typeof matchTypeSchema>;
