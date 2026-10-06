import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dismissUntrackedSchema } from '@/lib/validations/subscriptions';

/**
 * POST /api/subscriptions/exclusions
 * "Not a subscription": stop suggesting a repeating outgoing as an untracked subscription.
 */
export async function POST(request: NextRequest) {
  try {
    const body = dismissUntrackedSchema.parse(await request.json());
    const { data, error } = await supabaseAdmin
      .from('subscription_exclusions')
      .insert({ description_pattern: body.description_pattern.toLowerCase(), reason: body.reason ?? null })
      .select()
      .single();
    if (error) {
      console.error('Error adding subscription exclusion:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    console.error('Error in POST /api/subscriptions/exclusions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
