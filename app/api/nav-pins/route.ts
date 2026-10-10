import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createNavPinSchema } from '@/lib/validations/nav-pins';

export const dynamic = 'force-dynamic';

/** GET /api/nav-pins — pinned pages, in order. */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('nav_pins')
    .select('id, href, label, position')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pins: data ?? [] });
}

/** POST /api/nav-pins — pin a page (pinning an already-pinned page updates its label). */
export async function POST(request: NextRequest) {
  try {
    const { href, label } = createNavPinSchema.parse(await request.json());
    const { data: last } = await supabaseAdmin
      .from('nav_pins')
      .select('position')
      .order('position', { ascending: false })
      .limit(1);
    const position = (last?.[0]?.position ?? -1) + 1;
    const { data, error } = await supabaseAdmin
      .from('nav_pins')
      .upsert({ href, label, position }, { onConflict: 'href' })
      .select('id, href, label, position')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pin: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('POST /api/nav-pins error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/nav-pins?href=/budgets — unpin a page. */
export async function DELETE(request: NextRequest) {
  const href = request.nextUrl.searchParams.get('href');
  if (!href) return NextResponse.json({ error: 'href is required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('nav_pins').delete().eq('href', href);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
