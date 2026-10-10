/**
 * Assemble the engine's inputs from the repo (assumptions + observation files)
 * and, when live, from the database and the gilt-price feed. This is what the
 * run job (phase 5) writes into plan/runs/<date>/inputs.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildAssumptions } from './assumptions.mjs';
import { potsFromSnapshots, driftReport } from './observe.mjs';
import { getGiltPrices } from './gilt-prices.mjs';
import { newestPayslip } from './payslips.mjs';
import { observeSnapshots, observeRunRate, observeIncome, observeRungs } from './adapters';
import { getDb } from './db';

const planDir = path.resolve(__dirname, '..');

export interface CollectOptions {
  live?: boolean; // query the DB and the price feed; false = repo files only
  offlinePrices?: boolean;
  savePrices?: boolean;
  today?: string; // YYYY-MM-DD
  log?: (msg: string) => void;
}

export async function collectInputs(opts: CollectOptions = {}) {
  const log = opts.log ?? (() => {});
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const file = JSON.parse(fs.readFileSync(path.join(planDir, 'assumptions.json'), 'utf8'));
  const built = buildAssumptions(file);
  const a = built.values;
  const yieldsDir = path.join(planDir, 'observations', 'gilt-yields');
  const yieldsFile = fs.readdirSync(yieldsDir).filter((f) => f.endsWith('.json')).sort().pop();
  const giltYields = yieldsFile ? JSON.parse(fs.readFileSync(path.join(yieldsDir, yieldsFile), 'utf8')) : null;
  const payslip = newestPayslip();
  const isinsDir = path.join(planDir, 'observations', 'gilt-isins');
  const isinsFile = fs.existsSync(isinsDir) ? fs.readdirSync(isinsDir).filter((f) => f.endsWith('.json')).sort().pop() : undefined;
  const giltIsins = isinsFile ? JSON.parse(fs.readFileSync(path.join(isinsDir, isinsFile), 'utf8')) : null;
  const giltPrices = await getGiltPrices({ offline: !opts.live || opts.offlinePrices, save: opts.savePrices, log });
  const shillerPath = path.join(planDir, 'observations', 'market', 'shiller-monthly.json');
  const shiller: number[][] | null = fs.existsSync(shillerPath) ? JSON.parse(fs.readFileSync(shillerPath, 'utf8')) : null;

  const observations: Record<string, unknown> = {
    giltPrices: { asOf: giltPrices.asOf, source: giltPrices.source, live: giltPrices.live, file: giltPrices.file ?? null, count: giltPrices.gilts.length },
    giltYields: giltYields ? { asOf: giltYields.asOf, file: yieldsFile } : null,
    payslip: payslip ? { file: payslip.file, month: payslip.month, payDate: payslip.slip.payDate, taxMonth: payslip.slip.taxMonth } : null,
  };
  let pots: ReturnType<typeof potsFromSnapshots> | undefined;
  let runRate: Awaited<ReturnType<typeof observeRunRate>> | undefined;
  let income: Awaited<ReturnType<typeof observeIncome>> | undefined;
  let rungs: Awaited<ReturnType<typeof observeRungs>> | undefined;
  if (opts.live) {
    const db = await getDb();
    const snaps = await observeSnapshots(db);
    pots = potsFromSnapshots(a, snaps.accounts);
    runRate = await observeRunRate(db, a as { spend: { planLine: number; excludedCategories: readonly string[] } }, new Date(today));
    income = await observeIncome(db, new Date(today));
    rungs = await observeRungs(db);
    observations.snapshots = { asOf: snaps.asOf, accounts: snaps.accounts, pots: pots.observed, unmapped: pots.missing };
    observations.runRate = runRate;
    observations.income = income;
    observations.rungs = rungs;
    log(`snapshots as of ${snaps.asOf} (${snaps.accounts.length} accounts); run-rate ${Math.round(runRate.trailing12moSpend)} over ${runRate.txnCount} txns; income ${income.txnCount} rows; rungs ${rungs.rungs.length}`);
  }
  const drift = driftReport(a, { pots, runRate, payslip: payslip?.slip, rungs: rungs?.rungs }, today);
  const inputs = {
    assumptions: { ...a, __preparedOn: built.preparedOn, __knownLimitations: built.knownLimitations },
    giltPrices: { asOf: giltPrices.asOf, source: giltPrices.source, gilts: giltPrices.gilts },
    giltYields,
    giltIsins,
    payslip: payslip?.slip ?? null,
    shiller: shiller ?? undefined,
    today,
    observations: { ...observations, shiller: shiller ? { rows: shiller.length, file: 'observations/market/shiller-monthly.json' } : null },
  };
  return { inputs, drift };
}
