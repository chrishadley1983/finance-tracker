/**
 * npm run side-income — Chris's side-trade receipts (Micro1 / Deel, Prolific, Mercor, …) from the
 * finance tracker, grouped by UK tax quarter and payer, for the MTD for Income Tax quarterly
 * update of the second self-employment. Source of truth is finance.transactions; the payer
 * classification is plan/inputs/observe.mjs#classifyIncomeSource ('chrisSideIncome').
 *
 *   npm run side-income                  # every quarter with receipts
 *   npm run side-income -- --from 2026-04-06
 *
 * Quarters: 6 Apr–5 Jul (update due 7 Aug), 6 Jul–5 Oct (7 Nov), 6 Oct–5 Jan (7 Feb), 6 Jan–5 Apr (7 May).
 * Gross receipts in GBP as they landed (after Deel/FX fees) — there are no expenses on this trade;
 * if that changes, record them against the same trade in QuickFile.
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd(), true);
import { createClient } from '@supabase/supabase-js';
import { classifyIncomeSource } from '../plan/inputs/observe.mjs';

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const from = opt('from') ?? '2026-04-06';

/** UK tax quarter containing an ISO date: returns { label, start, end, due } */
function taxQuarter(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  const afterCut = (mm: number) => m > mm || (m === mm && day >= 6);
  let startYear = y, q: number;
  if (afterCut(4) && !afterCut(7)) q = 1; else if (afterCut(7) && !afterCut(10)) q = 2; else if (afterCut(10)) q = 3; else if (!afterCut(1)) { q = 3; startYear = y - 1; } else { q = 4; startYear = y - 1; }
  const starts = [['04-06', '07-05', '08-07'], ['07-06', '10-05', '11-07'], ['10-06', '01-05', '02-07'], ['01-06', '04-05', '05-07']][q - 1];
  const sy = startYear, ey = q >= 3 ? startYear + 1 : startYear;
  return { label: `${sy}/${String(sy + 1).slice(2)} Q${q}`, start: `${q === 4 ? sy + 1 : sy}-${starts[0]}`, end: `${ey}-${starts[1]}`, due: `${q >= 3 ? sy + 1 : sy}-${starts[2]}` };
}

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: 'finance' } });
  const rows: Array<{ date: string; amount: number; description: string; accounts: { name: string } | null; categories: { name: string } | null }> = [];
  for (let fromRow = 0; ; fromRow += 1000) {
    const { data, error } = await sb.from('transactions').select('date,amount,description,accounts(name),categories(name)').gte('date', from).gt('amount', 0).order('date').range(fromRow, fromRow + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const side = rows.filter((t) => classifyIncomeSource({ description: t.description, category: t.categories?.name ?? null, account: t.accounts?.name ?? null, amount: t.amount }) === 'chrisSideIncome');
  const byQ = new Map<string, { q: ReturnType<typeof taxQuarter>; total: number; byPayer: Map<string, number>; lines: typeof side }>();
  for (const t of side) {
    const q = taxQuarter(t.date);
    const e = byQ.get(q.label) ?? { q, total: 0, byPayer: new Map(), lines: [] as typeof side };
    const payer = /MICRO1|DEEL/i.test(t.description) ? 'Micro1 (via Deel)' : /PROLIFIC/i.test(t.description) ? 'Prolific' : /MERCOR/i.test(t.description) ? 'Mercor' : /RESPONDENT/i.test(t.description) ? 'Respondent' : /USER INTERVIEWS/i.test(t.description) ? 'User Interviews' : /PEOPLE FOR RESEARC/i.test(t.description) ? 'People for Research' : t.description;
    e.total += t.amount; e.byPayer.set(payer, (e.byPayer.get(payer) ?? 0) + t.amount); e.lines.push(t);
    byQ.set(q.label, e);
  }
  if (!byQ.size) { console.log(`no side-income receipts since ${from}`); return; }
  const gbp = (n: number) => '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (const [label, e] of Array.from(byQ.entries()).sort()) {
    console.log(`\n${label}  (${e.q.start} → ${e.q.end}; MTD update due ${e.q.due})  total ${gbp(e.total)}`);
    for (const [p, v] of Array.from(e.byPayer.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${p.padEnd(22)} ${gbp(v).padStart(12)}`);
    for (const t of e.lines) console.log(`    ${t.date}  ${gbp(t.amount).padStart(11)}  ${t.description}  [${t.accounts?.name ?? ''}]`);
  }
  const ty = Array.from(byQ.values()).reduce((s, e) => s + e.total, 0);
  console.log(`\nall quarters shown: ${gbp(ty)} gross (${side.length} receipts). Tax set-aside at 30%: ${gbp(ty * 0.3)}.`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
