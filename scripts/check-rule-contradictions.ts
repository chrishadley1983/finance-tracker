/**
 * A2 check: which rules contradict settled history?
 *
 * For every settled transaction (needs_review = false, categorised), find the
 * rule that would win for it TODAY (same matcher the engine uses). A rule is
 * contradicted when it wins for a row whose settled category differs.
 * Every contradicted rule must be listed in
 * Docs/features/daily-categorisation/kept-rules.md with a reason; anything
 * unlisted fails the check (exit 1).
 *
 * Run:  npm run rules:check   (add --all to print listed rules too)
 */
import { loadEnvConfig } from '@next/env';
import fs from 'node:fs';
import path from 'node:path';

loadEnvConfig(process.cwd(), true);

const KEPT_RULES = path.join(process.cwd(), 'Docs/features/daily-categorisation/kept-rules.md');

function listedPatterns(): Set<string> {
  if (!fs.existsSync(KEPT_RULES)) return new Set();
  const text = fs.readFileSync(KEPT_RULES, 'utf8');
  const out = new Set<string>();
  for (const m of Array.from(text.matchAll(/^\|\s*`([^`]+)`/gm))) out.add(m[1].toLowerCase().trim());
  return out;
}

async function main() {
  const showAll = process.argv.includes('--all');
  const { supabaseAdmin } = await import('@/lib/supabase/server');
  const { getRules, selectRule, clearRulesCache } = await import('@/lib/categorisation/rule-matcher');

  clearRulesCache();
  const rules = await getRules();
  const { data: cats } = await supabaseAdmin.from('categories').select('id, name');
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));

  const rows: { description: string; amount: number; account_id: string; category_id: string }[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('description, amount, account_id, category_id')
      .eq('needs_review', false)
      .not('category_id', 'is', null)
      .order('id', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as typeof rows));
    if ((data ?? []).length < 1000) break;
  }

  const byRule = new Map<string, { pattern: string; category: string; wins: number; disagree: number; actual: Map<string, number> }>();
  for (const r of rows) {
    const win = selectRule(rules, { description: r.description, amount: Number(r.amount), accountId: r.account_id });
    if (!win || win.action === 'ask') continue;
    const s = byRule.get(win.ruleId) ?? { pattern: win.pattern, category: win.categoryName, wins: 0, disagree: 0, actual: new Map() };
    s.wins++;
    if (win.categoryId !== r.category_id) {
      s.disagree++;
      const n = catName.get(r.category_id) ?? r.category_id;
      s.actual.set(n, (s.actual.get(n) ?? 0) + 1);
    }
    byRule.set(win.ruleId, s);
  }

  const listed = listedPatterns();
  const contradicted = Array.from(byRule.values())
    .filter((s) => s.disagree > 0)
    .sort((a, b) => b.disagree - a.disagree);
  const unlisted = contradicted.filter((s) => !listed.has(s.pattern.toLowerCase().trim()));

  console.log(`Settled rows: ${rows.length}; rules winning ≥1 row: ${byRule.size}; contradicted: ${contradicted.length}; unlisted: ${unlisted.length}`);
  for (const s of showAll ? contradicted : unlisted) {
    const actual = Array.from(s.actual.entries()).map(([n, c]) => `${n}×${c}`).join(', ');
    const tag = listed.has(s.pattern.toLowerCase().trim()) ? 'kept' : 'UNLISTED';
    console.log(`  [${tag}] \`${s.pattern}\` → ${s.category}: ${s.disagree}/${s.wins} disagree (${actual})`);
  }
  process.exit(unlisted.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Rule check failed:', e);
  process.exit(1);
});
