/**
 * True value of the gilt holdings, and (optionally) the month's wealth snapshot for each account.
 *
 *   npm run plan:gilt-value                                    # live prices → gilts at true value per account
 *   npm run plan:gilt-value -- --other "CH ISA=551.47" --other "Chris II SIPP Pension=49700.16"
 *                                                              # + everything else in the account → the total to record
 *   npm run plan:gilt-value -- --other … --save [--date 2026-10-01] [--replace]
 *                                                              # writes wealth_snapshots (refuses an existing date
 *                                                              # unless --replace; refuses an account with no --other)
 *   --offline                                                  # newest saved prices instead of the live feed
 *
 * "--other" is the cash plus any fund holdings in that account, exactly as the platform shows them — the platform
 * values those correctly. Do NOT pass the platform's account total: it values index-linked gilts at the clean price
 * with no inflation uplift (ii understated Chris's ISA gilts by ~£87k and SIPP gilts by ~£148k on 1 Oct 2026).
 */
import { getGiltPrices } from '../plan/inputs/gilt-prices.mjs';
import { newestHoldings, valueHoldings } from '../plan/inputs/holdings.mjs';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const opt = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const others: Record<string, number> = {};
args.forEach((a, i) => {
  if (a !== '--other') return;
  const m = /^(.+)=\s*£?([\d,.]+)$/.exec(args[i + 1] ?? '');
  if (!m) throw new Error(`--other expects "Account name=amount", got ${args[i + 1]}`);
  others[m[1].trim()] = Number(m[2].replace(/,/g, ''));
});
const gbp = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');

(async () => {
  const h = newestHoldings();
  if (!h) { console.error('no holdings file in plan/observations/holdings'); process.exitCode = 1; return; }
  const prices = await getGiltPrices({ offline: has('--offline'), log: (m: string) => console.error(m) });
  const unknown = Object.keys(others).filter((k) => !(k in h.data.accounts));
  if (unknown.length) { console.error(`--other names no account in ${h.file}: ${unknown.join(', ')} (accounts: ${Object.keys(h.data.accounts).join(', ')})`); process.exitCode = 1; return; }
  const v = valueHoldings(h.data.accounts, prices.gilts, others);
  console.log(`Gilt holdings ${h.file} · prices ${prices.asOf}${prices.live ? ' (live, ~15-min delay)' : ' (saved file)'}\n`);
  for (const acc of v.accounts) {
    console.log(acc.account);
    for (const r of acc.rows) console.log(`  ${r.epic.padEnd(5)} ${r.units.toLocaleString('en-GB', { minimumFractionDigits: 2 }).padStart(11)} units × ${r.dirty.toFixed(2).padStart(7)} dirty = ${gbp(r.value).padStart(9)}   (index ratio ${r.indexRatio.toFixed(3)})`);
    console.log(`  gilts, true value      ${gbp(acc.gilts).padStart(9)}   (a clean-price screen like ii's shows about ${gbp(acc.cleanOnly)})`);
    if (acc.total !== null) console.log(`  + cash and funds       ${gbp(acc.other ?? 0).padStart(9)}\n  = RECORD THIS          ${gbp(acc.total).padStart(9)}`);
    else console.log(`  + add the account's cash and fund lines (not the platform total): --other "${acc.account}=…"`);
    console.log('');
  }
  if (v.missing.length) { console.error(`no price for: ${v.missing.join(', ')}`); process.exitCode = 1; return; }
  if (!has('--save')) return;

  const date = opt('--date') ?? new Date().toISOString().slice(0, 10);
  const pending = v.accounts.filter((a) => a.total === null).map((a) => a.account);
  if (pending.length) { console.error(`--save needs --other for every account (missing: ${pending.join(', ')})`); process.exitCode = 1; return; }
  const { getDb } = await import('../plan/inputs/db');
  const db = await getDb();
  for (const acc of v.accounts) {
    const { data: a, error: e1 } = await db.from('accounts').select('id').eq('name', acc.account).single();
    if (e1 || !a) { console.error(`${acc.account}: no such account in finance.accounts`); process.exitCode = 1; continue; }
    const balance = Math.round((acc.total as number) * 100) / 100;
    const notes = `gilts ${gbp(acc.gilts)} at units × dirty (${h.file}, prices ${prices.asOf.slice(0, 16)}) + cash/funds ${gbp(acc.other ?? 0)} — plan:gilt-value`;
    const { data: existing } = await db.from('wealth_snapshots').select('id, balance').eq('account_id', a.id).eq('date', date);
    if (existing && existing.length) {
      if (!has('--replace')) { console.error(`${acc.account}: a snapshot already exists for ${date} (${existing.map((x: { balance: number }) => gbp(x.balance)).join(', ')}) — not changed; add --replace to overwrite`); process.exitCode = 1; continue; }
      if (existing.length > 1) { console.error(`${acc.account}: ${existing.length} snapshots on ${date} — resolve the duplicates first`); process.exitCode = 1; continue; }
      const { error } = await db.from('wealth_snapshots').update({ balance, notes }).eq('id', existing[0].id);
      console.log(error ? `${acc.account}: ${error.message}` : `${acc.account}: ${date} replaced ${gbp(existing[0].balance)} → ${gbp(balance)}`);
    } else {
      const { error } = await db.from('wealth_snapshots').insert({ account_id: a.id, date, balance, notes });
      console.log(error ? `${acc.account}: ${error.message}` : `${acc.account}: ${date} recorded ${gbp(balance)}`);
    }
  }
})();
