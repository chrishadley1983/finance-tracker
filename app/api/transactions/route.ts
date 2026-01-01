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
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    let queryBuilder = supabaseAdmin
      .from('transactions')
      .select('*, account:accounts(name), category:categories(name, group_name)')
      .order('date', { ascending: false });

    if (query.account_id) {
      queryBuilder = queryBuilder.eq('account_id', query.account_id);
    }
    if (query.category_id) {
      queryBuilder = queryBuilder.eq('category_id', query.category_id);
    }
    if (query.start_date) {
      queryBuilder = queryBuilder.gte('date', query.start_date);
    }
    if (query.end_date) {
      queryBuilder = queryBuilder.lte('date', query.end_date);
    }

    queryBuilder = queryBuilder.range(query.offset, query.offset + query.limit - 1);

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
