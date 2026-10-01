/**
 * Learning stats (A10) — is the engine actually learning?
 *
 * Correction rate = auto-categorised rows (engine set the category) that Chris
 * later corrected ÷ auto-categorised rows, by engine source, for rows created
 * in the window. Compared with the previous window of the same length, plus
 * rule changes and the most-corrected merchants.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { merchantKey } from './normalise';

/** Engine sources where the engine (not Chris) chose the category. `policy_ask` rows are questions, not auto. */
export const AUTO_SOURCES = ['policy', 'rule_exact', 'rule_pattern', 'merchant_rule', 'similar', 'ai'] as const;

export interface SourceStats {
  auto: number;
  corrected: number;
  rate: number | null;
}

export interface WindowStats extends SourceStats {
  from: string;
  to: string;
  bySource: Record<string, SourceStats>;
}

export interface LearningStats {
  days: number;
  current: WindowStats;
  previous: WindowStats;
  rules: { created: number; repointed: number; deleted: number; updated: number };
  reviewQueue: number;
  topCorrectedMerchants: { merchant: string; corrections: number; toCategory: string | null }[];
}

export interface StatsRow {
  id: string;
  engine_source: string | null;
  created_at: string;
}

function rate(corrected: number, auto: number): number | null {
  return auto > 0 ? Math.round((corrected / auto) * 1000) / 1000 : null;
}

/** Pure: correction stats for rows in [from, to). */
export function computeWindowStats(
  rows: StatsRow[],
  correctedIds: Set<string>,
  from: string,
  to: string
): WindowStats {
  const bySource: Record<string, SourceStats> = {};
  let auto = 0;
  let corrected = 0;
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  for (const r of rows) {
    const t = Date.parse(r.created_at);
    if (!(t >= fromMs && t < toMs)) continue;
    const src = r.engine_source ?? '';
    if (!(AUTO_SOURCES as readonly string[]).includes(src)) continue;
    const s = (bySource[src] ??= { auto: 0, corrected: 0, rate: null });
    s.auto++;
    auto++;
    if (correctedIds.has(r.id)) {
      s.corrected++;
      corrected++;
    }
  }
  for (const s of Object.values(bySource)) s.rate = rate(s.corrected, s.auto);
  return { from, to, auto, corrected, rate: rate(corrected, auto), bySource };
}

/** Pure: most-corrected merchants, newest correction's target category. */
export function topCorrectedMerchants(
  corrections: { description: string; created_at: string; to_category: string | null }[],
  limit = 5
): LearningStats['topCorrectedMerchants'] {
  const byMerchant = new Map<string, { n: number; latest: string; to: string | null }>();
  for (const c of corrections) {
    const key = merchantKey(c.description) || c.description.toLowerCase();
    const cur = byMerchant.get(key);
    if (!cur) byMerchant.set(key, { n: 1, latest: c.created_at, to: c.to_category });
    else {
      cur.n++;
      if (c.created_at > cur.latest) {
        cur.latest = c.created_at;
        cur.to = c.to_category;
      }
    }
  }
  return Array.from(byMerchant.entries())
    .sort((a, b) => b[1].n - a[1].n || b[1].latest.localeCompare(a[1].latest))
    .slice(0, limit)
    .map(([merchant, v]) => ({ merchant, corrections: v.n, toCategory: v.to }));
}

const PAGE = 1000;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

export async function getLearningStats(days = 30, now: Date = new Date()): Promise<LearningStats> {
  const to = now.toISOString();
  const mid = new Date(now.getTime() - days * 86_400_000).toISOString();
  const from = new Date(now.getTime() - 2 * days * 86_400_000).toISOString();

  const rows = await fetchAll<StatsRow>((a, b) =>
    supabaseAdmin
      .from('transactions')
      .select('id, engine_source, created_at')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('id', { ascending: true })
      .range(a, b)
  );

  // Corrections linked to rows in the 2-window span (a correction can be made
  // any time after the row was created, so don't bound correction dates).
  const ids = rows.map((r) => r.id);
  const correctedIds = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from('category_corrections')
      .select('transaction_id')
      .in('transaction_id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const c of data ?? []) if (c.transaction_id) correctedIds.add(c.transaction_id);
  }

  const [{ data: events, error: evErr }, { count: queue, error: qErr }, { data: recent, error: rcErr }] =
    await Promise.all([
      supabaseAdmin.from('category_rule_events').select('event').gte('created_at', mid).lt('created_at', to),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('needs_review', true),
      supabaseAdmin
        .from('category_corrections')
        .select('description, created_at, corrected_category:corrected_category_id(name)')
        .gte('created_at', mid)
        .lt('created_at', to),
    ]);
  if (evErr || qErr || rcErr) throw new Error((evErr ?? qErr ?? rcErr)!.message);

  const ruleCounts = { created: 0, repointed: 0, deleted: 0, updated: 0 };
  for (const e of events ?? []) {
    if (e.event in ruleCounts) ruleCounts[e.event as keyof typeof ruleCounts]++;
  }

  return {
    days,
    current: computeWindowStats(rows, correctedIds, mid, to),
    previous: computeWindowStats(rows, correctedIds, from, mid),
    rules: ruleCounts,
    reviewQueue: queue ?? 0,
    topCorrectedMerchants: topCorrectedMerchants(
      ((recent ?? []) as unknown as { description: string; created_at: string | null; corrected_category: { name: string } | null }[]).map(
        (c) => ({ description: c.description, created_at: c.created_at ?? '', to_category: c.corrected_category?.name ?? null })
      )
    ),
  };
}
