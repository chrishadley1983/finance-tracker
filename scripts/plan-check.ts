/**
 * npm run plan:check — the fast, DB-free health check on the plan's inputs.
 *
 * - validates plan/assumptions.json (structure, provenance, DERIVED-only formulas)
 * - recomputes every DERIVED entry and prints the values the app is using
 * - reports anything past its reviewBy date: AMBER ≤ 90 days over, RED after
 * - cross-checks the two homes that still exist until phase 2: the AVC array in
 *   scripts/ifa-e-yearly.mjs must equal lib/plan/pivot.ts output, and
 *   income.abbyTakeHomeYear1 (engine-derived) must match the PAYE model
 * - exits 1 on RED so a scheduled run shows up as failed
 *
 * Also runs in tests as a soft check (tests/unit/plan/assumptions.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildAssumptions, freshness } from '../plan/inputs/assumptions.mjs';
import { pivotProgramme, pivotYear, takeHomeNominal } from '../lib/plan/pivot';

const root = path.resolve(__dirname, '..');
const file = JSON.parse(fs.readFileSync(path.join(root, 'plan/assumptions.json'), 'utf8'));
const today = new Date();
let red = 0, amber = 0;
const flag = (level: 'RED' | 'AMBER' | 'OK', msg: string) => { if (level === 'RED') red++; if (level === 'AMBER') amber++; console.log(`${level.padEnd(5)} ${msg}`); };

const built = buildAssumptions(file);
console.log(`plan/assumptions.json prepared ${built.preparedOn}; ${Object.keys(built.entries).length} entries, ${built.engineDerived.length} engine-derived, ${built.knownLimitations.length} known limitations\n`);

console.log('DERIVED (recomputed by the loader):');
for (const [k, e] of Object.entries(built.entries)) if (e.status === 'DERIVED' && e.derivedBy !== 'engine') console.log(`  ${k.padEnd(28)} = ${Number(built.flat[k]).toLocaleString('en-GB')}   (${e.formula})`);

console.log('\nFreshness:');
const stale = freshness(file, today);
if (!stale.length) flag('OK', 'nothing past its review date');
for (const s of stale) flag(s.level, `${s.key} (${s.status}) was due ${s.reviewBy}, ${s.daysOver} days ago`);
const soon = Object.entries(built.entries).filter(([, e]) => e.reviewBy && !stale.find((s) => s.key === (e as never))).map(([k, e]) => ({ k, d: (new Date(e.reviewBy as string).getTime() - today.getTime()) / 86_400_000 })).filter((x) => x.d >= 0 && x.d <= 30);
for (const x of soon) console.log(`due   ${x.k} in ${Math.ceil(x.d)} days`);

console.log('\nEngine cross-checks (ledger tool vs pivot):');
try {
  const out = JSON.parse(execFileSync('node', ['plan/tools/ledger.mjs', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 50e6 }));
  const want = pivotProgramme(built.values.hicbc.lowerThreshold).years.map((y) => y.extraSacrifice / 1000);
  const payroll = (built.values.payslip.basicAnnual * (built.values.payslip.employerRate + built.values.payslip.existingEeRate)) / 1000;
  const arrOk = out.avcSchedule.length === want.length && out.avcSchedule.every((v: number, i: number) => Math.abs(v - want[i]) < 0.001);
  const payOk = Math.abs(out.payrollReal - payroll) < 0.001;
  flag(arrOk ? 'OK' : 'RED', `ledger AVC schedule ${arrOk ? 'matches' : 'DIFFERS FROM'} pivot.ts (${want.map((x) => x.toFixed(1)).join(', ')} £k)`);
  flag(payOk ? 'OK' : 'RED', `ledger payroll contribution ${out.payrollReal.toFixed(3)} vs ${payroll.toFixed(3)} £k from the payslip`);
  flag(Math.abs(out.wrappers.isa.budget * 1000 - Number(built.flat['ladder.isaBudgetReal'])) < 1 ? 'OK' : 'RED', `ledger ISA budget ${out.wrappers.isa.budget.toFixed(1)}k = ladder.isaBudgetReal`);
  const r35 = out.rows.find((r: { year: number }) => r.year === built.values.dates.planRetirementYear);
  const r75 = out.rows[out.rows.length - 1];
  console.log(`      ledger planning case: ${r35.year} £${(r35.total / 1000).toFixed(2)}M → ${r75.year} £${(r75.total / 1000).toFixed(2)}M, lifetime tax £${out.lifeTax.toFixed(1)}k`);
} catch (err) {
  flag('RED', `could not run plan/tools/ledger.mjs: ${(err as Error).message.split('\n')[0]}`);
}
const th = takeHomeNominal(0, pivotYear(0, built.values.hicbc.lowerThreshold).extraSacrifice);
flag(Math.abs(th - 43_498) < 60 ? 'OK' : 'AMBER', `income.abbyTakeHomeYear1 (engine) = ${Math.round(th).toLocaleString('en-GB')}`);

console.log(`\nKnown limitations carried: ${built.knownLimitations.map((l) => l.id).join(', ')}`);

(async () => {
  // Dead-man: the last accepted run must not go stale (plan/inputs/diff-rules.json acceptedAgeDays).
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'plan/inputs/diff-rules.json'), 'utf8'));
  const latestFile = path.join(root, 'plan/runs/LATEST_ACCEPTED');
  console.log('\nAccepted run:');
  if (!fs.existsSync(latestFile)) flag('AMBER', 'no accepted run yet — run npm run plan:run, review plan/runs/<date>/diff.md, then npm run plan:accept -- <date>');
  else {
    const id = fs.readFileSync(latestFile, 'utf8').trim();
    const acc = path.join(root, 'plan/runs', id, 'ACCEPTED.json');
    const age = fs.existsSync(acc) ? Math.floor((today.getTime() - new Date(JSON.parse(fs.readFileSync(acc, 'utf8')).acceptedOn).getTime()) / 86_400_000) : NaN;
    flag(isNaN(age) ? 'RED' : age > rules.acceptedAgeDays.red ? 'RED' : age > rules.acceptedAgeDays.amber ? 'AMBER' : 'OK', `last accepted run ${id}, ${isNaN(age) ? 'ACCEPTED.json missing' : age + ' days ago'}`);
  }
  if (process.argv.includes('--live')) {
    console.log('\nLive drift (assumptions vs database and price feed):');
    try {
      const { collectInputs } = await import('../plan/inputs/collect');
      const { drift } = await collectInputs({ live: true, offlinePrices: process.argv.includes('--offline-prices'), today: today.toISOString().slice(0, 10) });
      for (const d of drift.items) flag(d.level, `${d.item}: ${d.detail}`);
    } catch (err) {
      flag('RED', `live drift check failed: ${(err as Error).message.split('\n')[0]}`);
    }
  } else {
    console.log('\n(pass --live to compare the assumptions with the database snapshots, run-rate and payslip age)');
  }
  const verdict = red ? 'RED' : amber ? 'AMBER' : 'GREEN';
  console.log(`\n${verdict}: ${red} red, ${amber} amber`);
  if (process.argv.includes('--notify') && red) {
    const { notifyDiscord, notifyEmail } = await import('../plan/inputs/notify.mjs');
    const msg = `Plan check ${today.toISOString().slice(0, 10)}: RED (${red} red, ${amber} amber) — see plan-check.log`;
    await notifyDiscord(msg);
    notifyEmail({ subject: 'Household plan check: RED', html: `<pre>${msg}</pre>` });
  }
  process.exitCode = red ? 1 : 0; // not process.exit(): see plan-run.ts
})();
