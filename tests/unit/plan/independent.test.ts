/**
 * The engine's ledger against an independent re-implementation
 * (plan/derivations/independent-ledger.mjs, written from scratch on 23 Sep 2026).
 * Both read the same assumptions and yields, so this holds whatever the pots are
 * on the day. Tolerances: 1% of the balance (the two value the ladder differently:
 * wrapper IRR vs each gilt at its own yield) and £15k of lifetime tax.
 */
import { describe, it, expect } from 'vitest';
import assumptionsFile from '../../../plan/assumptions.json';
import yields21 from '../../../plan/observations/gilt-yields/2026-09-21.json';
import { buildAssumptions } from '../../../plan/inputs/assumptions.mjs';
import { runLedger } from '../../../plan/engine/ledger.mjs';
import { independentLedger } from '../../../plan/derivations/independent-ledger.mjs';

const a = buildAssumptions(assumptionsFile as never).values;
const y = yields21 as never;
const close = (x: number, want: number, rel: number, floor = 10) => expect(Math.abs(x - want), `${x.toFixed(1)} vs independent ${want.toFixed(1)}`).toBeLessThanOrEqual(Math.max(floor, rel * Math.abs(want)));

describe('engine ledger vs the independent model', () => {
  for (const strategy of ['basicBand', 'paFill'] as const) {
    for (const G of [0, 0.02, 0.04]) {
      for (const spend of [a.spend.retirementTarget, a.spend.planLine]) {
        it(`${strategy}, ${G * 100}% real, £${spend / 1000}k: balances within 1%, same failure year, tax within £15k`, () => {
          const e = runLedger(a, y, { G, spend, drawdown: strategy });
          const m = independentLedger(a, y as never, { G, spend, bandFill: strategy === 'basicBand' });
          close(e.headline.atRetirement!, m.atRetirement, 0.01);
          close(e.headline.atLastRung!, m.atLastRung, 0.01);
          close(e.headline.atEnd!, m.atEnd, 0.01, 15);
          expect(e.headline.firstCashNegative).toBe(m.firstFail);
          close(e.lifeTax, m.lifeTax, 0, 15);
        });
      }
    }
  }
});
