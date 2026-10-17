/**
 * One-off re-file for the Tax set-aside category (Chris, 2026-10-17).
 *
 * Re-files ONLY rows the tax policies in lib/categorisation/policies.ts apply to
 * (tax-pot transfers on the joint account, HMRC Self Assessment debits), using
 * the same matcher as the engine, so it agrees with what new rows will get:
 *
 *   - joint → tax pot (401923 91248553) debits      → Tax set-aside
 *   - tax pot → joint credits                        → Transfers
 *   - HMRC SELF AS… debits from a tracked account    → Tax set-aside
 *
 * Expected on 2026-10-17 (dry run lists the live set):
 *   e688ef34-c1da-4072-9aa2-9f0c82faadfa  2026-10-06  -600.00  401923 91248553 INTERNET TRANSFER  Transfers → Tax set-aside
 *   3f83046d-1b9c-40fd-abd2-1a86aafde0f3  2025-04-13  -200.86  HMRC SELF AS SHIP 2932993074K      Service fees & bank charges → Tax set-aside
 *   plus the £2,000 joint → pot transfer of 17 Oct 2026 once the bank sync has imported it.
 *
 * Rows are marked manual + validated so recategorise never moves them back.
 * Settled history outside these patterns is not touched.
 *
 * Prereqs: supabase/migrations/012_tax_set_aside_category.sql applied, then `npm run policies:sync`.
 * Run:  npx tsx scripts/refile-tax-set-aside.ts            (dry run)
 *       npx tsx scripts/refile-tax-set-aside.ts --apply    (writes)
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd(), true);

const TAX_POLICY_KEYS = ['tax-pot-in', 'tax-pot-out', 'hmrc-self-assessment', 'hmrc-self-assessment-long'];

async function main() {
  const apply = process.argv.includes('--apply');
  const { supabaseAdmin } = await import('@/lib/supabase/server');
  const { POLICIES } = await import('@/lib/categorisation/policies');
  const { policyRow } = await import('@/lib/categorisation/policy-sync');
  const { ruleApplies, conditionCount } = await import('@/lib/categorisation/rule-matcher');

  const [{ data: cats, error: catErr }, { data: accts, error: acctErr }] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name'),
    supabaseAdmin.from('accounts').select('id, name'),
  ]);
  if (catErr || acctErr) throw new Error((catErr ?? acctErr)!.message);
  const categoryIdByName = new Map((cats ?? []).map((c) => [c.name as string, c.id as string]));
  const categoryNameById = new Map((cats ?? []).map((c) => [c.id as string, c.name as string]));
  const accountIdByName = new Map((accts ?? []).map((a) => [a.name as string, a.id as string]));
  if (!categoryIdByName.has('Tax set-aside')) {
    throw new Error('Category "Tax set-aside" does not exist — apply supabase/migrations/012_tax_set_aside_category.sql first');
  }

  const defs = POLICIES.filter((p) => TAX_POLICY_KEYS.includes(p.key));
  if (defs.length !== TAX_POLICY_KEYS.length) throw new Error('tax policies missing from policies.ts');
  const rules = defs.map((p) => {
    const row = policyRow(p, categoryIdByName, accountIdByName);
    return { id: `policy:${p.key}`, ...row, categories: { id: row.category_id, name: p.categoryName } } as Parameters<typeof ruleApplies>[0];
  });

  const { data: candidates, error } = await supabaseAdmin
    .from('transactions')
    .select('id, date, amount, description, account_id, category_id, categorisation_source')
    .or('description.ilike.%91248553%,description.ilike.%hmrc self as%')
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);

  let changed = 0;
  for (const t of candidates ?? []) {
    const ctx = { description: t.description, amount: Number(t.amount), accountId: t.account_id, date: t.date };
    const hits = rules.filter((r) => ruleApplies(r, ctx));
    if (!hits.length) {
      console.log(`skip  ${t.id}  ${t.date}  ${Number(t.amount).toFixed(2)}  ${t.description}  (no tax policy applies)`);
      continue;
    }
    hits.sort((a, b) => conditionCount(b) - conditionCount(a));
    const target = hits[0].category_id;
    const from = categoryNameById.get(t.category_id ?? '') ?? '(none)';
    const to = categoryNameById.get(target)!;
    if (t.category_id === target) {
      console.log(`ok    ${t.id}  ${t.date}  ${Number(t.amount).toFixed(2)}  ${t.description}  already ${to}`);
      continue;
    }
    changed++;
    console.log(`${apply ? 'FILE ' : 'would'} ${t.id}  ${t.date}  ${Number(t.amount).toFixed(2)}  ${t.description}  ${from} → ${to}`);
    if (!apply) continue;
    const q = supabaseAdmin
      .from('transactions')
      .update({ category_id: target, categorisation_source: 'manual', needs_review: false, is_validated: true })
      .eq('id', t.id);
    // don't clobber a concurrent change
    const { error: upErr } = await (t.category_id ? q.eq('category_id', t.category_id) : q.is('category_id', null));
    if (upErr) throw new Error(`update ${t.id}: ${upErr.message}`);
  }
  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${changed} row(s) ${apply ? 're-filed' : 'would be re-filed'}.`);
}

main().catch((e) => {
  console.error('Re-file failed:', e);
  process.exit(1);
});
