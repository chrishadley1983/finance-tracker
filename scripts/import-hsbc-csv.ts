/**
 * Import an HSBC "TransactionHistory" CSV into a finance-tracker account,
 * reusing the app's real count-based, edit-immune dedup (planImportWithKeys
 * keyed on each existing row's ORIGINAL import hash). Booked transactions only
 * — HSBC's history export never contains pending rows, so nothing to filter.
 *
 *   npx tsx scripts/import-hsbc-csv.ts <csvPath> <accountId> [--apply]
 *
 * Without --apply it's a DRY RUN: reports what would insert/skip, inserts
 * nothing. With --apply it inserts new rows (needs_review=true, uncategorised)
 * and writes their import-hash audit rows.
 *
 * Env is loaded from .env.local before the Supabase client module is imported.
 */
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import crypto from 'crypto';
config({ path: '.env.local' });

interface Row { rowNumber: number; date: string; amount: number; description: string; raw: string; }

function parseHsbcCsv(path: string): Row[] {
  const text = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: Row[] = [];
  let rowNumber = 0;
  for (const line of lines) {
    // Fields: date,description,amount. The amount is the trailing numeric field
    // and may be QUOTED with a thousands separator, e.g. "1,168.98" or "-1,016.50",
    // so a naive last-comma split breaks it. Anchor the amount at end of line.
    // Amount is either fully quoted (with a thousands comma) e.g. "1,168.98"
    // / "-1,016.50", or unquoted with no comma e.g. -115.00. Strict alternation
    // stops the engine splitting inside a quoted number.
    const m = line.match(/^(\d{2})\/(\d{2})\/(\d{4}),(.+),("-?[\d,]+\.\d{2}"|-?\d+\.\d{2})$/);
    if (!m) continue; // header / non-data / malformed
    const date = `${m[3]}-${m[2]}-${m[1]}`;
    const description = m[4].trim();
    const amount = Number(m[5].replace(/["',\s]/g, ''));
    if (!Number.isFinite(amount)) continue;
    rowNumber += 1;
    rows.push({ rowNumber, date, amount, description, raw: line });
  }
  return rows;
}

async function main() {
  const [csvPath, accountId] = process.argv.slice(2);
  const apply = process.argv.includes('--apply');
  if (!csvPath || !accountId) {
    console.error('Usage: tsx scripts/import-hsbc-csv.ts <csvPath> <accountId> [--apply]');
    process.exit(1);
  }

  const { tupleKey, planImportWithKeys } = await import('../lib/import/dedup');
  const { supabaseAdmin } = await import('../lib/supabase/server');
  const hashFor = (date: string, amount: number, description: string) =>
    crypto.createHash('sha256').update(tupleKey(date, amount, description)).digest('hex');

  const incoming = parseHsbcCsv(csvPath);
  if (incoming.length === 0) { console.error('No rows parsed.'); process.exit(1); }

  const minDate = incoming.reduce((a, r) => (r.date < a ? r.date : a), incoming[0].date);
  const maxDate = incoming.reduce((a, r) => (r.date > a ? r.date : a), incoming[0].date);

  // Existing DB rows in range + their original import hashes.
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('transactions')
    .select('id, date, amount, description')
    .eq('account_id', accountId)
    .gte('date', minDate)
    .lte('date', maxDate);
  if (exErr) { console.error('Failed to fetch existing rows:', exErr.message); process.exit(1); }

  const hashById = new Map<string, string>();
  const ids = (existing || []).map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) {
    const { data: hrows } = await supabaseAdmin
      .from('imported_transaction_hashes')
      .select('transaction_id, hash')
      .in('transaction_id', ids.slice(i, i + 500));
    for (const h of hrows || []) if (!hashById.has(h.transaction_id)) hashById.set(h.transaction_id, h.hash);
  }

  const existingKeys = (existing || []).map(
    (r) => hashById.get(r.id) ?? hashFor(r.date, Number(r.amount), r.description),
  );
  const incomingKeyOf = (t: Row) => hashFor(t.date, t.amount, t.description);
  const { toInsert, toSkip } = planImportWithKeys(incoming, incomingKeyOf, existingKeys);

  console.log(`\nFile: ${csvPath}`);
  console.log(`Account: ${accountId}`);
  console.log(`Range: ${minDate} .. ${maxDate}`);
  console.log(`Parsed: ${incoming.length} | existing in range: ${existing?.length ?? 0}`);
  console.log(`Would INSERT: ${toInsert.length} | SKIP (dup): ${toSkip.length}`);
  if (toInsert.length) {
    console.log('--- to insert ---');
    for (const t of toInsert) console.log(`  ${t.date}  ${t.amount.toFixed(2).padStart(10)}  ${t.description.slice(0, 48)}`);
  }

  if (!apply) { console.log('\nDRY RUN — nothing inserted. Re-run with --apply to commit.'); return; }

  let inserted = 0;
  for (const t of toInsert) {
    const { data: newTx, error: insErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        account_id: accountId, date: t.date, amount: t.amount, description: t.description,
        category_id: null, categorisation_source: 'import', needs_review: true,
      })
      .select('id').single();
    if (insErr) { console.error(`  insert failed (${t.date} ${t.amount}): ${insErr.message}`); continue; }
    await supabaseAdmin.from('imported_transaction_hashes').insert({
      transaction_id: newTx.id, hash: hashFor(t.date, t.amount, t.description),
      import_session_id: null, source_row: { Column1: t.date, Column2: t.description, Column3: String(t.amount) },
    });
    inserted += 1;
  }
  console.log(`\nAPPLIED — inserted ${inserted} of ${toInsert.length}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
