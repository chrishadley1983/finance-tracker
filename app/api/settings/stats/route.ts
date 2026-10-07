import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import pkg from '@/package.json';

export const dynamic = 'force-dynamic';

/** Tables counted on the Settings page, in display order. */
const STAT_TABLES = [
  ['transactions', 'transactions'],
  ['accounts', 'accounts'],
  ['categories', 'categories'],
  ['rules', 'category_mappings'],
  ['budgets', 'budgets'],
  ['snapshots', 'wealth_snapshots'],
  ['subscriptions', 'subscriptions'],
] as const;

export type StatKey = (typeof STAT_TABLES)[number][0];

export interface SettingsStats {
  counts: Record<StatKey, number>;
  transactions: { first: string | null; last: string | null };
  about: { version: string; commit: string | null; environment: string | null };
}

type CountResult = { count: number | null; error: { message: string } | null };

/** GET /api/settings/stats: row counts (head-only queries) and app info. */
export async function GET() {
  try {
    const results = await Promise.all(
      STAT_TABLES.map(([, table]) =>
        supabaseAdmin.from(table).select('id', { count: 'exact', head: true }) as unknown as PromiseLike<CountResult>
      )
    );
    const counts = {} as Record<StatKey, number>;
    results.forEach((r, i) => {
      if (r.error) throw new Error(r.error.message);
      counts[STAT_TABLES[i][0]] = r.count ?? 0;
    });

    const [first, last] = await Promise.all([
      supabaseAdmin.from('transactions').select('date').order('date', { ascending: true }).limit(1),
      supabaseAdmin.from('transactions').select('date').order('date', { ascending: false }).limit(1),
    ]);
    if (first.error) throw new Error(first.error.message);
    if (last.error) throw new Error(last.error.message);

    const body: SettingsStats = {
      counts,
      transactions: { first: first.data?.[0]?.date ?? null, last: last.data?.[0]?.date ?? null },
      about: {
        version: pkg.version,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        environment: process.env.VERCEL_ENV ?? null,
      },
    };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (error) {
    console.error('GET /api/settings/stats error:', error);
    return NextResponse.json({ error: 'Failed to load data counts' }, { status: 500 });
  }
}
