import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';
import type { BudgetComparison, BudgetGroupComparison } from '@/lib/types/budget';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse({
      year: searchParams.get('year') || new Date().getFullYear(),
      month: searchParams.get('month') || undefined,
    });

    // Call the RPC function
    const { data, error } = await supabaseAdmin.rpc('get_budget_vs_actual', {
      p_year: query.year,
      p_month: query.month,
    });

    if (error) {
      console.error('Error fetching budget comparison:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Categories marked "exclude from totals" (transfers between your own
    // accounts, credit card payments) are not spending or income: leave them
    // out, as the savings rate, reports and dashboard already do.
    const { data: excludedRows, error: excludedError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('exclude_from_totals', true);
    if (excludedError) {
      console.error('Error fetching excluded categories:', excludedError);
      return NextResponse.json({ error: excludedError.message }, { status: 500 });
    }
    const excluded = new Set((excludedRows ?? []).map((c: { id: string }) => c.id));

    // Transform to camelCase and group by category group
    const comparisons: BudgetComparison[] = (data || []).filter((row: { category_id: string }) => !excluded.has(row.category_id)).map((row: {
      category_id: string;
      category_name: string;
      group_name: string;
      is_income: boolean;
      budget_amount: number;
      actual_amount: number;
    }) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      groupName: row.group_name,
      isIncome: row.is_income,
      budgetAmount: Number(row.budget_amount),
      actualAmount: Number(row.actual_amount),
      // The RPC doesn't return variance; derive it (actual - budget). The
      // actual is now sign-aware (migration 005), so this is meaningful.
      variance: Number(row.actual_amount) - Number(row.budget_amount),
    }));

    // Group by group_name
    const groupMap = new Map<string, BudgetGroupComparison>();

    for (const comparison of comparisons) {
      if (!groupMap.has(comparison.groupName)) {
        groupMap.set(comparison.groupName, {
          groupName: comparison.groupName,
          isIncome: comparison.isIncome,
          categories: [],
          totals: { budget: 0, actual: 0, variance: 0 },
        });
      }

      const group = groupMap.get(comparison.groupName)!;
      group.categories.push(comparison);
      group.totals.budget += comparison.budgetAmount;
      group.totals.actual += comparison.actualAmount;
      group.totals.variance += comparison.variance;
    }

    // Sort groups: Income first, then alphabetically
    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.isIncome && !b.isIncome) return -1;
      if (!a.isIncome && b.isIncome) return 1;
      return a.groupName.localeCompare(b.groupName);
    });

    const response = NextResponse.json({
      year: query.year,
      month: query.month || null,
      groups,
      comparisons,
    });

    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('GET /api/budgets/comparison error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
