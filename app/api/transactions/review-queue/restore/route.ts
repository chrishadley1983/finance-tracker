import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const restoreSchema = z.object({
  /** When the action being undone started; corrections it recorded are removed. */
  since: z.string().datetime(),
  rows: z
    .array(
      z.object({
        id: z.string().uuid(),
        category_id: z.string().uuid().nullable(),
        categorisation_source: z.enum(['manual', 'rule', 'ai', 'import']),
        engine_source: z.string().nullable(),
        categorisation_confidence: z.number().nullable(),
        needs_review: z.boolean(),
        is_validated: z.boolean(),
      })
    )
    .min(1)
    .max(500),
});

/**
 * POST /api/transactions/review-queue/restore
 *
 * Undo for the review queue: puts rows back exactly as they were before an
 * accept/categorise action and removes the learning corrections that action
 * recorded, so an undone choice doesn't teach the categoriser.
 */
export async function POST(request: NextRequest) {
  try {
    const { since, rows } = restoreSchema.parse(await request.json());

    let restored = 0;
    for (const { id, ...fields } of rows) {
      const { error } = await supabaseAdmin.from('transactions').update(fields).eq('id', id);
      if (error) throw new Error(error.message);
      restored++;
    }

    const { error: corrError } = await supabaseAdmin
      .from('category_corrections')
      .delete()
      .in(
        'transaction_id',
        rows.map((r) => r.id)
      )
      .gte('created_at', since);
    if (corrError) console.warn('Undo: failed to remove corrections:', corrError.message);

    return NextResponse.json({ restored });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('POST /api/transactions/review-queue/restore error:', error);
    return NextResponse.json({ error: 'Failed to undo' }, { status: 500 });
  }
}
