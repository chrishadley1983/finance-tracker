// Variant E, account-level year-by-year. Real £k. ACN stays at L&G (3 Sep 2026 refinement).
//
// 20 Sep 2026 revision (audit): the ladder is now modelled as REAL LINKERS — each rung
// redeems R_w (what the wrapper's budget buys at live yields, coupon-inclusive prices)
// and pays its coupons out every year on top. The 3 Sep version accrued a zero-coupon
// annuity paying X=107.8 and the doc ALSO described "£8k/yr of coupons on top", which
// double counted the coupons in prose (not in the totals). Also fixed: growth was applied
// before the first (2026) row, shifting every balance a year early; row 2026 is now the
// 1 Sep 2026 balances and growth/accrual apply from 2027.
//
// Usage: node scripts/ifa-e-yearly.mjs [G] [--json]   (G = real equity return, default 0.02)
const PA = 12.57, BASIC = 50.27, TFC_CAP = 268.275, SPEND = 60, HB = 13, BASE = 2026;
// Extra AVC per tax year 2026/27..2034/35 at the £60k model target, from lib/plan/pivot.ts pivotProgramme(60_000)
// on the Aug 2026 payslip (basic £73,837.80, 2% growth) — rebased 20 Sep 2026 (was the April-basis 18.08..30.138);
// plus the existing 11% + 4.5% payroll contributions (£11.4k at the Aug basic). MUST match pivot.ts until the engine is unified.
const AVC = [22.037, 23.521, 25.035, 26.579, 28.154, 29.761, 31.399, 33.071, 34.775].map(x => x + 11.445);
const ISA_BUDGET = 276.7 + 242.8, SIPP_BUDGET = 389.9; // Chris II ISA + Abby II ISA; Chris II SIPP

// Rungs at live real yields (dividenddata, 17–20 Sep 2026). mult 1.5 = also carries half of 2043.
// price per £1 real redemption (annual-coupon approx) = cpn·a(n,y) + (1+y)^-n, n = years from 2026.
const RUNGS = [
  { y: 2035, w: 'isa', epic: 'TR35', cpn: 0.01125, yld: 0.0177, mult: 1 },
  { y: 2036, w: 'isa', epic: 'TG36', cpn: 0.00125, yld: 0.0189, mult: 1 },
  { y: 2037, w: 'isa', epic: 'TR37', cpn: 0.01125, yld: 0.0198, mult: 1 },
  { y: 2038, w: 'isa', epic: 'T38', cpn: 0.0175, yld: 0.0205, mult: 1 },
  { y: 2039, w: 'isa', epic: 'TG39', cpn: 0.00125, yld: 0.0213, mult: 1 },
  { y: 2040, w: 'isa', epic: 'TR40', cpn: 0.00625, yld: 0.0215, mult: 1 },
  { y: 2041, w: 'sipp', epic: 'T41', cpn: 0.00125, yld: 0.0219, mult: 1 },
  { y: 2042, w: 'sipp', epic: 'T42A', cpn: 0.00625, yld: 0.0225, mult: 1.5 },
  { y: 2044, w: 'sipp', epic: 'T44', cpn: 0.00125, yld: 0.0233, mult: 1.5 },
  { y: 2045, w: 'sipp', epic: 'TR45', cpn: 0.00625, yld: 0.0236, mult: 1 },
];
const annuity = (n, r) => (r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r);
for (const r of RUNGS) { r.n = r.y - BASE; r.price = r.cpn * annuity(r.n, r.yld) + Math.pow(1 + r.yld, -r.n); }
const wrappers = {};
for (const w of ['isa', 'sipp']) {
  const rs = RUNGS.filter(r => r.w === w);
  const budget = w === 'isa' ? ISA_BUDGET : SIPP_BUDGET;
  const R = budget / rs.reduce((s, r) => s + r.mult * r.price, 0); // redemption per rung-year
  // annual real flows from 2027: coupons on outstanding face + redemptions (2043 paid from the T42A/T44 halves)
  const payYears = w === 'isa' ? [2035, 2036, 2037, 2038, 2039, 2040] : [2041, 2042, 2043, 2044, 2045];
  const flows = {};
  for (let y = BASE + 1; y <= 2045; y++) {
    let c = 0; for (const r of rs) if (r.y >= y) c += R * r.mult * r.cpn;
    flows[y] = { coupon: c, redemption: payYears.includes(y) ? R : 0 };
  }
  // portfolio IRR on integer-year flows so the accrual balance runs to ~0 at the last rung
  let lo = 0, hi = 0.05;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; let pv = 0; for (const [y, f] of Object.entries(flows)) pv += (f.coupon + f.redemption) / Math.pow(1 + mid, Number(y) - BASE); if (pv > budget) lo = mid; else hi = mid; }
  wrappers[w] = { budget, R, flows, irr: (lo + hi) / 2, rungs: rs };
}
const personTax = t => 0.2 * Math.max(0, Math.min(t, BASIC) - PA) + 0.4 * Math.max(0, t - BASIC);

function run(G) {
  let p = { isaLadC: 276.7, isaLadA: 242.8, sippLad: 389.9, sippEq: 49.7, acn: 192.7, abbyDC: 282.9, abbyIsaEq: 69.8, isaEqNew: 0, gia: 0, cash: 66, crypto: 54, shares: 2 };
  let tfcC = TFC_CAP, tfcA = TFC_CAP, lifeTax = 0;
  const rows = [];
  for (let year = BASE, yi = 0; year <= 2075; year++, yi++) {
    let r = { year, ladder: 0, coupons: 0, hb: 0, sp: 0, drawC: 0, drawA: 0, tfc: 0, tax: 0, spend: 0, surplus: 0, isaSell: 0 };
    if (year > BASE) {
      for (const k of ['sippEq', 'acn', 'abbyDC', 'abbyIsaEq', 'isaEqNew', 'gia', 'crypto', 'shares']) p[k] *= 1 + G;
      p.cash *= 1.005;
      p.isaLadC *= 1 + wrappers.isa.irr; p.isaLadA *= 1 + wrappers.isa.irr; p.sippLad *= 1 + wrappers.sipp.irr;
      // ladder cash flows this year (real): coupons + any redemption, taken out of the accruing balance
      const fi = wrappers.isa.flows[year] ?? { coupon: 0, redemption: 0 };
      const fs_ = wrappers.sipp.flows[year] ?? { coupon: 0, redemption: 0 };
      const isaOut = Math.min(fi.coupon + fi.redemption, Math.max(0, p.isaLadC + p.isaLadA));
      const share = p.isaLadC + p.isaLadA > 0 ? p.isaLadC / (p.isaLadC + p.isaLadA) : 0;
      p.isaLadC -= isaOut * share; p.isaLadA -= isaOut * (1 - share);
      const sippOut = Math.min(fs_.coupon + fs_.redemption, Math.max(0, p.sippLad));
      p.sippLad -= sippOut;
      r.coupons = fi.coupon + fs_.coupon;
      if (year < 2035) { p.isaEqNew += isaOut; p.sippEq += sippOut; } // pre-retirement coupons reinvested in-wrapper
      else if (year <= 2040) { r.ladder = isaOut; p.sippEq += sippOut; } // ISA rung + coupons = the year's ISA cash
      else { r.ladder = sippOut; p.sippEq += sippOut; } // SIPP rungs mature inside the pension
      if (year === 2041) { p.isaEqNew += Math.max(p.isaLadC + p.isaLadA, 0); p.isaLadC = 0; p.isaLadA = 0; }
      if (year === 2046) { p.sippEq += Math.max(p.sippLad, 0); p.sippLad = 0; }
    }
    if (year > BASE && year <= 2035) p.abbyDC += AVC[yi - 1]; // 2026/27..2034/35 land in rows 2027..2035
    if (year >= 2035) {
      r.spend = SPEND;
      r.hb = year <= 2040 ? HB : 0;
      const spC = year >= 2052 ? 12.5 : 0, spA = year >= 2055 ? 12.5 : 0; r.sp = spC + spA;
      const canC = year >= 2041, canA = year >= 2043;
      let dC = canC ? Math.max(0, Math.min(PA - spC - r.hb, p.sippEq + p.acn)) : 0;
      let dA = canA ? Math.max(0, Math.min(PA - spA, p.abbyDC)) : 0;
      const takeC = Math.min(dC, p.sippEq); p.sippEq -= takeC; p.acn -= (dC - takeC);
      p.abbyDC -= dA; r.drawC = dC; r.drawA = dA;
      r.tax = personTax(spC + r.hb + dC) + personTax(spA + dA);
      const cashIn = (year <= 2040 ? r.ladder : 0) + r.hb + r.sp + dC + dA;
      let net = cashIn - SPEND - r.tax;
      if (net < 0) {
        let short = -net;
        const uC = Math.min(short, tfcC, p.sippEq + p.acn); tfcC -= uC; short -= uC; r.tfc += uC;
        const tC = Math.min(uC, p.sippEq); p.sippEq -= tC; p.acn -= (uC - tC);
        const uA = Math.min(short, tfcA, p.abbyDC); tfcA -= uA; p.abbyDC -= uA; short -= uA; r.tfc += uA;
        const uI = Math.min(short, p.isaEqNew + p.abbyIsaEq); r.isaSell = uI; const t1 = Math.min(uI, p.isaEqNew); p.isaEqNew -= t1; p.abbyIsaEq -= (uI - t1); short -= uI;
        const uG = Math.min(short, p.gia); p.gia -= uG; short -= uG;
        const uCash = Math.min(short, Math.max(0, p.cash - 30)); p.cash -= uCash; short -= uCash;
        if (short > 0) {
          const gross = short / 0.8; const gC = Math.min(gross, p.sippEq + p.acn); const tC2 = Math.min(gC, p.sippEq); p.sippEq -= tC2; p.acn -= (gC - tC2);
          const gA = Math.min(gross - gC, p.abbyDC); p.abbyDC -= gA; r.taxedDraw = gC + gA; r.tax += 0.2 * (gC + gA); short -= 0.8 * (gC + gA);
          p.cash -= short; }
      } else { r.surplus = net;
        const toIsa = year <= 2040 ? net : Math.min(net, 40); p.isaEqNew += toIsa; p.gia += net - toIsa; }
      lifeTax += r.tax;
    }
    const ladder = p.isaLadC + p.isaLadA + p.sippLad;
    const pensionEq = p.sippEq + p.acn + p.abbyDC;
    const isaEq = p.abbyIsaEq + p.isaEqNew;
    const total = ladder + pensionEq + isaEq + p.gia + p.cash + p.crypto + p.shares;
    rows.push({ ...r, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, +v.toFixed(1)])), ladder: r.ladder, ladderBal: +ladder.toFixed(1), total: +total.toFixed(1), tfcC: +tfcC.toFixed(1), tfcA: +tfcA.toFixed(1) });
  }
  return { rows, lifeTax };
}
const args = process.argv.slice(2);
const G = +(args.find(a => !a.startsWith('--')) ?? 0.02);
const { rows, lifeTax } = run(G);
if (args.includes('--json')) {
  console.log(JSON.stringify({ G, wrappers: Object.fromEntries(Object.entries(wrappers).map(([w, x]) => [w, { budget: x.budget, R: x.R, irr: x.irr, rungs: x.rungs.map(r => ({ y: r.y, epic: r.epic, cpn: r.cpn, yld: r.yld, mult: r.mult, price: r.price, cost: x.R * r.mult * r.price })), flows: x.flows }])), rows, lifeTax }));
  process.exit(0);
}
const f = n => (n === 0 || n === undefined) ? '-' : Math.round(n);
console.log(`G=${G}`);
for (const w of ['isa', 'sipp']) console.log(`${w.toUpperCase()} ladder: budget ${wrappers[w].budget.toFixed(1)}k → redemption ${wrappers[w].R.toFixed(1)}k per rung-year, portfolio real IRR ${(wrappers[w].irr * 100).toFixed(2)}%`);
console.log('rung|epic|yield|price/£1|cost £k|redeems £k real');
for (const w of ['isa', 'sipp']) for (const r of wrappers[w].rungs) console.log([r.y, r.epic, (r.yld * 100).toFixed(2) + '%', r.price.toFixed(4), (wrappers[w].R * r.mult * r.price).toFixed(1), (wrappers[w].R * r.mult).toFixed(1)].join('|'));
console.log('coupons (real £k/yr): ' + Object.keys(wrappers.isa.flows).map(y => `${y}:${(wrappers.isa.flows[y].coupon + (wrappers.sipp.flows[y]?.coupon ?? 0)).toFixed(1)}`).join(' '));
console.log('year|ISAladC|ISAladA|SIPPlad|SIPPeq|ACN|AbbyDC|AbbyISAeq|ISAeqNew|GIA|cash|crypto|TOTAL||rung+cpn|HB|SP|drawC|drawA|TFC|tax|surplus|taxedDraw');
for (const r of rows) console.log([r.year, f(r.isaLadC), f(r.isaLadA), f(r.sippLad), f(r.sippEq), f(r.acn), f(r.abbyDC), f(r.abbyIsaEq), f(r.isaEqNew), f(r.gia), f(r.cash), f(r.crypto), f(r.total), '', f(r.ladder), f(r.hb), f(r.sp), f(r.drawC), f(r.drawA), f(r.tfc), r.tax.toFixed(1), f(r.surplus), f(r.taxedDraw)].join('|'));
console.log('lifetime tax', lifeTax.toFixed(1));
