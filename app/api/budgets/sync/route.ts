import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const syncSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});

/**
 * POST /api/budgets/sync
 *
 * Ensures all active categories have budget entries for the specified year.
 * Creates £0 budget entries for any categories missing from the budgets table.
 * This keeps budgets aligned with the current category structure.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year } = syncSchema.parse(body);

    // Get all active categories
    const { data: categories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id, name');

    if (catError) {
      console.error('Error fetching categories:', catError);
      return NextResponse.json({ error: catError.message }, { status: 500 });
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No categories found',
        created: 0
      });
    }

    // Get existing budget entries for this year
    const { data: existingBudgets, error: budgetError } = await supabaseAdmin
      .from('budgets')
      .select('category_id, month')
      .eq('year', year);

    if (budgetError) {
      console.error('Error fetching existing budgets:', budgetError);
      return NextResponse.json({ error: budgetError.message }, { status: 500 });
    }

    // Create a set of existing category_id:month combinations
    const existingSet = new Set(
      (existingBudgets || []).map(b => `${b.category_id}:${b.month}`)
    );

    // Find missing budget entries
    const missingEntries: Array<{
      category_id: string;
      year: number;
      month: number;
      amount: number;
    }> = [];

    for (const category of categories) {
      for (let month = 1; month <= 12; month++) {
        const key = `${category.id}:${month}`;
        if (!existingSet.has(key)) {
          missingEntries.push({
            category_id: category.id,
            year,
            month,
            amount: 0,
          });
        }
      }
    }

    // Insert missing entries
    if (missingEntries.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('budgets')
        .insert(missingEntries);

      if (insertError) {
        console.error('Error inserting budget entries:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced budgets for ${year}`,
      categoriesChecked: categories.length,
      entriesCreated: missingEntries.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/budgets/sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
