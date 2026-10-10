/**
 * Business Stock: the unsold Hadley Bricks inventory, valued from the inventory database (same Supabase project,
 * public schema) with the rules in plan/assumptions.json (stock.*), and optionally saved as the month's snapshot.
 *
 *   npm run plan:stock-value                       # print the valuation
 *   npm run plan:stock-value -- --save [--date YYYY-MM-DD] [--replace]
 *   npm run plan:stock-value -- --save --if-first  # what the scheduled bank-sync runs: only acts on the 1st
 *
 * Writes finance.wealth_snapshots for the 'Business Stock' account; refuses an existing date unless --replace.
 */
import { readAssumptionsFile } from '../plan/inputs/assumptions.mjs';
import { valueStock } from '../plan/inputs/stock.mjs';
import { getDb } from '../plan/inputs/db';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const opt = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const gbp = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');
const ACCOUNT = 'Business Stock';

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  if (has('--if-first') && !today.endsWith('-01')) { console.log(`plan:stock-value: ${today} is not the 1st — nothing to do`); return; }
  const a = (await readAssumptionsFile(undefined)).values as { stock: Parameters<typeof valueStock>[0] };
  const db = await getDb();
  const pub = db.schema('public' as never) as unknown as typeof db;
  const items: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (pub as any).from('inventory_items').select('status,cost,listing_value,storage_location').in('status', a.stock.inStockStatuses).range(from, from + 999);
    if (error) throw new Error(`inventory_items: ${error.message}`);
    items.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const { data: uploads, error: e2 } = await (pub as any).from('bricklink_uploads').select('remaining_price,remaining_quantity').gt('remaining_quantity', 0);
  if (e2) throw new Error(`bricklink_uploads: ${e2.message}`);
  const v = valueStock(a.stock, items as never, uploads ?? []);

  console.log(`Business Stock — rules: ${a.stock.listedStatus} at list less ${(a.stock.listedFeeRate * 100).toFixed(0)}%, other in-stock at cost, BrickLink parts at ${(a.stock.partsShareOfList * 100).toFixed(0)}% of list\n`);
  for (const [s, x] of Object.entries(v.byStatus)) console.log(`  ${s.padEnd(17)} ${String(x.units).padStart(5)} units   cost ${gbp(x.cost).padStart(8)}   list ${gbp(x.list).padStart(8)}   → ${gbp(x.value).padStart(8)}${x.noCost ? `   (${x.noCost} with no cost)` : ''}`);
  console.log(`  ${'BrickLink parts'.padEnd(17)} ${String(v.parts.uploads).padStart(5)} lots    list ${gbp(v.parts.list).padStart(8)}                    → ${gbp(v.parts.value).padStart(8)}`);
  console.log(`  excluded: ${v.excluded.units} backlog units already moved to BrickLink (cost ${gbp(v.excluded.cost)})`);
  console.log(`\n  = RECORD THIS ${gbp(v.total)}`);
  if (!has('--save')) return;

  const date = opt('--date') ?? today;
  const { data: acc } = await db.from('accounts').select('id').eq('name', ACCOUNT).single();
  if (!acc) { console.error(`no '${ACCOUNT}' account in finance.accounts`); process.exitCode = 1; return; }
  const balance = Math.round(v.total * 100) / 100;
  const parts = Object.entries(v.byStatus).map(([s, x]) => `${s.toLowerCase()} ${gbp(x.value)}`).join(', ');
  const notes = `${parts}, BrickLink parts ${gbp(v.parts.value)} (listed at list −${(a.stock.listedFeeRate * 100).toFixed(0)}%, others at cost, parts ${(a.stock.partsShareOfList * 100).toFixed(0)}% of list) — plan:stock-value`;
  const { data: existing } = await db.from('wealth_snapshots').select('id, balance').eq('account_id', acc.id).eq('date', date);
  if (existing && existing.length) {
    if (!has('--replace')) { console.error(`${ACCOUNT}: a snapshot already exists for ${date} (${existing.map((x) => gbp(x.balance)).join(', ')}) — not changed; add --replace to overwrite`); process.exitCode = has('--if-first') ? 0 : 1; return; }
    if (existing.length > 1) { console.error(`${ACCOUNT}: ${existing.length} snapshots on ${date} — resolve the duplicates first`); process.exitCode = 1; return; }
    const { error } = await db.from('wealth_snapshots').update({ balance, notes }).eq('id', existing[0].id);
    console.log(error ? error.message : `${ACCOUNT}: ${date} replaced ${gbp(existing[0].balance)} → ${gbp(balance)}`);
  } else {
    const { error } = await db.from('wealth_snapshots').insert({ account_id: acc.id, date, balance, notes });
    console.log(error ? error.message : `${ACCOUNT}: ${date} recorded ${gbp(balance)}`);
  }
})().catch((e) => { console.error(String(e)); process.exitCode = 1; });
