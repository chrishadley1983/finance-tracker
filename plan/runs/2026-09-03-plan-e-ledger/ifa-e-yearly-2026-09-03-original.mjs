// Variant E, account-level year-by-year. Real £k. ACN stays at L&G (3 Sep 2026 refinement).
const IRR = 0.0193, PA = 12.57, BASIC = 50.27, TFC_CAP = 268.275, SPEND = 60, HB = 13, X = 107.8;
const AVC = [18.08, 19.484, 20.918, 22.379, 23.87, 25.391, 26.942, 28.525, 30.138].map(x => x + 10.8);
const personTax = t => 0.2 * Math.max(0, Math.min(t, BASIC) - PA) + 0.4 * Math.max(0, t - BASIC);
function run(G, opts = {}) {
  // ladder split: bridge rungs 2035-40 in ISAs (Chris 276.7 + Abby 242.8), SIPP rungs 2041-45 389.9
  let p = { isaLadC: 276.7, isaLadA: 242.8, sippLad: 389.9, sippEq: 49.7, acn: 192.7, abbyDC: 282.9, abbyIsaEq: 69.8, isaEqNew: 0, gia: 0, cash: 66, crypto: 54, shares: 2 };
  let tfcC = TFC_CAP, tfcA = TFC_CAP, lifeTax = 0;
  const rows = [];
  const bridgeTot = p.isaLadC + p.isaLadA;
  for (let year = 2026, yi = 0; year <= 2075; year++, yi++) {
    for (const k of ['sippEq','acn','abbyDC','abbyIsaEq','isaEqNew','gia','crypto','shares']) p[k] *= 1 + G;
    p.cash *= 1.005;
    for (const k of ['isaLadC','isaLadA','sippLad']) p[k] *= 1 + IRR;
    let r = { year, ladder: 0, hb: 0, sp: 0, drawC: 0, drawA: 0, tfc: 0, tax: 0, spend: 0, surplus: 0, isaSell: 0 };
    if (year < 2035) { p.abbyDC += AVC[yi]; }
    else {
      r.spend = SPEND;
      if (year <= 2040) { // bridge rung matures: draw proportionally from the two ISA ladders
        const share = p.isaLadC / (p.isaLadC + p.isaLadA);
        p.isaLadC -= X * share; p.isaLadA -= X * (1 - share); r.ladder = X;
      }
      if (year >= 2041 && year <= 2045) { p.sippLad -= X; p.sippEq += X; r.ladder = X; } // matures inside SIPP
      if (year === 2041) { p.isaEqNew += Math.max(p.isaLadC + p.isaLadA, 0); p.isaLadC = 0; p.isaLadA = 0; }
      if (year === 2046) { p.sippEq += Math.max(p.sippLad, 0); p.sippLad = 0; }
      r.hb = year <= 2040 ? HB : 0;
      const spC = year >= 2052 ? 12.5 : 0, spA = year >= 2055 ? 12.5 : 0; r.sp = spC + spA;
      const canC = year >= 2041, canA = year >= 2043;
      // Chris draws from II SIPP equity first, then ACN
      let dC = canC ? Math.max(0, Math.min(PA - spC - r.hb, p.sippEq + p.acn)) : 0;
      let dA = canA ? Math.max(0, Math.min(PA - spA, p.abbyDC)) : 0;
      const takeC = Math.min(dC, p.sippEq); p.sippEq -= takeC; p.acn -= (dC - takeC);
      p.abbyDC -= dA; r.drawC = dC; r.drawA = dA;
      r.tax = personTax(spC + r.hb + dC) + personTax(spA + dA);
      const cashIn = (year <= 2040 ? r.ladder : 0) + r.hb + r.sp + dC + dA; // SIPP rungs 2041-45 stay inside wrapper
      let net = cashIn - SPEND - r.tax;
      if (net < 0) {
        let short = -net;
        const uC = Math.min(short, tfcC, p.sippEq + p.acn); tfcC -= uC; short -= uC; r.tfc += uC;
        const tC = Math.min(uC, p.sippEq); p.sippEq -= tC; p.acn -= (uC - tC);
        const uA = Math.min(short, tfcA, p.abbyDC); tfcA -= uA; p.abbyDC -= uA; short -= uA; r.tfc += uA;
        const uI = Math.min(short, p.isaEqNew + p.abbyIsaEq); r.isaSell = uI; const t1 = Math.min(uI, p.isaEqNew); p.isaEqNew -= t1; p.abbyIsaEq -= (uI - t1); short -= uI;
        const uG = Math.min(short, p.gia); p.gia -= uG; short -= uG;
        const uCash = Math.min(short, Math.max(0, p.cash - 30)); p.cash -= uCash; short -= uCash;
        if (short > 0) { // last resort: taxed pension draw at 20%, Chris then Abby
          const gross = short / 0.8; const gC = Math.min(gross, p.sippEq + p.acn); const tC2 = Math.min(gC, p.sippEq); p.sippEq -= tC2; p.acn -= (gC - tC2);
          const gA = Math.min(gross - gC, p.abbyDC); p.abbyDC -= gA; r.taxedDraw = gC + gA; r.tax += 0.2 * (gC + gA); short -= 0.8 * (gC + gA);
          p.cash -= short; }
      } else { r.surplus = net;
        // 2035-40: rung proceeds are already inside the ISA, only the spend leaves it, so all surplus stays sheltered
        const toIsa = year <= 2040 ? net : Math.min(net, 40); p.isaEqNew += toIsa; p.gia += net - toIsa; }
      lifeTax += r.tax;
    }
    const ladder = p.isaLadC + p.isaLadA + p.sippLad;
    const pensionEq = p.sippEq + p.acn + p.abbyDC;
    const isaEq = p.abbyIsaEq + p.isaEqNew;
    const total = ladder + pensionEq + isaEq + p.gia + p.cash + p.crypto + p.shares;
    rows.push({ ...r, ...Object.fromEntries(Object.entries(p).map(([k,v])=>[k,+v.toFixed(1)])), ladder: r.ladder, ladderBal: +ladder.toFixed(1), total: +total.toFixed(1), tfcC: +tfcC.toFixed(1), tfcA: +tfcA.toFixed(1) });
  }
  return { rows, lifeTax };
}
const G = +(process.argv[2] ?? 0.02);
const { rows, lifeTax } = run(G);
const f = n => (n === 0 || n === undefined) ? '-' : Math.round(n);
console.log(`G=${G}`);
console.log('year|ISAladC|ISAladA|SIPPlad|SIPPeq|ACN|AbbyDC|AbbyISAeq|ISAeqNew|GIA|cash|crypto|TOTAL||rung|HB|SP|drawC|drawA|TFC|tax|surplus|taxedDraw');
for (const r of rows) console.log([r.year,f(r.isaLadC),f(r.isaLadA),f(r.sippLad),f(r.sippEq),f(r.acn),f(r.abbyDC),f(r.abbyIsaEq),f(r.isaEqNew),f(r.gia),f(r.cash),f(r.crypto),f(r.total),'',f(r.ladder),f(r.hb),f(r.sp),f(r.drawC),f(r.drawA),f(r.tfc),r.tax.toFixed(1),f(r.surplus),f(r.taxedDraw)].join('|'));
console.log('lifetime tax', lifeTax.toFixed(1));
