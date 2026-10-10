import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const rungSchema = z.object({
  year: z.number().int().min(2030).max(2055),
  status: z.enum(['pending', 'bought', 'split']),
  epic: z.string().max(10).nullable().optional(),
  face_value: z.number().nonnegative().nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  purchased_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('plan_ladder_rungs')
    .select('*')
    .order('year');
  if (error) {
    // Table may not exist yet (migration 009 pending) — page must still render.
    return NextResponse.json({ rungs: [], warning: error.message }, { status: 200 });
  }
  return NextResponse.json({ rungs: data ?? [] });
}

export async function PUT(request: NextRequest) {
  try {
    const rung = rungSchema.parse(await request.json());
    const { data, error } = await supabaseAdmin
      .from('plan_ladder_rungs')
      .upsert({ ...rung, updated_at: new Date().toISOString() }, { onConflict: 'year' })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rung: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('PUT /api/plan/rungs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
