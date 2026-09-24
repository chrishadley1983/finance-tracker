// @ts-check
/**
 * An independent re-implementation of the Plan E ledger, written from scratch
 * for the 23 Sep 2026 review (not a copy of plan/engine/ledger.mjs). It values
 * each gilt holding at its own locked yield instead of a wrapper IRR, tracks
 * the lump sum allowance and the drawdown fund separately, and computes tax
 * band by band. It shares only the pivot arithmetic (Abby's sacrifice), which
 * is itself held to hand derivations in golden.json.
 *
 * tests/unit/plan/independent.test.ts holds the engine to this model within a
 * small tolerance at 0/2/4% real under both drawdown strategies. Agreement of
 * two implementations is not proof of correctness, but a disagreement is proof
 * that one of them is wrong.
 *
 * Real £k, today's money; row 2026 = the snapshot balances. Row conventions
 * (pension access from the year after Chris turns 57, state pensions from the
 * year after each SPA year) follow the engine so the two can be compared.
 */
import { pivotProgramme } from '../engine/pivot.mjs';

const k = (/** @type {number} */ x) => x / 1000;
const annuity = (/** @type {number} */ n, /** @type {number} */ g) => (n <= 0 ? 0 : g === 0 ? n : (1 - Math.pow(1 + g, -n)) / g);
const range = (/** @type {number} */ x, /** @type {number} */ y) => Array.from({ length: y - x + 1 }, (_, i) => x + i);

/**
 * @param {any} a resolved assumptions
 * @param {{ rungs: Array<{ y: number, cpn: number, yld: number }> }} yields
 * @param {{ G?: number, gPath?: number[], spend?: number, bandFill?: boolean }} [o]
 */
export function independentLedger(a, yields, o = {}) {
  const BASE = 2026, END = a.dates.simulationEndYear, R = a.dates.planRetirementYear, CPI = a.returns.cpi;
  const G = o.G ?? a.returns.realEquity.planning, SPEND = k(o.spend ?? a.spend.retirementTarget);
  const OPEN_C = a.dates.chrisPensionAccessYear + 1, OPEN_A = a.dates.abbyPensionAccessYear;
  const SP_C = a.dates.chrisStatePensionYear + 1, SP_A = a.dates.abbyStatePensionYear + 1, SP = k(a.statePension.annualEach);
  const byYear = Object.fromEntries(yields.rungs.map((r) => [r.y, r]));
  // price of £1 of real redemption; a year with no linker (2043) is half each of its neighbours
  /** @param {number} y @returns {number} */
  const price = (y) => { const r = byYear[y]; if (!r) return (price(y - 1) + price(y + 1)) / 2; const n = y - BASE; return r.cpn * annuity(n, r.yld) + Math.pow(1 + r.yld, -n); };
  /** @param {number} budget @param {number[]} years */
  const buy = (budget, years) => {
    const Rr = budget / years.reduce((s, y) => s + price(y), 0);
    /** @type {Record<number, number>} */ const h = {};
    for (const y of years) { if (byYear[y]) h[y] = (h[y] ?? 0) + Rr; else { h[y - 1] = (h[y - 1] ?? 0) + Rr / 2; h[y + 1] = (h[y + 1] ?? 0) + Rr / 2; } }
    return h;
  };
  /** @param {Record<number, number>} h @param {number} t */
  const value = (h, t) => Object.entries(h).reduce((s, [ys, f]) => { const y = Number(ys); if (y <= t) return s; const r = byYear[y]; const n = y - t; return s + f * (r.cpn * annuity(n, r.yld) + Math.pow(1 + r.yld, -n)); }, 0);
  /** @param {Record<number, number>} h @param {number} t */
  const inflow = (h, t) => Object.entries(h).reduce((s, [ys, f]) => { const y = Number(ys); return y < t ? s : s + f * byYear[y].cpn + (y === t ? f : 0); }, 0);
  const isaH = buy(k(a.ladder.isaBudgetReal), range(a.ladder.firstYear, a.dates.chrisPensionAccessYear));
  const sippH = buy(k(a.ladder.sippBudgetReal), range(a.dates.chrisPensionAccessYear + 1, a.ladder.lastYear));

  const p = {
    isa: k(a.pots.chrisIiIsa + a.pots.abbyVanguardIsa - a.ladder.isaBudgetReal), gia: 0, cash: k(a.pots.cashBuffer), crypto: k(a.pots.crypto), shares: k(a.pots.accentureShares),
    c: k(a.pots.chrisIiSipp - a.ladder.sippBudgetReal + a.pots.chrisAccenturePension), a: k(a.pots.abbyAccentureDc), isaCash: 0,
  };
  const D = { c: 0, a: 0 }, lsaNominal = { c: k(a.drawdown.tfcCapEach), a: k(a.drawdown.tfcCapEach) };
  const contrib = pivotProgramme(a, a.hicbc.lowerThreshold).years.map((y, i) => k(y.extraSacrifice) * Math.pow(1 + CPI, -i) + k(a.payslip.basicAnnual * (a.payslip.employerRate + a.payslip.existingEeRate)));

  let lifeTax = 0;
  /** @type {Array<{ year: number, total: number, pensions: number, cash: number }>} */ const rows = [];
  for (let year = BASE, i = 0; year <= END; year++, i++) {
    const infl = Math.pow(1 + CPI, -(year - BASE));
    const band = Math.pow(1 + CPI, -(Math.min(year, a.tax.thresholdsFrozenThroughTaxYear) - BASE));
    const pa = k(a.tax.personalAllowance) * band, hrt = k(a.tax.higherRateFloor) * band;
    const tax = (/** @type {number} */ inc) => a.tax.basicRate * Math.max(0, Math.min(inc, hrt) - pa) + a.tax.higherRate * Math.max(0, inc - hrt);
    if (year > BASE) {
      const g = o.gPath ? o.gPath[i - 1] ?? G : G;
      for (const key of /** @type {const} */ (['isa', 'gia', 'crypto', 'shares', 'c', 'a'])) p[key] *= 1 + g;
      D.c *= 1 + g; D.a *= 1 + g; p.cash *= 1 + a.returns.cashReal;
      const fromIsa = inflow(isaH, year);
      if (year < R) p.isa += fromIsa; else p.isaCash += fromIsa;
      p.c += inflow(sippH, year);
      if (year <= R && i - 1 < contrib.length) p.a += contrib[i - 1];
    }
    if (year >= R) {
      const hb = year <= a.dates.chrisPensionAccessYear ? k(a.income.hbPostRetirement) : 0;
      const inc = { c: hb + (year >= SP_C ? SP : 0), a: year >= SP_A ? SP : 0 };
      const open = { c: year >= OPEN_C, a: year >= OPEN_A };
      let cash = p.isaCash + inc.c + inc.a; p.isaCash = 0;
      // taxable T from person w: drawdown fund first, then crystallise with 25% tax-free while the allowance lasts
      const draw = (/** @type {'c'|'a'} */ w, /** @type {number} */ T) => {
        const d = Math.max(0, Math.min(T, D[w], p[w])); D[w] -= d; p[w] -= d;
        const need = T - d; let got = d, free = 0;
        if (need > 1e-12) { const L = lsaNominal[w] * infl; const x = Math.max(0, Math.min(need / 3 <= L ? need / 0.75 : need + L, p[w] - D[w])); free = Math.min(x / 4, L); lsaNominal[w] -= free / infl; p[w] -= x; got += x - free; }
        inc[w] += got; return got + free;
      };
      const lumpSum = (/** @type {'c'|'a'} */ w, /** @type {number} */ want) => { const t = Math.max(0, Math.min(want, lsaNominal[w] * infl, (p[w] - D[w]) / 4)); lsaNominal[w] -= t / infl; p[w] -= t; D[w] += 3 * t; return t; };
      for (const w of /** @type {const} */ (['c', 'a'])) if (open[w]) cash += draw(w, Math.max(0, (o.bandFill ? hrt : pa) - inc[w]));
      let owed = tax(inc.c) + tax(inc.a);
      let short = SPEND + owed - cash;
      if (short > 0) {
        if (!o.bandFill) for (const w of /** @type {const} */ (['c', 'a'])) if (open[w] && short > 0) short -= lumpSum(w, short);
        for (const key of /** @type {const} */ (['isa', 'gia'])) { const t = Math.min(short, Math.max(0, p[key])); p[key] -= t; short -= t; }
        { const t = Math.min(short, Math.max(0, p.cash - k(a.ledger.cashFloor))); p.cash -= t; short -= t; }
        for (const w of /** @type {const} */ (['c', 'a'])) {
          for (let it = 0; it < 40 && short > 1e-9 && open[w]; it++) {
            const m = inc[w] < pa ? 0 : inc[w] < hrt ? a.tax.basicRate : a.tax.higherRate;
            const room = inc[w] < pa ? pa - inc[w] : inc[w] < hrt ? hrt - inc[w] : Infinity;
            const got = draw(w, Math.min(short / (1 - m), room));
            if (got <= 1e-12) break;
            const now = tax(inc.c) + tax(inc.a); short -= got - (now - owed); owed = now;
          }
        }
        if (short > 1e-9) p.cash -= short; // everything but the crypto is gone: the cash line goes negative
      } else {
        const surplus = -short; const toIsa = year <= a.dates.chrisPensionAccessYear ? surplus : Math.min(surplus, k(a.ledger.isaAllowanceCouple));
        p.isa += toIsa; p.gia += surplus - toIsa;
      }
      lifeTax += owed;
    }
    const pensions = p.c + p.a + value(sippH, year);
    rows.push({ year, total: value(isaH, year) + p.isa + p.gia + p.cash + p.crypto + p.shares + p.isaCash + pensions, pensions, cash: p.cash });
  }
  // "cash runs out": the first year the cash line (floor included) or the total goes negative, as in the engine
  const firstFail = rows.find((r) => r.cash < 0 || r.total < 0)?.year ?? null;
  const at = (/** @type {number} */ y) => rows.find((r) => r.year === y)?.total ?? NaN;
  return { rows, lifeTax, firstFail, atRetirement: at(R), atLastRung: at(a.ladder.lastYear), atEnd: rows[rows.length - 1].total, pensionsEnd: rows[rows.length - 1].pensions };
}
