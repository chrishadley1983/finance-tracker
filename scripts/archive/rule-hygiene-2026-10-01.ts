/**
 * One-off rule hygiene (daily-categorisation A7c), 2026-10-01.
 *
 * The legacy rules imported from the "Life Planning V2" spreadsheet are
 * category LABELS ("Gifts", "Energy", "Restaurants"…) at confidence 1.0 —
 * above every mined merchant rule. With token-bounded matching they mostly
 * match nothing in bank data; where they do, they outrank better rules.
 *
 * - legacy label rule with no settled match since 2026-01-01 → delete
 * - legacy label rule that still matches → lower to 0.85
 * - mined `interest` rule → delete (replaced by the card-interest debit policy;
 *   interest RECEIVED is Other income)
 *
 * Prints the kept-rules.md table rows. Dry run unless --apply.
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd(), true);

const LOWERED_CONFIDENCE = 0.85;
const SINCE = '2026-01-01';

async function main() {
  const apply = process.argv.includes('--apply');
  const { supabaseAdmin } = await import('@/lib/supabase/server');
  const { getRules, ruleApplies, clearRulesCache } = await import('@/lib/categorisation/rule-matcher');
  const { logRuleEvents } = await import('@/lib/categorisation/rule-events');

  clearRulesCache();
  const rules = await getRules();
  const legacy = rules.filter((r) => !r.is_system && !r.notes && Number(r.confidence) >= 1);
  const interest = rules.filter((r) => !r.is_system && r.pattern.toLowerCase().trim() === 'interest');

  const rows: { description: string; amount: number; account_id: string }[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('description, amount, account_id')
      .gte('date', SINCE)
      .order('id', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as typeof rows));
    if ((data ?? []).length < 1000) break;
  }

  const events: Parameters<typeof logRuleEvents>[0] = [];
  const table: string[] = [];

  for (const r of [...legacy, ...interest]) {
    const isInterest = interest.includes(r);
    const matches = rows.filter((t) =>
      ruleApplies(r, { description: t.description, amount: Number(t.amount), accountId: t.account_id })
    ).length;
    const del = isInterest || matches === 0;
    const outcome = del
      ? isInterest
        ? 'deleted — replaced by policy `interest` (debit) → Service fees & bank charges'
        : `deleted — legacy spreadsheet label, 0 matches since ${SINCE}`
      : `lowered 1.0 → ${LOWERED_CONFIDENCE} — legacy label still matching ${matches} row(s) since ${SINCE}`;
    table.push(`| \`${r.pattern}\` | ${r.categories?.name ?? '?'} | ${outcome} |`);

    if (!apply) continue;
    if (del) {
      await supabaseAdmin.from('category_corrections').update({ created_rule_id: null }).eq('created_rule_id', r.id);
      const { error: e } = await supabaseAdmin.from('category_mappings').delete().eq('id', r.id);
      if (e) throw new Error(`delete ${r.pattern}: ${e.message}`);
      events.push({ ruleId: r.id, pattern: r.pattern, event: 'deleted', oldCategoryId: r.category_id, source: 'hygiene:2026-10-01', detail: { matches } });
    } else {
      const { error: e } = await supabaseAdmin
        .from('category_mappings')
        .update({ confidence: LOWERED_CONFIDENCE, notes: `legacy label; lowered from 1.0 (hygiene 2026-10-01)`, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (e) throw new Error(`lower ${r.pattern}: ${e.message}`);
      events.push({ ruleId: r.id, pattern: r.pattern, event: 'updated', oldCategoryId: r.category_id, newCategoryId: r.category_id, source: 'hygiene:2026-10-01', detail: { confidence: [1, LOWERED_CONFIDENCE], matches } });
    }
  }

  if (apply) await logRuleEvents(events);
  console.log(`${apply ? 'Applied' : 'Dry run'}: ${legacy.length} legacy label rule(s), ${interest.length} interest rule(s)\n`);
  console.log('| Pattern | Category | Outcome |\n|---|---|---|');
  console.log(table.join('\n'));
}

main().catch((e) => {
  console.error('Rule hygiene failed:', e);
  process.exit(1);
});
