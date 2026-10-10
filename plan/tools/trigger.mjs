#!/usr/bin/env node
// @ts-check
/**
 * What does a life event touch?
 *
 *   npm run plan:trigger               # list events and how many keys each touches
 *   npm run plan:trigger -- april      # the keys, current values and review dates for that event
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAssumptionsFile } from '../inputs/assumptions.mjs';

const planDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = await readAssumptionsFile();
const event = process.argv[2];
const byEvent = /** @type {Record<string, string[]>} */ ({});
for (const [key, e] of Object.entries(built.entries)) for (const t of e.triggers ?? []) (byEvent[t] ??= []).push(key);
const doc = fs.readFileSync(path.join(planDir, 'triggers.md'), 'utf8');
const row = (/** @type {string} */ ev) => doc.split('\n').find((l) => l.startsWith(`| \`${ev}\` |`));

if (!event) {
  console.log('Events (from assumptions.json triggers) — npm run plan:trigger -- <event>:\n');
  for (const [ev, keys] of Object.entries(byEvent).sort()) console.log(`  ${ev.padEnd(16)} ${String(keys.length).padStart(2)} keys${row(ev) ? '' : '   (not described in plan/triggers.md)'}`);
  process.exit(0);
}
const keys = byEvent[event];
if (!keys) { console.error(`no assumption lists the trigger "${event}". Known: ${Object.keys(byEvent).sort().join(', ')}`); process.exit(2); }
const r = row(event);
if (r) { const cells = r.split('|').map((s) => s.trim()); console.log(`${event}: ${cells[2]}\n\n${cells[3]}\n`); }
console.log('Keys this event touches:');
for (const k of keys) { const e = built.entries[k]; const v = built.flat[k]; console.log(`  ${k.padEnd(34)} ${String(typeof v === 'object' ? '(object)' : v).padStart(12)}  ${e.status.padEnd(8)} as of ${e.asOf ?? '-'}  review ${e.reviewBy ?? '-'}`); }
console.log(`\nChange one with: npm run plan:set -- <key> <value> --source "…" --asof YYYY-MM-DD\nThen: npm run plan:check   and, if material, npm run plan:run → review → npm run plan:accept -- <date>`);
