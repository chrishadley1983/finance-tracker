import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const createSnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  balance: z.number(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get('from');

    // Verify account exists
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Fetch snapshots
    let query = supabaseAdmin
      .from('wealth_snapshots')
      .select('id, date, balance, notes')
      .eq('account_id', accountId)
      .order('date', { ascending: false });

    if (fromDate) {
      query = query.gte('date', fromDate);
    }

    const { data: snapshots, error: snapshotsError } = await query;

    if (snapshotsError) {
      return NextResponse.json(
        { error: snapshotsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      snapshots: snapshots || [],
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
      },
    });
  } catch (error) {
    console.error('GET /api/accounts/[id]/snapshots error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;
    const body = await request.json();

    const validated = createSnapshotSchema.parse(body);

    // Verify account exists
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Check if snapshot already exists for this date
    const { data: existing } = await supabaseAdmin
      .from('wealth_snapshots')
      .select('id')
      .eq('account_id', accountId)
      .eq('date', validated.date)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A snapshot already exists for this date' },
        { status: 400 }
      );
    }

    // Create snapshot
    const { data: snapshot, error: insertError } = await supabaseAdmin
      .from('wealth_snapshots')
      .insert({
        account_id: accountId,
        date: validated.date,
        balance: validated.balance,
        notes: validated.notes,
      })
      .select('id, date, balance, notes')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/accounts/[id]/snapshots error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
