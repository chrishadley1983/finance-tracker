/**
 * npm run plan:accept -- <runId> [--note "..."] [--by "Chris"]
 *
 * Marks a run as the accepted plan: verifies its manifest, writes ACCEPTED.json,
 * points plan/runs/LATEST_ACCEPTED at it, and prints the commit command. From
 * then on the folder is immutable (tests/unit/plan/runs.test.ts re-hashes it).
 */
import fs from 'node:fs';
import path from 'node:path';
import { verifyManifest, ACCEPTED } from '../plan/inputs/manifest.mjs';

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const runId = args.find((a) => !a.startsWith('--') && !(args[args.indexOf(a) - 1] ?? '').startsWith('--'));
const opt = (name: string) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const runsDir = path.resolve(root, opt('dir') ?? 'plan/runs');
if (!runId) { console.error('usage: npm run plan:accept -- <runId> [--note "..."] [--by "name"]'); process.exit(2); }
const dir = path.join(runsDir, runId);
if (!fs.existsSync(path.join(dir, 'outputs.json'))) { console.error(`no run at ${dir}`); process.exit(2); }
const v = verifyManifest(dir);
if (!v.ok) { console.error('refusing to accept — the run folder does not match its manifest:'); for (const p of v.problems) console.error('  ' + p); process.exit(1); }
if (fs.existsSync(path.join(dir, ACCEPTED))) { console.error(`${runId} is already accepted`); process.exit(0); }
const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
const record = { acceptedOn: new Date().toISOString(), by: opt('by') ?? 'Chris', note: opt('note') ?? '', verdictAtRun: summary.verdict, prevAccepted: fs.existsSync(path.join(runsDir, 'LATEST_ACCEPTED')) ? fs.readFileSync(path.join(runsDir, 'LATEST_ACCEPTED'), 'utf8').trim() : null };
fs.writeFileSync(path.join(dir, ACCEPTED), JSON.stringify(record, null, 2) + '\n');
fs.writeFileSync(path.join(runsDir, 'LATEST_ACCEPTED'), runId + '\n');
console.log(`accepted ${runId} (${summary.verdict} at run time)${record.prevAccepted ? `, superseding ${record.prevAccepted}` : ''}`);
console.log(`\nNow commit it:\n  git add ${path.relative(root, dir).replace(/\\/g, '/')} plan/runs/LATEST_ACCEPTED && git commit -m "plan: accept run ${runId}${opt('note') ? ' — ' + opt('note') : ''}"`);
