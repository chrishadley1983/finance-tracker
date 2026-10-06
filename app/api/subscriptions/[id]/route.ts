import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { subscriptionUpdateSchema } from '@/lib/validations/subscriptions';

const idSchema = z.string().uuid();

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/subscriptions/[id]
 * Change some fields of a subscription (e.g. a new price, or status 'cancelled').
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const id = idSchema.parse((await params).id);
    const body = subscriptionUpdateSchema.parse(await request.json());
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }
      console.error('Error updating subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    console.error('Error in PATCH /api/subscriptions/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/subscriptions/[id]
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const id = idSchema.parse((await params).id);
    const { data, error } = await supabaseAdmin.from('subscriptions').delete().eq('id', id).select('id');
    if (error) {
      console.error('Error deleting subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid subscription id' }, { status: 400 });
    }
    console.error('Error in DELETE /api/subscriptions/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
