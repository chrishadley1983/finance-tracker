import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createWealthSnapshotSchema, wealthSnapshotQuerySchema } from '@/lib/validations/wealth-snapshots';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = wealthSnapshotQuerySchema.parse({
      account_id: searchParams.get('account_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
    });

    let queryBuilder = supabaseAdmin
      .from('wealth_snapshots')
      .select('*, account:accounts(name, type)')
      .order('date', { ascending: false });

    if (query.account_id) {
      queryBuilder = queryBuilder.eq('account_id', query.account_id);
    }
    if (query.start_date) {
      queryBuilder = queryBuilder.gte('date', query.start_date);
    }
    if (query.end_date) {
      queryBuilder = queryBuilder.lte('date', query.end_date);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createWealthSnapshotSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from('wealth_snapshots')
      .insert(validated)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
