import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/subscriptions/route';
import { PATCH, DELETE } from '@/app/api/subscriptions/[id]/route';
import { POST as DISMISS } from '@/app/api/subscriptions/exclusions/route';

/**
 * A chainable Supabase query mock: every builder method records its call and returns the chain;
 * awaiting the chain (or calling .single()) resolves with the result queued for that table.
 */
type Result = { data: unknown; error: unknown };
const calls: { table: string; method: string; args: unknown[] }[] = [];
const results = new Map<string, Result[]>();

function queue(table: string, ...rs: Result[]) {
  results.set(table, [...(results.get(table) ?? []), ...rs]);
}

function next(table: string): Result {
  const q = results.get(table) ?? [];
  return q.length > 1 ? q.shift()! : q[0] ?? { data: [], error: null };
}

function chain(table: string) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'ilike', 'lt', 'gte', 'order', 'limit', 'range']) {
    c[m] = (...args: unknown[]) => {
      calls.push({ table, method: m, args });
      return c;
    };
  }
  c.single = () => Promise.resolve(next(table));
  c.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(next(table)).then(resolve, reject);
  return c;
}

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (table: string) => chain(table) },
}));

vi.mock('@/lib/subscriptions/analysis', async (orig) => {
  const actual = await orig<typeof import('@/lib/subscriptions/analysis')>();
  return { ...actual, ukToday: () => '2026-10-06' };
});


const ID = '550e8400-e29b-41d4-a716-446655440020';

const netflix = {
  id: ID,
  name: 'Netflix',
  provider: null,
  scope: 'personal',
  category: 'Streaming',
  amount: 10.99,
  currency: 'GBP',
  frequency: 'monthly',
  next_renewal_date: null,
  cancellation_notice_days: null,
  bank_description_pattern: 'NETFLIX.COM*',
  status: 'active',
  payment_method: null,
  plan_tier: null,
  notes: null,
  url: null,
  auto_renew: true,
  billing_day: null,
  start_date: null,
  end_date: null,
};

const json = (method: string, body: unknown) =>
  new NextRequest('http://localhost/api/subscriptions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  calls.length = 0;
  results.clear();
});

describe('GET /api/subscriptions', () => {
  it('returns subscriptions checked against their charges, a summary and untracked candidates', async () => {
    queue('subscriptions', { data: [netflix], error: null });
    queue(
      'transactions',
      // Netflix's own charges (the per-subscription query runs first)
      { data: [{ date: '2026-09-20', amount: -12.99, description: 'NETFLIX.COM' }], error: null },
      // Outgoings for the untracked check (one short page)
      {
        data: [
          { date: '2026-09-15', amount: -24.99, description: 'GYM GROUP 15/09' },
          { date: '2026-08-15', amount: -24.99, description: 'GYM GROUP 15/08' },
          { date: '2026-07-15', amount: -24.99, description: 'GYM GROUP 15/07' },
          { date: '2026-09-20', amount: -12.99, description: 'NETFLIX.COM' },
        ],
        error: null,
      },
    );
    queue('subscription_exclusions', { data: [], error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.as_of).toBe('2026-10-06');
    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0]).toMatchObject({ last_charged: '2026-09-20', last_amount: 12.99, next_due: '2026-10-20' });
    expect(body.subscriptions[0].signals.map((s: { type: string }) => s.type)).toEqual(['price_change']);
    expect(body.summary).toMatchObject({ active_count: 1, monthly: 10.99, needs_attention: 1 });
    expect(body.untracked.map((u: { key: string }) => u.key)).toEqual(['gym group']);

    // The charge lookup matches the pattern literally, outgoing only, within 400 days.
    const ilike = calls.find((c) => c.table === 'transactions' && c.method === 'ilike');
    expect(ilike?.args).toEqual(['description', '%NETFLIX.COM%']);
    expect(calls).toContainEqual({ table: 'transactions', method: 'lt', args: ['amount', 0] });
    expect(calls).toContainEqual({ table: 'transactions', method: 'gte', args: ['date', '2025-09-01'] });
  });

  it('returns 500 with the database error', async () => {
    queue('subscriptions', { data: null, error: { message: 'boom' } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('boom');
  });
});

describe('POST /api/subscriptions', () => {
  it('validates and inserts', async () => {
    queue('subscriptions', { data: { ...netflix }, error: null });
    const res = await POST(json('POST', { name: 'Netflix', amount: '10.99', frequency: 'monthly' }));
    expect(res.status).toBe(201);
    const insert = calls.find((c) => c.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ name: 'Netflix', amount: 10.99, scope: 'personal', status: 'active', currency: 'GBP' });
  });

  it('rejects a missing name, a bad frequency and invalid JSON', async () => {
    expect((await POST(json('POST', { amount: 5 }))).status).toBe(400);
    expect((await POST(json('POST', { name: 'X', amount: 5, frequency: 'daily' }))).status).toBe(400);
    expect((await POST(json('POST', '{nope'))).status).toBe(400);
    expect(calls.some((c) => c.method === 'insert')).toBe(false);
  });
});

describe('PATCH /api/subscriptions/[id]', () => {
  it('updates only the given fields and stamps updated_at', async () => {
    queue('subscriptions', { data: { ...netflix, amount: 12.99 }, error: null });
    const res = await PATCH(json('PATCH', { amount: 12.99 }), params(ID));
    expect(res.status).toBe(200);
    const update = calls.find((c) => c.method === 'update')?.args[0] as Record<string, unknown>;
    expect(update.amount).toBe(12.99);
    expect(update.updated_at).toBeTypeOf('string');
    // Only what was sent: no defaults sneak in to reset scope, frequency, status or currency.
    expect(Object.keys(update).sort()).toEqual(['amount', 'updated_at']);
    expect(calls).toContainEqual({ table: 'subscriptions', method: 'eq', args: ['id', ID] });
  });

  it('404s an unknown id and 400s a bad id or empty body', async () => {
    queue('subscriptions', { data: null, error: { code: 'PGRST116', message: 'no rows' } });
    expect((await PATCH(json('PATCH', { amount: 1 }), params(ID))).status).toBe(404);
    expect((await PATCH(json('PATCH', { amount: 1 }), params('not-a-uuid'))).status).toBe(400);
    expect((await PATCH(json('PATCH', {}), params(ID))).status).toBe(400);
  });
});

describe('DELETE /api/subscriptions/[id]', () => {
  it('deletes, and 404s when nothing matched', async () => {
    queue('subscriptions', { data: [{ id: ID }], error: null }, { data: [], error: null });
    expect((await DELETE(json('DELETE', ''), params(ID))).status).toBe(200);
    expect((await DELETE(json('DELETE', ''), params(ID))).status).toBe(404);
  });
});

describe('POST /api/subscriptions/exclusions', () => {
  it('stores the dismissed pattern in lower case', async () => {
    queue('subscription_exclusions', { data: { id: 'x' }, error: null });
    const res = await DISMISS(json('POST', { description_pattern: 'Gym Group' }));
    expect(res.status).toBe(201);
    expect(calls.find((c) => c.method === 'insert')?.args[0]).toEqual({ description_pattern: 'gym group', reason: null });
  });

  it('rejects a too-short pattern', async () => {
    expect((await DISMISS(json('POST', { description_pattern: 'a' }))).status).toBe(400);
  });
});
