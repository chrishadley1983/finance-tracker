// Variant E, account-level year-by-year. Real £k. ACN stays at L&G (3 Sep 2026 refinement).
//
// 20 Sep 2026 revisions (audit):
//  - the ladder is modelled as REAL LINKERS — each rung redeems R_w (what the wrapper's budget buys at
//    live yields, coupon-inclusive prices) and pays its coupons out every year on top. The 3 Sep version
//    accrued a zero-coupon annuity paying X=107.8 while the doc ALSO described "£8k/yr of coupons on top".
//  - growth was applied before the first (2026) row, shifting every balance a year early; row 2026 is now
//    the 1 Sep 2026 balances and growth/accrual apply from 2027.
//  - phase 1: every planning number now comes from plan/assumptions.json (via the loader) and the rung
//    yields from plan/observations/gilt-yields/<date>.json. The AVC schedule is computed from the payslip
//    assumptions with the same arithmetic as lib/plan/pivot.ts (npm run plan:check cross-checks them).
//    This script folds into plan/engine/ledger.mjs in phase 2.
//
// Usage: node scripts/ifa-e-yearly.mjs [G] [--json] [--yields plan/observations/gilt-yields/2026-09-20.json]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readAssumptionsFile } from '../plan/inputs/assumptions.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const A = (await readAssumptionsFile()).values;
const yieldsPath = opt('yields', fileURLToPath(new URL('../plan/observations/gilt-yields/2026-09-20.json', import.meta.url)));
const YIELDS = JSON.parse(fs.readFileSync(yieldsPath, 'utf8'));

const k = (x) => x / 1000; // £ → £k real
const PA = k(A.tax.personalAllowance), BASIC = k(A.tax.higherRateFloor), TFC_CAP = k(A.drawdown.tfcCapEach);
const SPEND = k(A.spend.retirementTarget), HB = k(A.income.hbPostRetirement), BASE = 2026;
const RETIRE = A.dates.planRetirementYear, END = A.dates.simulationEndYear;
const CHRIS_PENSION_YEAR = A.dates.chrisPensionAccessYear + 1, ABBY_PENSION_YEAR = A.dates.abbyPensionAccessYear;
const CHRIS_SP_YEAR = A.dates.chrisStatePensionYear + 1, ABBY_SP_YEAR = A.dates.abbyStatePensionYear + 1;
const SP_EACH = k(A.statePension.annualEach), CASH_FLOOR = k(A.ledger.cashFloor), ISA_CAP = k(A.ledger.isaAllowanceCouple);
const CASH_G = A.returns.cashReal;
const LAST_ISA_RUNG = 2040, FIRST_SIPP_RUNG = 2041, LAST_RUNG = A.ladder.lastYear;

// AVC schedule: extra sacrifice to land at the £60k modelled target each tax year (same arithmetic as
// lib/plan/pivot.ts pivotYear: package − existing 4.5% − target), plus the existing payroll contributions.
const P = A.payslip;
const payrollReal = k(P.basicAnnual * (P.employerRate + P.existingEeRate));
const avcSchedule = Array.from({ length: A.pivot.years }, (_, i) => {
  const basic = P.basicAnnual * Math.pow(1 + P.payGrowth, i);
  const aniBefore = basic + basic * P.bonusRate + P.carAllowance + P.medicalBik - basic * P.existingEeRate;
  return Math.max(0, aniBefore - A.hicbc.lowerThreshold) / 1000;
});
const AVC = avcSchedule.map((x) => x + payrollReal);

// Ladder: per-wrapper redemption sized by budget at the observed yields (coupon-inclusive prices).
const ISA_BUDGET = k(A.ladder.isaBudgetReal), SIPP_BUDGET = k(A.ladder.sippBudgetReal);
const RUNGS = YIELDS.rungs.map((r) => ({ ...r }));
const annuity = (n, r) => (r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r);
for (const r of RUNGS) { r.n = r.y - BASE; r.price = r.cpn * annuity(r.n, r.yld) + Math.pow(1 + r.yld, -r.n); }
const wrappers = {};
for (const w of ['isa', 'sipp']) {
  const rs = RUNGS.filter((r) => r.w === w);
  const budget = w === 'isa' ? ISA_BUDGET : SIPP_BUDGET;
  const R = budget / rs.reduce((s, r) => s + r.mult * r.price, 0);
  const payYears = w === 'isa' ? range(A.ladder.firstYear, LAST_ISA_RUNG) : range(FIRST_SIPP_RUNG, LAST_RUNG);
  const flows = {};
  for (let y = BASE + 1; y <= LAST_RUNG; y++) {
    let c = 0; for (const r of rs) if (r.y >= y) c += R * r.mult * r.cpn;
    flows[y] = { coupon: c, redemption: payYears.includes(y) ? R : 0 };
  }
  let lo = 0, hi = 0.05;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; let pv = 0; for (const [y, f] of Object.entries(flows)) pv += (f.coupon + f.redemption) / Math.pow(1 + mid, Number(y) - BASE); if (pv > budget) lo = mid; else hi = mid; }
  wrappers[w] = { budget, R, flows, irr: (lo + hi) / 2, rungs: rs };
}
function range(a, b) { const out = []; for (let y = a; y <= b; y++) out.push(y); return out; }
const personTax = (t) => A.tax.basicRate * Math.max(0, Math.min(t, BASIC) - PA) + A.tax.higherRate * Math.max(0, t - BASIC);

function run(G) {
  let p = {
    isaLadC: k(A.pots.chrisIiIsa), isaLadA: k(A.ladder.abbyIiIsaTransfer), sippLad: SIPP_BUDGET,
    sippEq: k(A.ladder.sippEquityRetained), acn: k(A.pots.chrisAccenturePension), abbyDC: k(A.pots.abbyAccentureDc),
    abbyIsaEq: k(A.pots.abbyVanguardIsa - A.ladder.abbyIiIsaTransfer), isaEqNew: 0, gia: 0,
    cash: k(A.pots.cashBuffer), crypto: k(A.pots.crypto), shares: k(A.pots.accentureShares),
  };
  let tfcC = TFC_CAP, tfcA = TFC_CAP, lifeTax = 0;
  const rows = [];
  for (let year = BASE, yi = 0; year <= END; year++, yi++) {
    let r = { year, ladder: 0, coupons: 0, hb: 0, sp: 0, drawC: 0, drawA: 0, tfc: 0, tax: 0, spend: 0, surplus: 0, isaSell: 0 };
    if (year > BASE) {
      for (const key of ['sippEq', 'acn', 'abbyDC', 'abbyIsaEq', 'isaEqNew', 'gia', 'crypto', 'shares']) p[key] *= 1 + G;
      p.cash *= 1 + CASH_G;
      p.isaLadC *= 1 + wrappers.isa.irr; p.isaLadA *= 1 + wrappers.isa.irr; p.sippLad *= 1 + wrappers.sipp.irr;
      const fi = wrappers.isa.flows[year] ?? { coupon: 0, redemption: 0 };
      const fs_ = wrappers.sipp.flows[year] ?? { coupon: 0, redemption: 0 };
      const isaOut = Math.min(fi.coupon + fi.redemption, Math.max(0, p.isaLadC + p.isaLadA));
      const share = p.isaLadC + p.isaLadA > 0 ? p.isaLadC / (p.isaLadC + p.isaLadA) : 0;
      p.isaLadC -= isaOut * share; p.isaLadA -= isaOut * (1 - share);
      const sippOut = Math.min(fs_.coupon + fs_.redemption, Math.max(0, p.sippLad));
      p.sippLad -= sippOut;
      r.coupons = fi.coupon + fs_.coupon;
      if (year < RETIRE) { p.isaEqNew += isaOut; p.sippEq += sippOut; } // pre-retirement coupons reinvested in-wrapper
      else if (year <= LAST_ISA_RUNG) { r.ladder = isaOut; p.sippEq += sippOut; } // ISA rung + coupons = the year's ISA cash
      else { r.ladder = sippOut; p.sippEq += sippOut; } // SIPP rungs mature inside the pension
      if (year === FIRST_SIPP_RUNG) { p.isaEqNew += Math.max(p.isaLadC + p.isaLadA, 0); p.isaLadC = 0; p.isaLadA = 0; }
      if (year === LAST_RUNG + 1) { p.sippEq += Math.max(p.sippLad, 0); p.sippLad = 0; }
    }
    if (year > BASE && year <= RETIRE) p.abbyDC += AVC[yi - 1]; // 2026/27..2034/35 land in rows 2027..2035
    if (year >= RETIRE) {
      r.spend = SPEND;
      r.hb = year <= A.dates.chrisPensionAccessYear ? HB : 0;
      const spC = year >= CHRIS_SP_YEAR ? SP_EACH : 0, spA = year >= ABBY_SP_YEAR ? SP_EACH : 0; r.sp = spC + spA;
      const canC = year >= CHRIS_PENSION_YEAR, canA = year >= ABBY_PENSION_YEAR;
      let dC = canC ? Math.max(0, Math.min(PA - spC - r.hb, p.sippEq + p.acn)) : 0;
      let dA = canA ? Math.max(0, Math.min(PA - spA, p.abbyDC)) : 0;
      const takeC = Math.min(dC, p.sippEq); p.sippEq -= takeC; p.acn -= (dC - takeC);
      p.abbyDC -= dA; r.drawC = dC; r.drawA = dA;
      r.tax = personTax(spC + r.hb + dC) + personTax(spA + dA);
      const cashIn = (year <= LAST_ISA_RUNG ? r.ladder : 0) + r.hb + r.sp + dC + dA;
      let net = cashIn - SPEND - r.tax;
      if (net < 0) {
        let short = -net;
        const uC = Math.min(short, tfcC, p.sippEq + p.acn); tfcC -= uC; short -= uC; r.tfc += uC;
        const tC = Math.min(uC, p.sippEq); p.sippEq -= tC; p.acn -= (uC - tC);
        const uA = Math.min(short, tfcA, p.abbyDC); tfcA -= uA; p.abbyDC -= uA; short -= uA; r.tfc += uA;
        const uI = Math.min(short, p.isaEqNew + p.abbyIsaEq); r.isaSell = uI; const t1 = Math.min(uI, p.isaEqNew); p.isaEqNew -= t1; p.abbyIsaEq -= (uI - t1); short -= uI;
        const uG = Math.min(short, p.gia); p.gia -= uG; short -= uG;
        const uCash = Math.min(short, Math.max(0, p.cash - CASH_FLOOR)); p.cash -= uCash; short -= uCash;
        if (short > 0) {
          const gross = short / (1 - A.tax.basicRate); const gC = Math.min(gross, p.sippEq + p.acn); const tC2 = Math.min(gC, p.sippEq); p.sippEq -= tC2; p.acn -= (gC - tC2);
          const gA = Math.min(gross - gC, p.abbyDC); p.abbyDC -= gA; r.taxedDraw = gC + gA; r.tax += A.tax.basicRate * (gC + gA); short -= (1 - A.tax.basicRate) * (gC + gA);
          p.cash -= short; }
      } else { r.surplus = net;
        const toIsa = year <= LAST_ISA_RUNG ? net : Math.min(net, ISA_CAP); p.isaEqNew += toIsa; p.gia += net - toIsa; }
      lifeTax += r.tax;
    }
    const ladder = p.isaLadC + p.isaLadA + p.sippLad;
    const pensionEq = p.sippEq + p.acn + p.abbyDC;
    const isaEq = p.abbyIsaEq + p.isaEqNew;
    const total = ladder + pensionEq + isaEq + p.gia + p.cash + p.crypto + p.shares;
    rows.push({ ...r, ...Object.fromEntries(Object.entries(p).map(([key, v]) => [key, +v.toFixed(1)])), ladder: r.ladder, ladderBal: +ladder.toFixed(1), total: +total.toFixed(1), tfcC: +tfcC.toFixed(1), tfcA: +tfcA.toFixed(1) });
  }
  return { rows, lifeTax };
}

const G = +(args.find((a) => !a.startsWith('--') && !/\.json$/.test(a)) ?? A.returns.realEquity.planning);
const { rows, lifeTax } = run(G);
if (args.includes('--json')) {
  console.log(JSON.stringify({ G, avcSchedule, payrollReal, wrappers: Object.fromEntries(Object.entries(wrappers).map(([w, x]) => [w, { budget: x.budget, R: x.R, irr: x.irr, rungs: x.rungs.map((r) => ({ y: r.y, epic: r.epic, cpn: r.cpn, yld: r.yld, mult: r.mult, price: r.price, cost: x.R * r.mult * r.price })), flows: x.flows }])), rows, lifeTax }));
  process.exit(0);
}
const f = (n) => (n === 0 || n === undefined ? '-' : Math.round(n));
console.log(`G=${G}  (assumptions prepared ${(await readAssumptionsFile()).preparedOn}; yields ${YIELDS.asOf})`);
for (const w of ['isa', 'sipp']) console.log(`${w.toUpperCase()} ladder: budget ${wrappers[w].budget.toFixed(1)}k → redemption ${wrappers[w].R.toFixed(1)}k per rung-year, portfolio real IRR ${(wrappers[w].irr * 100).toFixed(2)}%`);
console.log('AVC extra sacrifice £k by programme year: ' + avcSchedule.map((x) => x.toFixed(1)).join(', ') + ` (+ payroll ${payrollReal.toFixed(1)})`);
console.log('rung|epic|yield|price/£1|cost £k|redeems £k real');
for (const w of ['isa', 'sipp']) for (const r of wrappers[w].rungs) console.log([r.y, r.epic, (r.yld * 100).toFixed(2) + '%', r.price.toFixed(4), (wrappers[w].R * r.mult * r.price).toFixed(1), (wrappers[w].R * r.mult).toFixed(1)].join('|'));
console.log('coupons (real £k/yr): ' + Object.keys(wrappers.isa.flows).map((y) => `${y}:${(wrappers.isa.flows[y].coupon + (wrappers.sipp.flows[y]?.coupon ?? 0)).toFixed(1)}`).join(' '));
console.log('year|ISAladC|ISAladA|SIPPlad|SIPPeq|ACN|AbbyDC|AbbyISAeq|ISAeqNew|GIA|cash|crypto|TOTAL||rung+cpn|HB|SP|drawC|drawA|TFC|tax|surplus|taxedDraw');
for (const r of rows) console.log([r.year, f(r.isaLadC), f(r.isaLadA), f(r.sippLad), f(r.sippEq), f(r.acn), f(r.abbyDC), f(r.abbyIsaEq), f(r.isaEqNew), f(r.gia), f(r.cash), f(r.crypto), f(r.total), '', f(r.ladder), f(r.hb), f(r.sp), f(r.drawC), f(r.drawA), f(r.tfc), r.tax.toFixed(1), f(r.surplus), f(r.taxedDraw)].join('|'));
console.log('lifetime tax', lifeTax.toFixed(1));
