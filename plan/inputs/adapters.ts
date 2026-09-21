/**
 * Observation adapters: DB rows → observation objects. Each takes the client
 * and returns plain JSON-able data with an asOf; the pure shaping lives in
 * observe.mjs so it can be unit-tested without a database.
 */
import type { Db } from './db';
import { pageAll } from './db';
import { latestPerAccount, incomeBySource } from './observe.mjs';
import { computeRunRate } from '../engine/spend.mjs';

type SnapshotRow = { date: string; balance: number | string; account: { name: string; type: string } | null };

export async function observeSnapshots(db: Db) {
  const { data, error } = await db.from('wealth_snapshots').select('date, balance, account:accounts(name, type)').order('date', { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r: { date: string; balance: number; account: unknown }) => ({ date: r.date, balance: r.balance, account: (Array.isArray(r.account) ? r.account[0] : r.account) as SnapshotRow['account'] }));
  return { kind: 'snapshots' as const, ...latestPerAccount(rows), rows };
}

export async function observeRunRate(db: Db, a: { spend: { planLine: number; excludedCategories: readonly string[] } }, today = new Date()) {
  const since = new Date(today); since.setFullYear(since.getFullYear() - 1);
  const sinceStr = since.toISOString().slice(0, 10);
  const txns = await pageAll<{ amount: number; category: unknown }>((from, to) => db.from('transactions').select('amount, category:categories(name, is_income, exclude_from_totals)').gte('date', sinceStr).range(from, to));
  const shaped = txns.map((t) => ({ amount: Number(t.amount), category: (Array.isArray(t.category) ? t.category[0] : t.category) as { name: string; is_income: boolean; exclude_from_totals: boolean } | null }));
  return { kind: 'runRate' as const, asOf: today.toISOString().slice(0, 10), since: sinceStr, txnCount: shaped.length, ...computeRunRate(a, shaped) };
}

export async function observeIncome(db: Db, today = new Date()) {
  const since = new Date(today); since.setFullYear(since.getFullYear() - 1);
  const sinceStr = since.toISOString().slice(0, 10);
  const rows = await pageAll<{ date: string; amount: number; description: string; category: unknown; account: unknown }>((from, to) =>
    db.from('transactions').select('date, amount, description, category:categories(name, category_groups(name)), account:accounts(name)').gte('date', sinceStr).range(from, to)
  );
  const one = (x: unknown) => (Array.isArray(x) ? x[0] : x) as Record<string, unknown> | null;
  const income = rows
    .map((r) => { const c = one(r.category); const g = c ? one(c.category_groups) : null; return { date: r.date, amount: Number(r.amount), description: r.description, category: (c?.name as string) ?? null, group: (g?.name as string) ?? null, account: (one(r.account)?.name as string) ?? null }; })
    .filter((r) => r.group === 'Income');
  return { kind: 'income' as const, asOf: today.toISOString().slice(0, 10), since: sinceStr, txnCount: income.length, ...incomeBySource(income) };
}

export async function observeRungs(db: Db) {
  const { data, error } = await db.from('plan_ladder_rungs').select('*').order('year');
  if (error) return { kind: 'rungs' as const, asOf: null as string | null, rungs: [] as Record<string, unknown>[], warning: error.message };
  const rungs = (data ?? []) as Record<string, unknown>[];
  const asOf = rungs.reduce<string | null>((m, r) => { const u = String(r.updated_at ?? '').slice(0, 10); return !m || u > m ? u : m; }, null);
  return { kind: 'rungs' as const, asOf, rungs };
}
