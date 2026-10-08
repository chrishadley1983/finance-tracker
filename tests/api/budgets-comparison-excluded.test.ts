/**
 * GET /api/budgets/comparison leaves out categories marked "exclude from
 * totals" (transfers between own accounts, credit card payments), like the
 * savings rate, reports and dashboard do.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const fake = vi.hoisted(() => ({ db: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return fake.db!.client;
  },
}));

import { GET } from '@/app/api/budgets/comparison/route';

describe('GET /api/budgets/comparison', () => {
  it('drops excluded categories from rows, groups and totals', async () => {
    fake.db = createFakeSupabase(
      {
        categories: [
          { id: 'eat', name: 'Eating out', exclude_from_totals: false },
          { id: 'tr', name: 'Transfers', exclude_from_totals: true },
          { id: 'cc', name: 'Credit card payments', exclude_from_totals: true },
        ],
      },
      {
        get_budget_vs_actual: () => [
          { category_id: 'eat', category_name: 'Eating out', group_name: 'Entertainment', is_income: false, budget_amount: 4200, actual_amount: 3724.49 },
          { category_id: 'tr', category_name: 'Transfers', group_name: 'Transfers', is_income: false, budget_amount: 0, actual_amount: 48243.84 },
          { category_id: 'cc', category_name: 'Credit card payments', group_name: 'Transfers', is_income: false, budget_amount: 0, actual_amount: -32702 },
        ],
      }
    );
    const res = await GET(new NextRequest('http://localhost/api/budgets/comparison?year=2026'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comparisons.map((c: { categoryName: string }) => c.categoryName)).toEqual(['Eating out']);
    expect(body.groups.map((g: { groupName: string }) => g.groupName)).toEqual(['Entertainment']);
    expect(body.groups[0].totals).toEqual({ budget: 4200, actual: 3724.49, variance: 3724.49 - 4200 });
  });
});
