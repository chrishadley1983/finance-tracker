/**
 * Engine invariants: pure, injected, deterministic; the standalone runner
 * produces the same output as the in-process call; the cockpit shims are
 * exactly the engine bound to the repo's assumptions.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assumptionsFile from '../../../plan/assumptions.json';
import fallback from '../../../plan/observations/gilt-prices/2026-07-29.json';
import yields from '../../../plan/observations/gilt-yields/2026-09-20.json';
import payslipAug from '../../../plan/observations/payslips/2026-08.json';
import { buildAssumptions } from '../../../plan/inputs/assumptions.mjs';
import { runPlan, ENGINE_VERSION } from '../../../plan/engine/index.mjs';
import { runLedger } from '../../../plan/engine/ledger.mjs';
import * as enginePivot from '../../../plan/engine/pivot.mjs';
import { pivotProgramme, currentRetune } from '@/lib/plan/pivot';
import { drawdownSim, DEFAULT_OUTLOOK } from '@/lib/plan/outlook';
import { buildLadder } from '@/lib/plan/ladder';
import { ASSUMPTIONS } from '@/lib/plan/assumptions';

const root = path.resolve(__dirname, '../../..');
const built = buildAssumptions(assumptionsFile as never);
const inputs = { assumptions: { ...built.values, __preparedOn: built.preparedOn, __knownLimitations: built.knownLimitations }, giltPrices: fallback, giltYields: yields, payslip: payslipAug, today: '2026-09-21' };

describe('plan engine (phase 2)', () => {
  it('engine modules import nothing outside plan/engine and use no Node APIs', () => {
    const dir = path.join(root, 'plan/engine');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs') && x !== 'run-standalone.mjs')) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of Array.from(src.matchAll(/^import .* from '([^']+)'/gm))) expect(m[1], `${f} imports ${m[1]}`).toMatch(/^\.\/[a-z-]+\.mjs$/);
      expect(src, `${f} touches Node APIs`).not.toMatch(/\b(require\(|process\.|fs\.|node:)/);
      expect(src, `${f} reads the clock`).not.toMatch(/new Date\(\)/);
    }
  });

  it('runPlan is deterministic: same inputs, deep-equal outputs', () => {
    const x = runPlan(inputs), y = runPlan(JSON.parse(JSON.stringify(inputs)));
    expect(JSON.stringify(x)).toBe(JSON.stringify(y));
    expect(x.engineVersion).toBe(ENGINE_VERSION);
    expect(x.ledger?.headline.atRetirement).toBeGreaterThan(2_000);
    expect(x.pivot.avcRecipe?.avcPct).toBe(55);
    expect(Math.round(x.ladder!.amountPerYear)).toBe(Math.round(buildLadder(fallback.gilts as never).amountPerYear));
  });

  it('the standalone runner equals the in-process engine on the same inputs file', () => {
    const tmp = path.join(root, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
    const inFile = path.join(tmp, 'engine-test-inputs.json');
    fs.writeFileSync(inFile, JSON.stringify(inputs));
    const viaProcess = JSON.parse(execFileSync('node', ['plan/engine/run-standalone.mjs', inFile], { cwd: root, encoding: 'utf8', maxBuffer: 50e6 }));
    expect(viaProcess).toEqual(JSON.parse(JSON.stringify(runPlan(inputs))));
  }, 30_000);

  it('cockpit shims are the engine bound to the repo assumptions', () => {
    expect(pivotProgramme(60_000)).toEqual(enginePivot.pivotProgramme(ASSUMPTIONS, 60_000));
    expect(currentRetune(59_500, new Date('2026-09-21'))).toEqual(enginePivot.currentRetune(ASSUMPTIONS, 59_500, new Date('2026-09-21')));
    expect(drawdownSim(DEFAULT_OUTLOOK).surplusAt92).toBeGreaterThan(2_000_000);
  });

  it('ledger scenario knobs: spending the reserve lowers the 2075 total by roughly the reserve grown', () => {
    const base = runLedger(built.values, yields as never);
    const spent = runLedger(built.values, yields as never, { cash: 0, crypto: 0 });
    const diff = base.headline.atEnd! - spent.headline.atEnd!;
    expect(diff).toBeGreaterThan(150); // £k real: ~£120k reserve compounded 49 years at 2% (crypto) / 0.5% (cash)
    expect(diff).toBeLessThan(300);
    expect(runLedger(built.values, yields as never, { spend: 80_000, G: 0 }).headline.firstCashNegative).not.toBeNull();
    expect(base.headline.firstCashNegative).toBeNull();
  });
});
