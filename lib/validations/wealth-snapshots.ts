import { z } from 'zod';

export const wealthSnapshotSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  balance: z.number(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
});

export const createWealthSnapshotSchema = z.object({
  account_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  balance: z.number(),
  notes: z.string().nullable().optional(),
});

export const updateWealthSnapshotSchema = z.object({
  account_id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  balance: z.number().optional(),
  notes: z.string().nullable().optional(),
});

// Query params for filtering wealth snapshots
export const wealthSnapshotQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type WealthSnapshot = z.infer<typeof wealthSnapshotSchema>;
export type CreateWealthSnapshot = z.infer<typeof createWealthSnapshotSchema>;
export type UpdateWealthSnapshot = z.infer<typeof updateWealthSnapshotSchema>;
export type WealthSnapshotQuery = z.infer<typeof wealthSnapshotQuerySchema>;
