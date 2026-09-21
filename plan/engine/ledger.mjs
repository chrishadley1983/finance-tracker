// @ts-check
/**
 * Plan E account-level ledger, year by year from the base year to the
 * simulation horizon. Real £k throughout. Pure; assumptions via `a`, rung
 * yields via an observation object. Port of scripts/ifa-e-yearly.mjs
 * (20 Sep 2026 revision) — see plan/engine/SPEC.md §ledger.
 *
 * Mechanics:
 *  - the ladder is real linkers: each wrapper's budget buys a redemption per
 *    rung-year at the observed yields (coupon-inclusive prices); coupons are
 *    paid out every year and reinvested in-wrapper before retirement
 *  - row BASE is the snapshot balances; growth/accrual apply from BASE+1
 *  - Abby's salary sacrifice (from the pivot arithmetic) lands in her DC pot
 *    each programme year; the rest of the household is treated as breakeven
 *  - from retirement: spend + tax funded by rung cash (ISA years), HB, state
 *    pensions, PA-filling pension draws, then TFC, ISA, GIA, cash to a floor,
 *    and finally taxed pension draws
 */
import { personTax, annuity } from './tax.mjs';
import { pivotProgramme } from './pivot.mjs';

/**
 * @param {any} a  assumption values
 * @param {{ asOf: string, rungs: Array<{ y: number, w: 'isa'|'sipp', epic: string, cpn: number, yld: number, mult: number }> }} yields
 * @param {{ G?: number, baseYear?: number, spend?: number, hbPost?: number, cash?: number, crypto?: number }} [opts]
 */
export function runLedger(a, yields, opts = {}) {
  const k = (/** @type {number} */ x) => x / 1000;
  const G = opts.G ?? a.returns.realEquity.planning;
  const BASE = opts.baseYear ?? 2026;
  const PA = k(a.tax.personalAllowance), BASIC = k(a.tax.higherRateFloor), TFC_CAP = k(a.drawdown.tfcCapEach);
  const SPEND = opts.spend !== undefined ? k(opts.spend) : k(a.spend.retirementTarget);
  const HB = opts.hbPost !== undefined ? k(opts.hbPost) : k(a.income.hbPostRetirement);
  const RETIRE = a.dates.planRetirementYear, END = a.dates.simulationEndYear;
  const CHRIS_PENSION_YEAR = a.dates.chrisPensionAccessYear + 1, ABBY_PENSION_YEAR = a.dates.abbyPensionAccessYear;
  const CHRIS_SP_YEAR = a.dates.chrisStatePensionYear + 1, ABBY_SP_YEAR = a.dates.abbyStatePensionYear + 1;
  const SP_EACH = k(a.statePension.annualEach), CASH_FLOOR = k(a.ledger.cashFloor), ISA_CAP = k(a.ledger.isaAllowanceCouple);
  const CASH_G = a.returns.cashReal;
  const FIRST_RUNG = a.ladder.firstYear, LAST_RUNG = a.ladder.lastYear;
  const LAST_ISA_RUNG = a.dates.chrisPensionAccessYear; // ISA rungs cover the years before Chris's pension opens
  const FIRST_SIPP_RUNG = LAST_ISA_RUNG + 1;

  // AVC schedule from the pivot arithmetic (modelled to the £60k line), plus existing payroll contributions.
  const programme = pivotProgramme(a, a.hicbc.lowerThreshold);
  const avcSchedule = programme.years.map((y) => k(y.extraSacrifice));
  const payrollReal = k(a.payslip.basicAnnual * (a.payslip.employerRate + a.payslip.existingEeRate));
  const AVC = avcSchedule.map((x) => x + payrollReal);

  // Ladder: per-wrapper redemption sized by budget at the observed yields.
  const ISA_BUDGET = k(a.ladder.isaBudgetReal), SIPP_BUDGET = k(a.ladder.sippBudgetReal);
  const RUNGS = yields.rungs.map((r) => { const n = r.y - BASE; return { ...r, n, price: r.cpn * annuity(n, r.yld) + Math.pow(1 + r.yld, -n) }; });
  const range = (/** @type {number} */ x, /** @type {number} */ y) => { const out = []; for (let i = x; i <= y; i++) out.push(i); return out; };
  /** @type {Record<string, { budget: number, R: number, irr: number, flows: Record<number, { coupon: number, redemption: number }>, rungs: typeof RUNGS }>} */
  const wrappers = {};
  for (const w of /** @type {const} */ (['isa', 'sipp'])) {
    const rs = RUNGS.filter((r) => r.w === w);
    const budget = w === 'isa' ? ISA_BUDGET : SIPP_BUDGET;
    const R = budget / rs.reduce((s, r) => s + r.mult * r.price, 0);
    const payYears = w === 'isa' ? range(FIRST_RUNG, LAST_ISA_RUNG) : range(FIRST_SIPP_RUNG, LAST_RUNG);
    /** @type {Record<number, { coupon: number, redemption: number }>} */
    const flows = {};
    for (let y = BASE + 1; y <= LAST_RUNG; y++) {
      let c = 0; for (const r of rs) if (r.y >= y) c += R * r.mult * r.cpn;
      flows[y] = { coupon: c, redemption: payYears.includes(y) ? R : 0 };
    }
    let lo = 0, hi = 0.05;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; let pv = 0; for (const [y, f] of Object.entries(flows)) pv += (f.coupon + f.redemption) / Math.pow(1 + mid, Number(y) - BASE); if (pv > budget) lo = mid; else hi = mid; }
    wrappers[w] = { budget, R, flows, irr: (lo + hi) / 2, rungs: rs };
  }

  let p = {
    isaLadC: k(a.pots.chrisIiIsa), isaLadA: k(a.ladder.abbyIiIsaTransfer), sippLad: SIPP_BUDGET,
    sippEq: k(a.ladder.sippEquityRetained), acn: k(a.pots.chrisAccenturePension), abbyDC: k(a.pots.abbyAccentureDc),
    abbyIsaEq: k(a.pots.abbyVanguardIsa - a.ladder.abbyIiIsaTransfer), isaEqNew: 0, gia: 0,
    cash: opts.cash !== undefined ? k(opts.cash) : k(a.pots.cashBuffer), crypto: opts.crypto !== undefined ? k(opts.crypto) : k(a.pots.crypto), shares: k(a.pots.accentureShares),
  };
  let tfcC = TFC_CAP, tfcA = TFC_CAP, lifeTax = 0;
  /** @type {any[]} */
  const rows = [];
  for (let year = BASE, yi = 0; year <= END; year++, yi++) {
    /** @type {any} */
    const r = { year, ladder: 0, coupons: 0, hb: 0, sp: 0, drawC: 0, drawA: 0, tfc: 0, tax: 0, spend: 0, surplus: 0, isaSell: 0, taxedDraw: 0 };
    if (year > BASE) {
      for (const key of /** @type {const} */ (['sippEq', 'acn', 'abbyDC', 'abbyIsaEq', 'isaEqNew', 'gia', 'crypto', 'shares'])) p[key] *= 1 + G;
      p.cash *= 1 + CASH_G;
      p.isaLadC *= 1 + wrappers.isa.irr; p.isaLadA *= 1 + wrappers.isa.irr; p.sippLad *= 1 + wrappers.sipp.irr;
      const fi = wrappers.isa.flows[year] ?? { coupon: 0, redemption: 0 };
      const fsipp = wrappers.sipp.flows[year] ?? { coupon: 0, redemption: 0 };
      const isaOut = Math.min(fi.coupon + fi.redemption, Math.max(0, p.isaLadC + p.isaLadA));
      const share = p.isaLadC + p.isaLadA > 0 ? p.isaLadC / (p.isaLadC + p.isaLadA) : 0;
      p.isaLadC -= isaOut * share; p.isaLadA -= isaOut * (1 - share);
      const sippOut = Math.min(fsipp.coupon + fsipp.redemption, Math.max(0, p.sippLad));
      p.sippLad -= sippOut;
      r.coupons = fi.coupon + fsipp.coupon;
      if (year < RETIRE) { p.isaEqNew += isaOut; p.sippEq += sippOut; }
      else if (year <= LAST_ISA_RUNG) { r.ladder = isaOut; p.sippEq += sippOut; }
      else { r.ladder = sippOut; p.sippEq += sippOut; }
      if (year === FIRST_SIPP_RUNG) { p.isaEqNew += Math.max(p.isaLadC + p.isaLadA, 0); p.isaLadC = 0; p.isaLadA = 0; }
      if (year === LAST_RUNG + 1) { p.sippEq += Math.max(p.sippLad, 0); p.sippLad = 0; }
    }
    if (year > BASE && year <= RETIRE && yi - 1 < AVC.length) p.abbyDC += AVC[yi - 1];
    if (year >= RETIRE) {
      r.spend = SPEND;
      r.hb = year <= a.dates.chrisPensionAccessYear ? HB : 0;
      const spC = year >= CHRIS_SP_YEAR ? SP_EACH : 0, spA = year >= ABBY_SP_YEAR ? SP_EACH : 0; r.sp = spC + spA;
      const canC = year >= CHRIS_PENSION_YEAR, canA = year >= ABBY_PENSION_YEAR;
      const dC = canC ? Math.max(0, Math.min(PA - spC - r.hb, p.sippEq + p.acn)) : 0;
      const dA = canA ? Math.max(0, Math.min(PA - spA, p.abbyDC)) : 0;
      const takeC = Math.min(dC, p.sippEq); p.sippEq -= takeC; p.acn -= dC - takeC;
      p.abbyDC -= dA; r.drawC = dC; r.drawA = dA;
      r.tax = personTax(a, (spC + r.hb + dC) * 1000) / 1000 + personTax(a, (spA + dA) * 1000) / 1000;
      const cashIn = (year <= LAST_ISA_RUNG ? r.ladder : 0) + r.hb + r.sp + dC + dA;
      const net = cashIn - SPEND - r.tax;
      if (net < 0) {
        let short = -net;
        const uC = Math.min(short, tfcC, p.sippEq + p.acn); tfcC -= uC; short -= uC; r.tfc += uC;
        const tC = Math.min(uC, p.sippEq); p.sippEq -= tC; p.acn -= uC - tC;
        const uA = Math.min(short, tfcA, p.abbyDC); tfcA -= uA; p.abbyDC -= uA; short -= uA; r.tfc += uA;
        const uI = Math.min(short, p.isaEqNew + p.abbyIsaEq); r.isaSell = uI; const t1 = Math.min(uI, p.isaEqNew); p.isaEqNew -= t1; p.abbyIsaEq -= uI - t1; short -= uI;
        const uG = Math.min(short, p.gia); p.gia -= uG; short -= uG;
        const uCash = Math.min(short, Math.max(0, p.cash - CASH_FLOOR)); p.cash -= uCash; short -= uCash;
        if (short > 0) {
          const br = a.tax.basicRate;
          const gross = short / (1 - br); const gC = Math.min(gross, p.sippEq + p.acn); const tC2 = Math.min(gC, p.sippEq); p.sippEq -= tC2; p.acn -= gC - tC2;
          const gA = Math.min(gross - gC, p.abbyDC); p.abbyDC -= gA; r.taxedDraw = gC + gA; r.tax += br * (gC + gA); short -= (1 - br) * (gC + gA);
          p.cash -= short;
        }
      } else {
        r.surplus = net;
        const toIsa = year <= LAST_ISA_RUNG ? net : Math.min(net, ISA_CAP); p.isaEqNew += toIsa; p.gia += net - toIsa;
      }
      lifeTax += r.tax;
    }
    const ladder = p.isaLadC + p.isaLadA + p.sippLad;
    const pensionEq = p.sippEq + p.acn + p.abbyDC;
    const isaEq = p.abbyIsaEq + p.isaEqNew;
    const total = ladder + pensionEq + isaEq + p.gia + p.cash + p.crypto + p.shares;
    rows.push({ ...r, ...Object.fromEntries(Object.entries(p).map(([key, v]) => [key, +v.toFixed(1)])), ladder: r.ladder, ladderBal: +ladder.toFixed(1), pensionEq: +pensionEq.toFixed(1), isaEq: +isaEq.toFixed(1), total: +total.toFixed(1), tfcC: +tfcC.toFixed(1), tfcA: +tfcA.toFixed(1) });
  }
  const at = (/** @type {number} */ y) => rows.find((r) => r.year === y);
  return {
    G, baseYear: BASE, yieldsAsOf: yields.asOf, avcSchedule, payrollReal,
    wrappers: Object.fromEntries(Object.entries(wrappers).map(([w, x]) => [w, { budget: x.budget, R: x.R, irr: x.irr, flows: x.flows, rungs: x.rungs.map((r) => ({ y: r.y, epic: r.epic, cpn: r.cpn, yld: r.yld, mult: r.mult, price: r.price, cost: x.R * r.mult * r.price })) }])),
    rows, lifeTax,
    headline: { atRetirement: at(RETIRE)?.total, atLastRung: at(LAST_RUNG)?.total, atEnd: rows[rows.length - 1]?.total, firstCashNegative: rows.find((r) => r.cash < 0)?.year ?? null },
  };
}
