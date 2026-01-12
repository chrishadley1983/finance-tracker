import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const copyYearSchema = z.object({
  sourceYear: z.number().int().min(2000).max(2100),
  targetYear: z.number().int().min(2000).max(2100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceYear, targetYear } = copyYearSchema.parse(body);

    if (sourceYear === targetYear) {
      return NextResponse.json(
        { error: 'Source and target years must be different' },
        { status: 400 }
      );
    }

    // Check if target year already has meaningful budgets (non-zero amounts)
    const { data: existingBudgets, error: checkError } = await supabaseAdmin
      .from('budgets')
      .select('id, amount')
      .eq('year', targetYear)
      .gt('amount', 0)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing budgets:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    const hasNonZeroBudgets = existingBudgets && existingBudgets.length > 0;

    if (hasNonZeroBudgets) {
      return NextResponse.json(
        { error: `Budgets with non-zero amounts already exist for ${targetYear}. Delete them first to copy.` },
        { status: 400 }
      );
    }

    // Delete any existing £0 budget entries for the target year (created by sync)
    const { error: deleteError } = await supabaseAdmin
      .from('budgets')
      .delete()
      .eq('year', targetYear);

    if (deleteError) {
      console.error('Error deleting existing zero budgets:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Fetch all budgets from source year
    const { data: sourceBudgets, error: fetchError } = await supabaseAdmin
      .from('budgets')
      .select('category_id, month, amount')
      .eq('year', sourceYear);

    if (fetchError) {
      console.error('Error fetching source budgets:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!sourceBudgets || sourceBudgets.length === 0) {
      return NextResponse.json(
        { error: `No budgets found for ${sourceYear}` },
        { status: 404 }
      );
    }

    // Insert budgets for target year
    const newBudgets = sourceBudgets.map((budget) => ({
      category_id: budget.category_id,
      year: targetYear,
      month: budget.month,
      amount: budget.amount,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('budgets')
      .insert(newBudgets);

    if (insertError) {
      console.error('Error inserting budgets:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Copied ${newBudgets.length} budget entries from ${sourceYear} to ${targetYear}`,
      count: newBudgets.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/budgets/copy-year error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
