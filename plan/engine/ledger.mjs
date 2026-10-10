// @ts-check
/**
 * Plan E account-level ledger, year by year from the base year to the
 * simulation horizon. Real £k throughout. Pure; assumptions via `a`, rung
 * yields via an observation object. See plan/engine/SPEC.md §ledger.
 *
 * Mechanics:
 *  - the ladder is real linkers: each wrapper's budget buys a redemption per
 *    rung-year at the observed yields (coupon-inclusive prices); coupons are
 *    paid out every year and reinvested in-wrapper before retirement
 *  - row BASE is the snapshot balances; growth/accrual apply from BASE+1
 *  - Abby's salary sacrifice (from the pivot arithmetic) lands in her DC pot
 *    each programme year; the rest of the household is treated as breakeven
 *    unless opts.preRetirement describes a surplus/shortfall (phase 7)
 *  - from retirement: spend + tax funded by rung cash (ISA years), HB, state
 *    pensions and pension draws once each pension opens. Drawdown strategy
 *    (a.drawdown.strategy, or opts.drawdown):
 *      'basicBand' (planning case from 23 Sep 2026): each person draws taxable pension
 *        income to the top of the basic-rate band every year, UFPLS-style (25% tax-free
 *        while the lump sum allowance lasts); shortfalls from ISA, GIA, cash to a floor,
 *        then higher-rate draws; surpluses go to ISA/GIA and are reported as giftable income
 *      'paFill' (the previous case): draws fill the personal allowance only; shortfalls
 *        take tax-free cash first (crystallising 4x it), then ISA, GIA, cash, taxed draws
 *  - today's money throughout: nominal amounts are deflated by a.returns.cpi (the AVC
 *    schedule; thresholds frozen in cash to a.tax.thresholdsFrozenThroughTaxYear; the lump
 *    sum allowance, frozen indefinitely); tax-free cash is capped at 25% of what is crystallised
 *  - the estate at the horizon carries an inheritance-tax estimate (pensions inside the
 *    estate, beneficiaries' income tax on inherited pensions; house and gifts not modelled)
 *
 * Scenario knobs (all optional, all real £ unless stated):
 *  G              flat real equity return (default a.returns.realEquity.planning)
 *  gPath          array of real equity returns per year from BASE+1 (historical replay); falls back to G
 *  spend          flat retirement spend; or spendSchedule [{ fromYear, spend }] (step-down profiles)
 *  hbPost         HB in retirement to Chris's pension access year
 *  cash, crypto   opening reserve balances (e.g. 0 / 0 = reserve already spent)
 *  preRetirement  { spend, hbTakeHome, cottrell, sideIncome } — household cash flow before retirement:
 *                 Abby's take-home (pivot) + child benefit + cottrell + sideIncome + hbTakeHome − spend,
 *                 applied each year BASE+1..RETIRE−1: shortfalls come out of cash → crypto → ISA equity,
 *                 surpluses go into ISA equity (up to the couple's allowance) then GIA
 *  extension      { budget, fromYear, toYear, source: 'acn'|'sippEq' } — buy the 'ext' rungs in the yields
 *                 file with `budget` taken from that pot at BASE (the ratchet-forward scenario)
 *  drawdown       'basicBand' | 'paFill' — overrides a.drawdown.strategy
 */
import { personTax, annuity, frozenInCash, thresholdScale } from './tax.mjs';
import { pivotProgramme, takeHomeNominal } from './pivot.mjs';

/**
 * @param {any} a  assumption values
 * @param {{ asOf: string, rungs: Array<{ y: number, w: string, epic: string, cpn: number, yld: number, mult: number }> }} yields
 * @param {{ G?: number, gPath?: number[], baseYear?: number, spend?: number, spendSchedule?: Array<{ fromYear: number, spend: number }>,
 *   hbPost?: number, cash?: number, crypto?: number,
 *   preRetirement?: { spend: number, hbTakeHome: number, cottrell?: number, sideIncome?: number },
 *   extension?: { budget: number, fromYear: number, toYear: number, source: 'acn'|'sippEq' }, drawdown?: 'basicBand'|'paFill' }} [opts]
 */
export function runLedger(a, yields, opts = {}) {
  const k = (/** @type {number} */ x) => x / 1000;
  const G = opts.G ?? a.returns.realEquity.planning;
  const BASE = opts.baseYear ?? 2026;
  const CPI = a.returns?.cpi;
  if (typeof CPI !== 'number') throw new Error('assumptions lack returns.cpi: these inputs predate engine 2026-09-23 (real-terms corrections); re-run them with the engine at their manifest git sha');
  const STRATEGY = opts.drawdown ?? a.drawdown.strategy;
  if (STRATEGY !== 'basicBand' && STRATEGY !== 'paFill') throw new Error(`unknown drawdown strategy ${STRATEGY}`);
  const PA = k(a.tax.personalAllowance), HRT = k(a.tax.higherRateFloor), LSA_NOMINAL = k(a.drawdown.tfcCapEach);
  const deflate = (/** @type {number} */ i) => Math.pow(1 + CPI, -i);
  const HB = opts.hbPost !== undefined ? k(opts.hbPost) : k(a.income.hbPostRetirement);
  const RETIRE = a.dates.planRetirementYear, END = a.dates.simulationEndYear;
  const CHRIS_PENSION_YEAR = a.dates.chrisPensionAccessYear + 1, ABBY_PENSION_YEAR = a.dates.abbyPensionAccessYear;
  const CHRIS_SP_YEAR = a.dates.chrisStatePensionYear + 1, ABBY_SP_YEAR = a.dates.abbyStatePensionYear + 1;
  const SP_EACH = k(a.statePension.annualEach), CASH_FLOOR = k(a.ledger.cashFloor), ISA_CAP = k(a.ledger.isaAllowanceCouple);
  const CASH_G = a.returns.cashReal;
  const FIRST_RUNG = a.ladder.firstYear, LAST_RUNG = a.ladder.lastYear;
  const LAST_ISA_RUNG = a.dates.chrisPensionAccessYear;
  const FIRST_SIPP_RUNG = LAST_ISA_RUNG + 1;
  const schedule = (opts.spendSchedule ?? [{ fromYear: RETIRE, spend: opts.spend ?? a.spend.retirementTarget }]).map((s) => ({ fromYear: s.fromYear, spend: k(s.spend) })).sort((x, y) => x.fromYear - y.fromYear);
  const spendFor = (/** @type {number} */ year) => { let s = schedule[0].spend; for (const e of schedule) if (year >= e.fromYear) s = e.spend; return s; };

  // AVC schedule from the pivot arithmetic (modelled to the £60k line), plus existing payroll contributions.
  const programme = pivotProgramme(a, a.hicbc.lowerThreshold);
  // The pivot works in each tax year's cash (the £60k line is frozen), so its extra sacrifice is deflated to today's money.
  const avcScheduleNominal = programme.years.map((y) => k(y.extraSacrifice));
  const avcSchedule = avcScheduleNominal.map((x, i) => x * deflate(i));
  const payrollReal = k(a.payslip.basicAnnual * (a.payslip.employerRate + a.payslip.existingEeRate));
  const AVC = avcSchedule.map((x) => x + payrollReal);

  // Pre-retirement household cash flow (phase 7). Real £k per programme year i (0 = first tax year).
  const pre = opts.preRetirement;
  const preDelta = pre ? programme.years.map((y, i) => k(takeHomeNominal(a, i, y.extraSacrifice)) * deflate(i) + k(a.childBenefit.annual2026) + k(pre.cottrell ?? 0) + k(pre.sideIncome ?? 0) + k(pre.hbTakeHome) - k(pre.spend)) : null;

  // Ladder wrappers: each buys a redemption per rung-year at the observed yields.
  const RUNGS = yields.rungs.map((r) => { const n = r.y - BASE; return { ...r, n, price: r.cpn * annuity(n, r.yld) + Math.pow(1 + r.yld, -n) }; });
  const range = (/** @type {number} */ x, /** @type {number} */ y) => { const out = []; for (let i = x; i <= y; i++) out.push(i); return out; };
  const ext = opts.extension;
  /** @type {Array<{ name: string, holder: 'isa'|'sipp', budget: number, payYears: number[], foldYear: number, keys: string[] }>} */
  const defs = [
    { name: 'isa', holder: 'isa', budget: k(a.ladder.isaBudgetReal), payYears: range(FIRST_RUNG, LAST_ISA_RUNG), foldYear: FIRST_SIPP_RUNG, keys: ['isaLadC', 'isaLadA'] },
    { name: 'sipp', holder: 'sipp', budget: k(a.ladder.sippBudgetReal), payYears: range(FIRST_SIPP_RUNG, LAST_RUNG), foldYear: LAST_RUNG + 1, keys: ['sippLad'] },
  ];
  if (ext) defs.push({ name: 'ext', holder: 'sipp', budget: k(ext.budget), payYears: range(ext.fromYear, ext.toYear), foldYear: ext.toYear + 1, keys: ['extLad'] });
  /** @type {Record<string, { budget: number, R: number, irr: number, flows: Record<number, { coupon: number, redemption: number }>, rungs: typeof RUNGS, holder: 'isa'|'sipp', payYears: number[], foldYear: number, keys: string[] }>} */
  const wrappers = {};
  for (const d of defs) {
    const rs = RUNGS.filter((r) => r.w === d.name);
    if (!rs.length) throw new Error(`no rungs with w='${d.name}' in the yields observation`);
    const R = d.budget / rs.reduce((s, r) => s + r.mult * r.price, 0);
    const lastPay = d.payYears[d.payYears.length - 1];
    /** @type {Record<number, { coupon: number, redemption: number }>} */
    const flows = {};
    for (let y = BASE + 1; y <= lastPay; y++) {
      let c = 0; for (const r of rs) if (r.y >= y) c += R * r.mult * r.cpn;
      flows[y] = { coupon: c, redemption: d.payYears.includes(y) ? R : 0 };
    }
    let lo = 0, hi = 0.05;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; let pv = 0; for (const [y, f] of Object.entries(flows)) pv += (f.coupon + f.redemption) / Math.pow(1 + mid, Number(y) - BASE); if (pv > d.budget) lo = mid; else hi = mid; }
    wrappers[d.name] = { budget: d.budget, R, irr: (lo + hi) / 2, flows, rungs: rs, holder: d.holder, payYears: d.payYears, foldYear: d.foldYear, keys: d.keys };
  }

  /** @type {Record<string, number>} */
  const p = {
    isaLadC: k(a.pots.chrisIiIsa), isaLadA: k(a.ladder.abbyIiIsaTransfer), sippLad: k(a.ladder.sippBudgetReal), extLad: ext ? k(ext.budget) : 0,
    sippEq: k(a.ladder.sippEquityRetained), acn: k(a.pots.chrisAccenturePension), abbyDC: k(a.pots.abbyAccentureDc),
    abbyIsaEq: k(a.pots.abbyVanguardIsa - a.ladder.abbyIiIsaTransfer), isaEqNew: 0, gia: 0,
    cash: opts.cash !== undefined ? k(opts.cash) : k(a.pots.cashBuffer), crypto: opts.crypto !== undefined ? k(opts.crypto) : k(a.pots.crypto), shares: k(a.pots.accentureShares),
  };
  if (ext) { p[ext.source] -= k(ext.budget); if (p[ext.source] < -1e-9) throw new Error(`extension budget exceeds ${ext.source}`); }
  // Pensions: C = Chris (II SIPP equity + Accenture; SIPP ladder cash lands in sippEq), A = Abby's DC.
  // crys = crystallised but not yet withdrawn (the drawdown fund, fully taxable when drawn), held in the liquid pot.
  // lsa = lump sum allowance left, in NOMINAL £k (frozen in cash, so worth less each year in today's money).
  const crys = { C: 0, A: 0 }, lsa = { C: LSA_NOMINAL, A: LSA_NOMINAL };
  const liquid = (/** @type {'C'|'A'} */ P) => (P === 'C' ? p.sippEq + p.acn : p.abbyDC);
  const take = (/** @type {'C'|'A'} */ P, /** @type {number} */ x) => { if (P === 'A') { p.abbyDC -= x; return; } const t = Math.min(x, Math.max(0, p.sippEq)); p.sippEq -= t; p.acn -= x - t; };
  /** Taxable pension income T for person P: drawdown fund first, then UFPLS (25% tax-free while the allowance lasts). */
  const drawTaxable = (/** @type {'C'|'A'} */ P, /** @type {number} */ T, /** @type {number} */ year) => {
    const f = frozenInCash(a, year, Infinity);
    const d = Math.max(0, Math.min(T, crys[P], liquid(P))); crys[P] -= d; take(P, d);
    let taxable = d, tfc = 0;
    const need = T - d;
    if (need > 1e-12) {
      const L = lsa[P] * f;
      const x = Math.max(0, Math.min(need / 3 <= L ? (need * 4) / 3 : need + L, liquid(P) - crys[P]));
      const t = Math.min(x / 4, L);
      take(P, x); taxable += x - t; tfc += t; lsa[P] -= t / f;
    }
    return { taxable, tfc };
  };
  /** Tax-free cash t, crystallising 4t (the other 3t joins the drawdown fund): the 'paFill' shortfall path. */
  const takeTfc = (/** @type {'C'|'A'} */ P, /** @type {number} */ want, /** @type {number} */ year) => {
    const f = frozenInCash(a, year, Infinity);
    const t = Math.max(0, Math.min(want, lsa[P] * f, (liquid(P) - crys[P]) / 4));
    take(P, t); crys[P] += 3 * t; lsa[P] -= t / f;
    return t;
  };
  let lifeTax = 0, preDrawTotal = 0, giftableTotal = 0;
  /** @type {number|null} */ let giftableFrom = null;
  /** @type {any[]} */
  const rows = [];
  for (let year = BASE, yi = 0; year <= END; year++, yi++) {
    /** @type {any} */
    const r = { year, ladder: 0, coupons: 0, hb: 0, sp: 0, drawC: 0, drawA: 0, tfc: 0, tax: 0, spend: 0, surplus: 0, isaSell: 0, taxedDraw: 0, preDelta: 0, giftable: 0 };
    if (year > BASE) {
      const g = opts.gPath ? (opts.gPath[yi - 1] ?? G) : G;
      for (const key of ['sippEq', 'acn', 'abbyDC', 'abbyIsaEq', 'isaEqNew', 'gia', 'crypto', 'shares']) p[key] *= 1 + g;
      crys.C *= 1 + g; crys.A *= 1 + g;
      p.cash *= 1 + CASH_G;
      for (const w of Object.values(wrappers)) {
        for (const key of w.keys) p[key] *= 1 + w.irr;
        const f = w.flows[year] ?? { coupon: 0, redemption: 0 };
        const bal = w.keys.reduce((s, key) => s + p[key], 0);
        const out = Math.min(f.coupon + f.redemption, Math.max(0, bal));
        for (const key of w.keys) p[key] -= bal > 0 ? out * (p[key] / bal) : 0;
        r.coupons += f.coupon;
        if (w.holder === 'isa') { if (year < RETIRE) p.isaEqNew += out; else r.ladder += out; }
        else { p.sippEq += out; if (year >= RETIRE) r.ladder += out; }
        if (year === w.foldYear) { const rest = Math.max(0, w.keys.reduce((s, key) => s + p[key], 0)); if (w.holder === 'isa') p.isaEqNew += rest; else p.sippEq += rest; for (const key of w.keys) p[key] = 0; }
      }
    }
    if (year > BASE && year <= RETIRE && yi - 1 < AVC.length) p.abbyDC += AVC[yi - 1];
    if (preDelta && year > BASE && year < RETIRE) {
      const d = preDelta[Math.min(yi - 1, preDelta.length - 1)];
      r.preDelta = d;
      if (d >= 0) { const toIsa = Math.min(d, ISA_CAP); p.isaEqNew += toIsa; p.gia += d - toIsa; }
      else {
        let short = -d; preDrawTotal += short;
        for (const key of ['cash', 'crypto', 'abbyIsaEq', 'isaEqNew', 'gia']) { const t = Math.min(short, Math.max(0, p[key])); p[key] -= t; short -= t; if (short <= 0) break; }
        if (short > 0) p.cash -= short; // reserve exhausted: shows as negative cash
      }
    }
    if (year >= RETIRE) {
      const SPEND = spendFor(year);
      r.spend = SPEND;
      r.hb = year <= a.dates.chrisPensionAccessYear ? HB : 0;
      const spC = year >= CHRIS_SP_YEAR ? SP_EACH : 0, spA = year >= ABBY_SP_YEAR ? SP_EACH : 0; r.sp = spC + spA;
      const open = { C: year >= CHRIS_PENSION_YEAR, A: year >= ABBY_PENSION_YEAR };
      const scale = thresholdScale(a, year), paR = PA * scale, hrtR = HRT * scale;
      const inc = { C: spC + r.hb, A: spA }; // each person's taxable income, £k
      const isaCash = year <= LAST_ISA_RUNG ? (wrappers.isa.flows[year] ? Math.min(r.ladder, (wrappers.isa.flows[year].coupon + wrappers.isa.flows[year].redemption)) : 0) : 0;
      let cashIn = isaCash + r.hb + r.sp;
      for (const P of /** @type {const} */ (['C', 'A'])) {
        if (!open[P]) continue;
        const T = Math.max(0, (STRATEGY === 'basicBand' ? hrtR : paR) - inc[P]);
        const { taxable, tfc } = drawTaxable(P, T, year);
        inc[P] += taxable; r.tfc += tfc; cashIn += taxable + tfc;
        if (P === 'C') r.drawC += taxable + tfc; else r.drawA += taxable + tfc;
      }
      const taxOf = () => personTax(a, inc.C * 1000, scale) / 1000 + personTax(a, inc.A * 1000, scale) / 1000;
      r.tax = taxOf();
      const net = cashIn - SPEND - r.tax;
      if (net < 0) {
        let short = -net;
        if (STRATEGY === 'paFill') {
          for (const P of /** @type {const} */ (['C', 'A'])) {
            if (!open[P] || short <= 0) continue;
            const t = takeTfc(P, short, year); short -= t; r.tfc += t;
            if (P === 'C') r.drawC += t; else r.drawA += t;
          }
        }
        const uI = Math.min(short, p.isaEqNew + p.abbyIsaEq); r.isaSell = uI; const t1 = Math.min(uI, p.isaEqNew); p.isaEqNew -= t1; p.abbyIsaEq -= uI - t1; short -= uI;
        const uG = Math.min(short, p.gia); p.gia -= uG; short -= uG;
        const uCash = Math.min(short, Math.max(0, p.cash - CASH_FLOOR)); p.cash -= uCash; short -= uCash;
        // Taxed pension draws at each person's marginal rate, one band at a time.
        for (const P of /** @type {const} */ (['C', 'A'])) {
          for (let it = 0; it < 40 && short > 1e-9 && open[P]; it++) {
            const m = inc[P] < paR ? 0 : inc[P] < hrtR ? a.tax.basicRate : a.tax.higherRate;
            const room = inc[P] < paR ? paR - inc[P] : inc[P] < hrtR ? hrtR - inc[P] : Infinity;
            const before = taxOf();
            const { taxable, tfc } = drawTaxable(P, Math.min(short / (1 - m), room), year);
            if (taxable + tfc <= 1e-12) break;
            inc[P] += taxable; r.tfc += tfc; r.taxedDraw += taxable + tfc;
            if (P === 'C') r.drawC += taxable + tfc; else r.drawA += taxable + tfc;
            const dTax = taxOf() - before; r.tax += dTax;
            short -= taxable + tfc - dTax;
          }
        }
        // short < 0: the last taxed draw overshot — it is sized as if fully taxable, but UFPLS pays 25% tax-free,
        // so it nets more than asked. That money left the pension; keep it as cash rather than dropping it.
        p.cash -= short; // short > 0: everything exhausted, shows as negative cash
      } else {
        r.surplus = net;
        const toIsa = year <= LAST_ISA_RUNG ? net : Math.min(net, ISA_CAP); p.isaEqNew += toIsa; p.gia += net - toIsa;
        // Surplus INCOME (tax-free cash and ISA rungs are capital) could be gifted under the normal-expenditure exemption.
        if (open.C || open.A) {
          r.giftable = Math.max(0, Math.min(net, inc.C + inc.A - r.tax - SPEND));
          giftableTotal += r.giftable;
          if (r.giftable > 0 && giftableFrom === null) giftableFrom = year;
        }
      }
      lifeTax += r.tax;
    }
    const ladder = p.isaLadC + p.isaLadA + p.sippLad + p.extLad;
    const pensionEq = p.sippEq + p.acn + p.abbyDC;
    const isaEq = p.abbyIsaEq + p.isaEqNew;
    const total = ladder + pensionEq + isaEq + p.gia + p.cash + p.crypto + p.shares;
    const f = frozenInCash(a, year, Infinity);
    rows.push({ ...r, ...Object.fromEntries(Object.entries(p).map(([key, v]) => [key, +v.toFixed(1)])), ladder: r.ladder, ladderBal: +ladder.toFixed(1), pensionEq: +pensionEq.toFixed(1), isaEq: +isaEq.toFixed(1), total: +total.toFixed(1), lsaC: +(lsa.C * f).toFixed(1), lsaA: +(lsa.A * f).toFixed(1), crysC: +crys.C.toFixed(1), crysA: +crys.A.toFixed(1) });
  }
  const at = (/** @type {number} */ y) => rows.find((r) => r.year === y);
  const firstNeg = rows.find((r) => r.cash < 0 || r.total < 0)?.year ?? null;
  // Estate at the horizon: both assumed to die then, spouse exemption on the first death; house and lifetime gifts not modelled.
  const last = rows[rows.length - 1];
  const estateTotal = Math.max(0, last.total);
  const pensionsEnd = Math.max(0, p.sippEq + p.acn + p.abbyDC + p.sippLad + p.extLad);
  const pensionsInEstate = END >= a.iht.pensionsInEstateFromTaxYear ? pensionsEnd : 0;
  const nilRateBands = 2 * k(a.iht.nilRateBandEach) * frozenInCash(a, END, a.iht.frozenThroughTaxYear);
  const taxableEstate = estateTotal - (pensionsEnd - pensionsInEstate);
  const iht = a.iht.rate * Math.max(0, taxableEstate - nilRateBands);
  const ihtOnPensions = taxableEstate > 0 ? iht * (pensionsInEstate / taxableEstate) : 0;
  const beneficiaryTax = a.iht.beneficiaryIncomeTaxRate * Math.max(0, pensionsEnd - ihtOnPensions);
  const estate = {
    year: END, total: +estateTotal.toFixed(1), pensions: +pensionsEnd.toFixed(1), nilRateBands: +nilRateBands.toFixed(1),
    iht: +iht.toFixed(1), beneficiaryTax: +beneficiaryTax.toFixed(1), netToHeirs: +(estateTotal - iht - beneficiaryTax).toFixed(1),
    giftableTotal: +giftableTotal.toFixed(1), giftableFrom, giftableAvg: giftableFrom === null ? 0 : +(giftableTotal / (END - giftableFrom + 1)).toFixed(1),
  };
  return {
    G, gPath: opts.gPath ? true : false, baseYear: BASE, yieldsAsOf: yields.asOf, drawdown: STRATEGY, avcSchedule, avcScheduleNominal, payrollReal,
    spendSchedule: schedule.map((s) => ({ fromYear: s.fromYear, spend: s.spend * 1000 })),
    preRetirement: pre ? { ...pre, drawTotal: +preDrawTotal.toFixed(1) } : null,
    extension: ext ? { ...ext, R: wrappers.ext.R, irr: wrappers.ext.irr } : null,
    wrappers: Object.fromEntries(Object.entries(wrappers).map(([w, x]) => [w, { budget: x.budget, R: x.R, irr: x.irr, flows: x.flows, rungs: x.rungs.map((r) => ({ y: r.y, epic: r.epic, cpn: r.cpn, yld: r.yld, mult: r.mult, price: r.price, cost: x.R * r.mult * r.price })) }])),
    rows, lifeTax, estate,
    headline: { atRetirement: at(RETIRE)?.total, atLastRung: at(LAST_RUNG)?.total, atEnd: rows[rows.length - 1]?.total, firstCashNegative: firstNeg, preRetirementDraw: pre ? +preDrawTotal.toFixed(1) : 0, iht: estate.iht, netToHeirs: estate.netToHeirs },
  };
}
