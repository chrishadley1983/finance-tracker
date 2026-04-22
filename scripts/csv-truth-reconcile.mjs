#!/usr/bin/env node
/**
 * CSV-truth reconciliation utility.
 *
 * For a given account and one or more bank CSVs, the rule is:
 * within the date range [min_csv_date, max_csv_date], the CSV is the source
 * of truth. For every (date, normalised_description, amount) tuple:
 *
 *   expected = count in CSV
 *   actual   = count in DB
 *   if actual > expected  -> delete the newest (actual - expected) rows
 *   if actual < expected  -> report as MISSING (does not auto-insert)
 *   if tuple not in CSV   -> report as EXTRA   (does not auto-delete)
 *
 * This is the workhorse for recovering from a bad import: it's idempotent,
 * respects legitimate same-day duplicates (two TFL fares of £8.80 both
 * insert), and only deletes rows whose existence the CSV contradicts.
 *
 * Defaults to dry-run. Pass --write to execute. Before deletes, writes a
 * JSON backup of the affected rows to scripts/backups/.
 *
 * Expected CSV format (HSBC "Download transactions" shape):
 *   headerless, three columns: DD/MM/YYYY, description, amount
 *   e.g. "21/04/2026,IKEA LTD SHOP ONLINE   LONDON        GBR,-255.00"
 *
 * Usage:
 *   node scripts/csv-truth-reconcile.mjs \
 *     --account <uuid> \
 *     --csv <path>  [--csv <path> ...] \
 *     [--snapshot-date YYYY-MM-DD --snapshot-balance <n> --live <n>] \
 *     [--write]
 *
 * Balance validation (all three flags required) computes:
 *   snapshot_balance + SUM(tx.amount where tx.date >= snapshot_date)
 * and compares against --live. Useful for confirming the reconcile closed
 * the drift.
 */

import fs from 'fs';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { csvs: [], write: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--account': args.account = next(); break;
      case '--csv': args.csvs.push(next()); break;
      case '--snapshot-date': args.snapshotDate = next(); break;
      case '--snapshot-balance': args.snapshotBalance = Number(next()); break;
      case '--live': args.live = Number(next()); break;
      case '--write': args.write = true; break;
      case '-h':
      case '--help': args.help = true; break;
      default:
        console.error(`Unknown argument: ${a}`);
        args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`CSV-truth reconciliation utility

Usage:
  node scripts/csv-truth-reconcile.mjs --account <uuid> --csv <path> [--csv <path>...] [options]

Required:
  --account <uuid>          Supabase account ID to reconcile
  --csv <path>              HSBC-style headerless CSV (DD/MM/YYYY,desc,amount)
                            Repeat the flag to pass multiple files.

Optional balance check (all three required together):
  --snapshot-date <date>    ISO date (YYYY-MM-DD) of the anchor balance
  --snapshot-balance <n>    Known balance on that date
  --live <n>                Current bank-reported balance to compare against

Execution:
  --write                   Execute deletes (default: dry-run)
  -h, --help                Show this help
`);
}

// -----------------------------------------------------------------------------
// CSV + key helpers
// -----------------------------------------------------------------------------

function normDesc(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function tupleKey(r) {
  return `${r.date}|${Number(r.amount).toFixed(2)}|${normDesc(r.description)}`;
}

function parseCsvRows(path) {
  const content = fs.readFileSync(path, 'utf8').trim();
  const { data } = Papa.parse(content, { skipEmptyLines: true, transform: (v) => v.trim() });
  return data.map(([dateStr, description, amountStr]) => {
    const [d, m, y] = dateStr.split('/');
    return {
      date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
      description: normDesc(description),
      amount: Number(String(amountStr).replace(/,/g, '')),
    };
  });
}

// -----------------------------------------------------------------------------
// Reconcile
// -----------------------------------------------------------------------------

async function reconcile(supabase, { account, csvs }) {
  const csvRows = csvs.flatMap(parseCsvRows);
  if (csvRows.length === 0) throw new Error('No rows parsed from CSVs');

  const csvCount = new Map();
  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';
  for (const r of csvRows) {
    const k = tupleKey(r);
    csvCount.set(k, (csvCount.get(k) || 0) + 1);
    if (r.date < minDate) minDate = r.date;
    if (r.date > maxDate) maxDate = r.date;
  }
  console.log(`  CSV date range : ${minDate} .. ${maxDate}`);
  console.log(`  CSV rows total : ${csvRows.length}  unique tuples: ${csvCount.size}`);

  const { data: dbRows, error } = await supabase
    .from('transactions')
    .select('id, date, amount, description, created_at')
    .eq('account_id', account)
    .gte('date', minDate)
    .lte('date', maxDate)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const dbByKey = new Map();
  for (const r of dbRows) {
    const k = tupleKey(r);
    if (!dbByKey.has(k)) dbByKey.set(k, []);
    dbByKey.get(k).push(r);
  }
  console.log(`  DB rows in range: ${dbRows.length}  unique tuples: ${dbByKey.size}`);

  const toDelete = [];
  const missing = [];
  const extras = [];
  for (const [k, expected] of csvCount) {
    const got = (dbByKey.get(k) || []).length;
    if (got < expected) missing.push({ key: k, csv: expected, db: got });
  }
  for (const [k, rows] of dbByKey) {
    const expected = csvCount.get(k) || 0;
    if (expected === 0) {
      for (const r of rows) extras.push(r);
    } else if (rows.length > expected) {
      // Keep oldest, delete newest — rows are sorted ascending by created_at
      const victims = rows.slice(-(rows.length - expected));
      for (const v of victims) toDelete.push({ ...v, expected, actual: rows.length });
    }
  }

  console.log(`\n  Missing from DB (CSV has more): ${missing.length}`);
  for (const m of missing) console.log(`    csv=${m.csv} db=${m.db}  ${m.key}`);

  console.log(`\n  Extra in DB (not in CSV but in date range): ${extras.length}`);
  for (const e of extras.slice(0, 20)) {
    console.log(`    ${e.date}  £${Number(e.amount).toFixed(2).padStart(10)}  [${e.id.slice(0,8)}]  ${e.description}  (created ${e.created_at?.slice(0,10)})`);
  }
  if (extras.length > 20) console.log(`    ...and ${extras.length - 20} more`);

  const delSum = toDelete.reduce((s, r) => s + Number(r.amount), 0);
  console.log(`\n  DUPLICATES TO DELETE: ${toDelete.length}  sum=£${delSum.toFixed(2)}`);
  for (const d of toDelete) {
    console.log(`    [${d.id.slice(0,8)}]  ${d.date}  £${Number(d.amount).toFixed(2).padStart(10)}  (${d.actual} in DB, ${d.expected} in CSV)  ${d.description}  (created ${d.created_at?.slice(0,10)})`);
  }

  return toDelete;
}

async function executeDeletes(supabase, rows) {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);

  const { data: backup } = await supabase
    .from('transactions')
    .select('*')
    .in('id', ids);
  const backupPath = `scripts/backups/deleted-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.mkdirSync('scripts/backups', { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`  backup saved -> ${backupPath} (${backup?.length} rows)`);

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error: hashErr } = await supabase
      .from('imported_transaction_hashes')
      .delete()
      .in('transaction_id', chunk);
    if (hashErr) console.error('  hash delete error:', hashErr.message);

    const { error: txErr } = await supabase
      .from('transactions')
      .delete()
      .in('id', chunk);
    if (txErr) {
      console.error('  tx delete error:', txErr.message);
      continue;
    }
    console.log(`  deleted ${chunk.length} rows`);
  }
}

async function validateBalance(supabase, { account, snapshotDate, snapshotBalance, live }) {
  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .eq('account_id', account)
    .gte('date', snapshotDate);
  const sum = (data || []).reduce((s, r) => s + Number(r.amount), 0);
  const computed = snapshotBalance + sum;
  const drift = computed - live;
  console.log('\n=== Balance validation ===');
  console.log(`  snapshot  : £${snapshotBalance.toFixed(2)} on ${snapshotDate}`);
  console.log(`  sum since : £${sum.toFixed(2)}  (${data?.length} rows)`);
  console.log(`  computed  : £${computed.toFixed(2)}`);
  console.log(`  bank live : £${live.toFixed(2)}`);
  console.log(`  drift     : £${drift.toFixed(2)}  ${Math.abs(drift) < 0.01 ? 'OK' : 'MISMATCH'}`);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.account || args.csvs.length === 0) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const supabase = createClient(url, key, { db: { schema: 'finance' } });

  console.log(`\n${args.write ? '[WRITE]' : '[DRY-RUN]'} csv-truth-reconcile for account ${args.account}\n`);

  const toDelete = await reconcile(supabase, args);

  if (args.write) {
    await executeDeletes(supabase, toDelete);
  } else if (toDelete.length > 0) {
    console.log('\n(dry-run — pass --write to execute deletes)');
  }

  if (args.snapshotDate != null && args.snapshotBalance != null && args.live != null) {
    await validateBalance(supabase, args);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
