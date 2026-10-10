/**
 * GET /api/budgets/savings-rate with the row shape the live get_savings_rate returns (no savings
 * columns — only totals and rates; captured from the live function for Sep 2026).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { GET } from '@/app/api/budgets/savings-rate/route';

describe('GET /api/budgets/savings-rate', () => {
  it('derives savings from the totals (the RPC returns no savings columns)', async () => {
    db.current = createFakeSupabase({}, {
      get_savings_rate: () => [
        {
          total_income_budget: '9050',
          total_income_actual: '10083.67',
          total_expense_budget: '5833',
          total_expense_actual: '6967.34',
          savings_rate_budget: '35.54696132596685082900',
          savings_rate_actual: '30.90472020603609598500',
        },
      ],
    });
    const res = await GET(new NextRequest('http://localhost/api/budgets/savings-rate?year=2026&month=9'));
    const { savingsRate } = await res.json();
    expect(savingsRate.savingsActual).toBeCloseTo(3_116.33, 2); // was 0 ("Saved £0")
    expect(savingsRate.savingsBudget).toBe(3_217);
    // consistent with the RPC's own rate
    expect((savingsRate.savingsActual / savingsRate.totalIncomeActual) * 100).toBeCloseTo(savingsRate.savingsRateActual, 6);
  });
});
