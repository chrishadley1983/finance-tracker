#!/usr/bin/env node
// @ts-check
/**
 * Change one planning assumption safely.
 *
 *   node plan/tools/set.mjs <key> <value> --source "<where it came from>" --asof YYYY-MM-DD
 *                           [--reviewby YYYY-MM-DD] [--why "<reason>"] [--status FACT|CHECK|GUESS|DECISION]
 *   node plan/tools/set.mjs --list [prefix]
 *
 * Pushes the old value onto the entry's history, rewrites the file with stable
 * formatting, and re-validates (recomputing DERIVED entries) before writing.
 * Refuses to set a DERIVED key. Numbers, booleans and JSON arrays/objects are
 * parsed; anything else is kept as a string.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAssumptions, validateAssumptions, resolveAssumptions } from '../inputs/assumptions.mjs';

const FILE = fileURLToPath(new URL('../assumptions.json', import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--list'].includes(args[i - 1])));

const raw = fs.readFileSync(FILE, 'utf8');
const file = JSON.parse(raw);

if (args.includes('--list')) {
  const prefix = opt('list') ?? '';
  const { flat } = resolveAssumptions(file);
  for (const [k, e] of Object.entries(file.entries)) {
    if (!k.startsWith(prefix)) continue;
    const v = flat[k];
    console.log(`${k.padEnd(36)} ${String(typeof v === 'object' ? JSON.stringify(v) : v).padStart(14)}  ${e.status.padEnd(8)} ${e.asOf ?? ''}  review ${e.reviewBy ?? '-'}`);
  }
  process.exit(0);
}

const [key, valueRaw] = positional;
if (!key || valueRaw === undefined) { console.error('usage: set.mjs <key> <value> --source ... --asof YYYY-MM-DD [--reviewby ...] [--why ...] [--status ...]'); process.exit(2); }
const entry = file.entries[key];
if (!entry) { console.error(`unknown key ${key}. New keys are added by editing plan/assumptions.json directly (with all provenance fields).`); process.exit(2); }
if (entry.status === 'DERIVED') { console.error(`${key} is DERIVED (${entry.formula}); change its inputs instead.`); process.exit(2); }
const source = opt('source'), asOf = opt('asof');
if (!source || !asOf) { console.error('--source and --asof are required: every change carries its provenance.'); process.exit(2); }

let value;
try { value = JSON.parse(valueRaw); } catch { value = valueRaw; }
const today = new Date().toISOString().slice(0, 10);
entry.history = [...(entry.history ?? []), { value: entry.value, asOf: entry.asOf, supersededOn: today, ...(opt('why') ? { why: opt('why') } : {}) }];
entry.value = value;
entry.source = source;
entry.asOf = asOf;
if (opt('reviewby')) entry.reviewBy = opt('reviewby');
if (opt('status')) entry.status = opt('status');

const problems = validateAssumptions(file);
if (problems.length) { console.error('refusing to write — the change would make the file invalid:'); for (const p of problems) console.error(`  ${p.key}: ${p.message}`); process.exit(1); }
const built = buildAssumptions(file);
fs.writeFileSync(FILE, JSON.stringify(file, null, 2) + '\n');
console.log(`${key} = ${JSON.stringify(value)} (was ${JSON.stringify(entry.history[entry.history.length - 1].value)}), asOf ${asOf}`);
const affected = Object.entries(file.entries).filter(([, e]) => e.status === 'DERIVED' && e.formula && e.formula.includes(key)).map(([k]) => `${k} = ${built.flat[k]}`);
if (affected.length) console.log('recomputed: ' + affected.join('; '));
console.log('Now: git diff plan/assumptions.json; add a line to plan/decisions.md if this was a decision; npm run plan:check');
