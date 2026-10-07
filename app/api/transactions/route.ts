import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createTransactionSchema } from '@/lib/validations/transactions';
import { applyTransactionFilters, parseTransactionQuery, sumTransactionAmounts } from '@/lib/transactions/query';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const query = parseTransactionQuery(request.nextUrl.searchParams);

    // Map frontend column names to database columns
    const sortColumnMap: Record<string, string> = {
      date: 'date',
      description: 'description',
      amount: 'amount',
      account: 'account_id',
      category: 'category_id',
    };

    const sortColumn = query.sort_column && sortColumnMap[query.sort_column]
      ? sortColumnMap[query.sort_column]
      : 'date';
    const sortAscending = query.sort_direction === 'asc';

    // Count across the filtered set
    const countBuilder = applyTransactionFilters(
      supabaseAdmin.from('transactions').select('*', { count: 'exact', head: true }),
      query
    );

    // One page of data
    const queryBuilder = applyTransactionFilters(
      supabaseAdmin
        .from('transactions')
        .select('*, account:accounts(name), category:categories(name, group_name)'),
      query
    )
      .order(sortColumn, { ascending: sortAscending })
      .order('id', { ascending: true }) // tie-break so same-date rows page stably
      .range(query.offset, query.offset + query.limit - 1);

    const [countResult, dataResult] = await Promise.all([countBuilder, queryBuilder]);

    if (countResult.error) {
      return NextResponse.json({ error: countResult.error.message }, { status: 500 });
    }
    if (dataResult.error) {
      return NextResponse.json({ error: dataResult.error.message }, { status: 500 });
    }

    const total = countResult.count ?? 0;

    // Money out / in across every matching row (not just this page).
    const totals = query.totals === '0' ? undefined : await sumTransactionAmounts(query, total);

    return NextResponse.json({
      data: dataResult.data,
      total,
      ...(totals ? { totals } : {}),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('GET /api/transactions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createTransactionSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from('transactions')
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
    console.error('POST /api/transactions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
