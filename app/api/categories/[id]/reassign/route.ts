import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { reassignCategorySchema } from '@/lib/validations/categories';
import { ZodError } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: sourceCategoryId } = await params;
    const body = await request.json();
    const { target_category_id } = reassignCategorySchema.parse(body);

    // Validate source category exists
    const { data: sourceCategory, error: sourceError } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('id', sourceCategoryId)
      .single();

    if (sourceError || !sourceCategory) {
      return NextResponse.json(
        { error: 'Source category not found' },
        { status: 404 }
      );
    }

    // Validate target category exists
    const { data: targetCategory, error: targetError } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('id', target_category_id)
      .single();

    if (targetError || !targetCategory) {
      return NextResponse.json(
        { error: 'Target category not found' },
        { status: 404 }
      );
    }

    // Cannot reassign to same category
    if (sourceCategoryId === target_category_id) {
      return NextResponse.json(
        { error: 'Source and target category must be different' },
        { status: 400 }
      );
    }

    // Count transactions to be moved
    const { count: transactionCount, error: countError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', sourceCategoryId);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if (!transactionCount || transactionCount === 0) {
      return NextResponse.json(
        { error: 'No transactions to reassign' },
        { status: 400 }
      );
    }

    // Move all transactions to target category
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ category_id: target_category_id })
      .eq('category_id', sourceCategoryId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      transactions_moved: transactionCount,
      from_category: sourceCategory.name,
      to_category: targetCategory.name,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/categories/[id]/reassign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
