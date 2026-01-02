import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  createValuationSchema,
  type InvestmentValuation,
} from '@/lib/types/investment';
import type { Database } from '@/lib/supabase/database.types';

type ValuationRow = Database['public']['Tables']['investment_valuations']['Row'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// =============================================================================
// GET - List valuations for account
// =============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    
    // Verify account exists
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('type', 'investment')
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Investment account not found' },
        { status: 404 }
      );
    }

    // Get total count
    const { count } = await supabaseAdmin
      .from('investment_valuations')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', id);

    // Get valuations with pagination
    const { data: valuations, error } = await supabaseAdmin
      .from('investment_valuations')
      .select('*')
      .eq('account_id', id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching valuations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch valuations' },
        { status: 500 }
      );
    }

    const result: InvestmentValuation[] = (valuations || []).map((v: ValuationRow) => ({
      id: v.id,
      accountId: v.account_id,
      date: v.date,
      value: v.value,
      notes: v.notes,
      createdAt: v.created_at || '',
      updatedAt: v.updated_at || '',
    }));

    return NextResponse.json({
      valuations: result,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Add valuation (upserts on date)
// =============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = createValuationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { date, value, notes } = validation.data;

    // Validate date is not in the future
    const valuationDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (valuationDate > today) {
      return NextResponse.json(
        { error: 'Valuation date cannot be in the future' },
        { status: 400 }
      );
    }

    
    // Verify account exists
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('type', 'investment')
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Investment account not found' },
        { status: 404 }
      );
    }

    // Upsert valuation (update if exists for same date)
    const { data: valuation, error } = await supabaseAdmin
      .from('investment_valuations')
      .upsert(
        {
          account_id: id,
          date,
          value,
          notes: notes || null,
        },
        {
          onConflict: 'account_id,date',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error creating valuation:', error);
      return NextResponse.json(
        { error: 'Failed to create valuation' },
        { status: 500 }
      );
    }

    const result: InvestmentValuation = {
      id: valuation.id,
      accountId: valuation.account_id,
      date: valuation.date,
      value: valuation.value,
      notes: valuation.notes,
      createdAt: valuation.created_at || '',
      updatedAt: valuation.updated_at || '',
    };

    return NextResponse.json({ valuation: result }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
