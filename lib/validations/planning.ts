import { z } from 'zod';

// === PLANNING SECTIONS ===

export const planningSectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  year_label: z.string().nullable(),
  colour: z.string().nullable(),
  icon: z.string().nullable(),
  display_order: z.number().int(),
  is_archived: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createPlanningSectionSchema = z.object({
  name: z.string().min(1, 'Section name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  year_label: z.string().max(20).nullable().optional(),
  colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid colour format').nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
});

export const updatePlanningSectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  year_label: z.string().max(20).nullable().optional(),
  colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  is_archived: z.boolean().optional(),
  display_order: z.number().int().optional(),
});

// === PLANNING NOTES ===

export const planningNoteSchema = z.object({
  id: z.string().uuid(),
  section_id: z.string().uuid(),
  content: z.string().min(1),
  display_order: z.number().int(),
  is_pinned: z.boolean(),
  tags: z.array(z.string()).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createPlanningNoteSchema = z.object({
  section_id: z.string().uuid(),
  content: z.string().min(1, 'Note content is required'),
  is_pinned: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(10).nullable().optional(),
});

export const updatePlanningNoteSchema = z.object({
  section_id: z.string().uuid().optional(),
  content: z.string().min(1).optional(),
  is_pinned: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(10).nullable().optional(),
  display_order: z.number().int().optional(),
});

// === QUERY SCHEMAS ===

export const planningSectionQuerySchema = z.object({
  includeArchived: z.enum(['true', 'false']).optional(),
  includeNotes: z.enum(['true', 'false']).optional(),
});

export const planningNoteQuerySchema = z.object({
  section_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

// === REORDER SCHEMAS ===

export const reorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number().int().min(0),
  })),
});

// === BULK IMPORT SCHEMA ===

export const bulkImportNotesSchema = z.object({
  notes: z.array(z.object({
    section_id: z.string().uuid(),
    content: z.string().min(1),
    tags: z.array(z.string()).nullable().optional(),
  })),
});

// === TYPES ===

export type PlanningSection = z.infer<typeof planningSectionSchema>;
export type CreatePlanningSection = z.infer<typeof createPlanningSectionSchema>;
export type UpdatePlanningSection = z.infer<typeof updatePlanningSectionSchema>;
export type PlanningNote = z.infer<typeof planningNoteSchema>;
export type CreatePlanningNote = z.infer<typeof createPlanningNoteSchema>;
export type UpdatePlanningNote = z.infer<typeof updatePlanningNoteSchema>;

// Extended type for section with notes
export type PlanningSectionWithNotes = PlanningSection & {
  notes: PlanningNote[];
};
