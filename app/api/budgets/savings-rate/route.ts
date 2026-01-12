import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';
import type { SavingsRate } from '@/lib/types/budget';

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
    const { data, error } = await supabaseAdmin.rpc('get_savings_rate', {
      p_year: query.year,
      p_month: query.month,
    });

    if (error) {
      console.error('Error fetching savings rate:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        year: query.year,
        month: query.month || null,
        savingsRate: {
          totalIncomeBudget: 0,
          totalIncomeActual: 0,
          totalExpenseBudget: 0,
          totalExpenseActual: 0,
          savingsBudget: 0,
          savingsActual: 0,
          savingsRateBudget: 0,
          savingsRateActual: 0,
        },
      });
    }

    const row = data[0];
    const savingsRate: SavingsRate = {
      totalIncomeBudget: Number(row.total_income_budget) || 0,
      totalIncomeActual: Number(row.total_income_actual) || 0,
      totalExpenseBudget: Number(row.total_expense_budget) || 0,
      totalExpenseActual: Number(row.total_expense_actual) || 0,
      savingsBudget: Number(row.savings_budget) || 0,
      savingsActual: Number(row.savings_actual) || 0,
      savingsRateBudget: Number(row.savings_rate_budget) || 0,
      savingsRateActual: Number(row.savings_rate_actual) || 0,
    };

    const response = NextResponse.json({
      year: query.year,
      month: query.month || null,
      savingsRate,
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
    console.error('GET /api/budgets/savings-rate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
