/**
 * GET /api/monthly-reports/readiness and POST /api/monthly-reports/generate:
 * agent-key auth, end-to-end readiness over an in-memory finance DB, and the
 * generate route stamping generated_at (which readiness compares against).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
  createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
const agg = vi.hoisted(() => ({ calls: 0 }));
vi.mock('@/lib/reports/aggregate', async (orig) => {
  const real = await orig<typeof import('@/lib/reports/aggregate')>();
  return {
    ...real,
    aggregateMonthlyReport: async (year: number, month: number) => {
      agg.calls++;
      return {
        year, month, monthName: 'September', generatedAt: 'x', netWorth: 1, netWorthChange: 0, income: 1,
        expenses: 1, savingsRate: 0, firePortfolio: 0, holidayFire: null, wealthBreakdown: [], budgetComparisons: [],
      };
    },
  };
});
vi.mock('@/lib/reports/monthly-html', () => ({ generateMonthlyReportHtml: () => '<html></html>' }));

import { GET as READINESS } from '@/app/api/monthly-reports/readiness/route';
import { POST as GENERATE } from '@/app/api/monthly-reports/generate/route';

const KEY = 'test-agent-key-0123456789';
process.env.FINANCE_AGENT_KEY = KEY;

function seed(report: { year: number; month: number; generated_at: string } | null = null) {
  db.current = createFakeSupabase({
    accounts: [
      { id: 'joint', name: 'HSBC Joint Current Account', type: 'current', is_archived: false, include_in_net_worth: true, exclude_from_snapshots: true, sync_enabled: true, last_sync_at: '2026-10-02T06:00:00Z' },
      { id: 'isa', name: 'Abby S&S ISA', type: 'isa', is_archived: false, include_in_net_worth: true, exclude_from_snapshots: false, sync_enabled: false, last_sync_at: null },
      { id: 'house', name: 'House Net Worth', type: 'property', is_archived: false, include_in_net_worth: true, exclude_from_snapshots: false, sync_enabled: false, last_sync_at: null },
    ],
    wealth_snapshots: [
      { id: 's1', account_id: 'isa', date: '2026-10-01', balance: 1, created_at: '2026-10-01T09:00:00Z', data_changed_at: null },
      { id: 's2', account_id: 'house', date: '2026-09-01', balance: 1, created_at: '2026-09-01T09:00:00Z', data_changed_at: null },
    ],
    transactions: [
      { id: 't1', account_id: 'joint', date: '2026-09-10', category_id: 'c', needs_review: false, is_validated: false, created_at: '2026-09-10T10:00:00Z', data_changed_at: null },
      { id: 't2', account_id: 'joint', date: '2026-08-31', category_id: null, needs_review: true, is_validated: false, created_at: '2026-08-31T10:00:00Z', data_changed_at: null },
    ],
    monthly_reports: report ? [{ id: 'r1', ...report }] : [],
  });
}

const get = (qs: string, key?: string) =>
  new NextRequest(`http://x/api/monthly-reports/readiness${qs}`, { headers: key ? { 'x-api-key': key } : {} });
const post = (body: unknown, key?: string) =>
  new NextRequest('http://x/api/monthly-reports/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  agg.calls = 0;
  seed();
});

describe('GET /api/monthly-reports/readiness', () => {
  it('requires the agent key or a session', async () => {
    expect((await READINESS(get('?year=2026&month=9'))).status).toBe(401);
    expect((await READINESS(get('?year=2026&month=9', 'wrong'))).status).toBe(401);
  });

  it('rejects an invalid month', async () => {
    expect((await READINESS(get('?year=2026&month=13', KEY))).status).toBe(400);
  });

  it('reports each check over the month’s rows only', async () => {
    const res = await READINESS(get('?year=2026&month=9', KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    const by = Object.fromEntries(body.checks.map((c: { key: string }) => [c.key, c]));
    expect(by.wealth).toMatchObject({ ok: false, missing: ['House Net Worth'] });
    expect(by.synced.ok).toBe(true);
    expect(by.categorised).toMatchObject({ ok: true, count: 0 });            // the flagged row is dated August
    expect(by.validated).toMatchObject({ ok: false, count: 1, byAccount: { 'HSBC Joint Current Account': 1 } });
    expect(body).toMatchObject({ ready: false, reportExists: false, action: 'wait' });
  });

  it('ready and reported, nothing changed since → none; a later change → regenerate', async () => {
    seed({ year: 2026, month: 9, generated_at: '2026-10-02T08:00:00Z' });
    const t = db.current!.table('transactions');
    t[0].is_validated = true;
    db.current!.table('wealth_snapshots').push({ id: 's3', account_id: 'house', date: '2026-10-01', balance: 1, created_at: '2026-10-01T09:00:00Z', data_changed_at: null });
    let body = await (await READINESS(get('?year=2026&month=9', KEY))).json();
    expect(body).toMatchObject({ ready: true, reportExists: true, changedSinceReport: false, action: 'none' });

    t[0].data_changed_at = '2026-10-03T08:00:00Z';                          // recategorised after the report
    body = await (await READINESS(get('?year=2026&month=9', KEY))).json();
    expect(body).toMatchObject({ changedSinceReport: true, action: 'regenerate' });
  });
});

describe('POST /api/monthly-reports/generate', () => {
  it('accepts the agent key, rejects a wrong one', async () => {
    expect((await GENERATE(post({ year: 2026, month: 9 }, 'wrong'))).status).toBe(401);
    expect(agg.calls).toBe(0);
    const res = await GENERATE(post({ year: 2026, month: 9 }, KEY));
    expect(res.status).toBe(200);
    expect(agg.calls).toBe(1);
  });

  it('stamps generated_at on save, also when replacing an existing report', async () => {
    seed({ year: 2026, month: 9, generated_at: '2026-01-01T00:00:00Z' });
    const before = Date.now();
    await GENERATE(post({ year: 2026, month: 9 }, KEY));
    const rows = db.current!.table('monthly_reports').filter((r) => r.year === 2026 && r.month === 9);
    expect(rows).toHaveLength(1);
    expect(new Date(String(rows[0].generated_at)).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
