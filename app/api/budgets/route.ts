import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createBudgetSchema, budgetQuerySchema } from '@/lib/validations/budgets';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = budgetQuerySchema.parse({
      year: searchParams.get('year') || undefined,
      month: searchParams.get('month') || undefined,
      category_id: searchParams.get('category_id') || undefined,
    });

    let queryBuilder = supabaseAdmin
      .from('budgets')
      .select('*, category:categories(name, group_name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (query.year) {
      queryBuilder = queryBuilder.eq('year', query.year);
    }
    if (query.month) {
      queryBuilder = queryBuilder.eq('month', query.month);
    }
    if (query.category_id) {
      queryBuilder = queryBuilder.eq('category_id', query.category_id);
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
    const validated = createBudgetSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from('budgets')
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
