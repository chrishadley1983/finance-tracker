/**
 * Shares held directly (the Accenture employee shares), valued from the holdings file at the latest price and FX
 * rate, and optionally saved as the month's snapshot for each account.
 *
 *   npm run plan:shares-value                       # print
 *   npm run plan:shares-value -- --save [--date YYYY-MM-DD] [--replace]
 *   npm run plan:shares-value -- --save --if-first  # what the scheduled bank-sync runs: only acts on the 1st
 *
 * Holdings: the `equities` block of the newest plan/observations/holdings/*.json — add a dated file when the number
 * of shares changes (vesting, ESPP purchase, sale).
 */
import { newestHoldings } from '../plan/inputs/holdings.mjs';
import { fetchQuote, valueEquities } from '../plan/inputs/equity-prices.mjs';
import { getDb } from '../plan/inputs/db';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const opt = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const gbp = (n: number) => '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  if (has('--if-first') && !today.endsWith('-01')) { console.log(`plan:shares-value: ${today} is not the 1st — nothing to do`); return; }
  const h = newestHoldings() as { file: string; data: { equities?: Record<string, Array<{ symbol: string; units: number; currency: string; fxSymbol?: string }>> } } | null;
  const eq = h?.data.equities;
  if (!eq || !Object.keys(eq).length) { console.error('no equities in the newest holdings file'); process.exitCode = 1; return; }
  const symbols = Array.from(new Set(Object.values(eq).flat().flatMap((l) => [l.symbol, ...(l.fxSymbol ? [l.fxSymbol] : [])])));
  const quotes = Object.fromEntries(await Promise.all(symbols.map(async (s) => [s, await fetchQuote(s)] as const)));
  const v = valueEquities(eq, quotes);
  if (v.missing.length) { console.error(`no price for: ${v.missing.join(', ')}`); process.exitCode = 1; return; }
  for (const acc of v.accounts) {
    console.log(acc.account);
    for (const r of acc.rows) console.log(`  ${r.symbol} ${r.units} × ${r.currency} ${r.price.toFixed(2)} ÷ ${r.fx.toFixed(4)} = ${gbp(r.value)}   (price ${r.priceTime?.slice(0, 16)})`);
    console.log(`  = RECORD THIS ${gbp(acc.total)}\n`);
  }
  if (!has('--save')) return;

  const date = opt('--date') ?? today;
  const db = await getDb();
  for (const acc of v.accounts) {
    const { data: a } = await db.from('accounts').select('id').eq('name', acc.account).single();
    if (!a) { console.error(`${acc.account}: no such account`); process.exitCode = 1; continue; }
    const balance = Math.round(acc.total * 100) / 100;
    const notes = acc.rows.map((r) => `${r.units} ${r.symbol} × ${r.currency} ${r.price.toFixed(2)} ÷ ${r.fx.toFixed(4)}`).join('; ') + ` (${h!.file}) — plan:shares-value`;
    const { data: existing } = await db.from('wealth_snapshots').select('id, balance').eq('account_id', a.id).eq('date', date);
    if (existing && existing.length) {
      if (!has('--replace')) { console.log(`${acc.account}: a snapshot already exists for ${date} (${gbp(existing[0].balance)}) — not changed; add --replace to overwrite`); continue; }
      const { error } = await db.from('wealth_snapshots').update({ balance, notes }).eq('id', existing[0].id);
      console.log(error ? error.message : `${acc.account}: ${date} replaced → ${gbp(balance)}`);
    } else {
      const { error } = await db.from('wealth_snapshots').insert({ account_id: a.id, date, balance, notes });
      console.log(error ? error.message : `${acc.account}: ${date} recorded ${gbp(balance)}`);
    }
  }
})().catch((e) => { console.error(String(e)); process.exitCode = 1; });
