import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createTransactionSchema, transactionQuerySchema } from '@/lib/validations/transactions';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = transactionQuerySchema.parse({
      account_id: searchParams.get('account_id') || undefined,
      category_id: searchParams.get('category_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      sort_column: searchParams.get('sort_column') || undefined,
      sort_direction: searchParams.get('sort_direction') || undefined,
    });

    // Build base query for count
    let countBuilder = supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true });

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

    // Build query for data
    let queryBuilder = supabaseAdmin
      .from('transactions')
      .select('*, account:accounts(name), category:categories(name, group_name)')
      .order(sortColumn, { ascending: sortAscending });

    // Apply filters to both queries
    if (query.account_id) {
      countBuilder = countBuilder.eq('account_id', query.account_id);
      queryBuilder = queryBuilder.eq('account_id', query.account_id);
    }
    if (query.category_id) {
      countBuilder = countBuilder.eq('category_id', query.category_id);
      queryBuilder = queryBuilder.eq('category_id', query.category_id);
    }
    if (query.start_date) {
      countBuilder = countBuilder.gte('date', query.start_date);
      queryBuilder = queryBuilder.gte('date', query.start_date);
    }
    if (query.end_date) {
      countBuilder = countBuilder.lte('date', query.end_date);
      queryBuilder = queryBuilder.lte('date', query.end_date);
    }
    if (query.search) {
      countBuilder = countBuilder.ilike('description', `%${query.search}%`);
      queryBuilder = queryBuilder.ilike('description', `%${query.search}%`);
    }

    // Filter by validation status
    const validatedParam = searchParams.get('validated');
    if (validatedParam === 'validated') {
      countBuilder = countBuilder.eq('is_validated', true);
      queryBuilder = queryBuilder.eq('is_validated', true);
    } else if (validatedParam === 'unvalidated') {
      countBuilder = countBuilder.eq('is_validated', false);
      queryBuilder = queryBuilder.eq('is_validated', false);
    }

    // Apply pagination only to data query
    queryBuilder = queryBuilder.range(query.offset, query.offset + query.limit - 1);

    // Execute both queries
    const [countResult, dataResult] = await Promise.all([
      countBuilder,
      queryBuilder,
    ]);

    if (countResult.error) {
      return NextResponse.json({ error: countResult.error.message }, { status: 500 });
    }
    if (dataResult.error) {
      return NextResponse.json({ error: dataResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: dataResult.data,
      total: countResult.count ?? 0,
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
