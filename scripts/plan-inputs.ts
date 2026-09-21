/**
 * npm run plan:inputs — collect the engine's inputs (assumptions + live
 * observations from the database and the price feed), print the drift report
 * (what the assumptions say vs what was observed) and write the inputs file.
 *
 *   npm run plan:inputs                       # live; writes tmp/plan-inputs-<today>.json
 *   npm run plan:inputs -- --offline          # repo files only (no DB, no network)
 *   npm run plan:inputs -- --out path.json    # choose the output file
 *   npm run plan:inputs -- --save-prices      # also store today's gilt prices as an observation file
 *
 * Exit code: 0 GREEN/AMBER, 1 RED — so a scheduled run shows up as failed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { collectInputs } from '../plan/inputs/collect';

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const live = !args.includes('--offline');
const today = opt('today') ?? new Date().toISOString().slice(0, 10);

(async () => {
  const { inputs, drift } = await collectInputs({ live, savePrices: args.includes('--save-prices'), today, log: (m) => console.log('  ' + m) });
  const out = opt('out') ?? path.join('tmp', `plan-inputs-${today}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(inputs, null, 1));
  console.log(`\ninputs written: ${out} (${live ? 'live' : 'offline'}; prices ${inputs.giltPrices.asOf}; payslip ${inputs.observations.payslip ? (inputs.observations.payslip as { month: string }).month : 'none'})`);
  const inc = inputs.observations.income as { abbyTakeHome: number; hbDrawings: number; childBenefit: number; cottrell: number; sideIncome: number; contributions: number; recurring: number } | undefined;
  if (inc) console.log(`  trailing-12m income: Abby ${Math.round(inc.abbyTakeHome).toLocaleString('en-GB')}, HB ${Math.round(inc.hbDrawings).toLocaleString('en-GB')}, CB ${Math.round(inc.childBenefit).toLocaleString('en-GB')}, Cottrell ${Math.round(inc.cottrell).toLocaleString('en-GB')}, side ${Math.round(inc.sideIncome).toLocaleString('en-GB')}, contributions ${Math.round(inc.contributions).toLocaleString('en-GB')} → recurring spendable ${Math.round(inc.recurring).toLocaleString('en-GB')}`);
  console.log('\nDrift (assumptions vs observations):');
  for (const d of drift.items) console.log(`${d.level.padEnd(5)} ${d.item}: ${d.detail}`);
  console.log(`\n${drift.verdict}`);
  process.exit(drift.verdict === 'RED' ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
