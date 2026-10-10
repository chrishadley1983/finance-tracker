// Variant E tax simulation, year by year. Real £k, 2% real planning case.
// Wrappers at 2026: ISA gilts 519.5 (pays 107.8/yr 2035-40, tax-free),
// Chris SIPP = gilts 389.9 (pays 107.8/yr 2041-45, inside wrapper) + equity 243,
// Abby DC 282.9 + AVC schedule, ISA equity 70, cash 66. Crypto 54 kept aside
// (CGT on exit is a separate one-off, not modelled here).
// Draw strategy = July-doc S1 min-tax: taxable pension draws only to fill each
// personal allowance, then tax-free cash (cap 268.275 each), then ISA, then cash.
// Thresholds frozen in real terms (conservative): PA 12.57, basic band to 50.27.
// Simplification: TFC modelled as a cumulative allowance, not tied 25%-per-crystallisation.
// GIA dividend/CGT drag on reinvested surplus NOT modelled (see caveat in output).

const G = 0.02, IRR = 0.0193;
const PA = 12.57, BASIC = 50.27, TFC_CAP = 268.275;
const SPEND = 60, HB = 13;
const AVC = [18.08, 19.484, 20.918, 22.379, 23.87, 25.391, 26.942, 28.525, 30.138].map(x => x + 10.8);
const X = 107.8; // flat ladder payout

const personTax = t => 0.2 * Math.max(0, Math.min(t, BASIC) - PA) + 0.4 * Math.max(0, t - BASIC);

let isaG = 519.5, sippG = 389.9, sippE = 243, abby = 282.9, isaE = 70, gia = 0, cash = 66;
let tfcC = TFC_CAP, tfcA = TFC_CAP, lifeTax = 0;
const rows = [];
for (let year = 2026, yi = 0; year <= 2075; year++, yi++) {
  isaE *= 1 + G; gia *= 1 + G; sippE *= 1 + G; abby *= 1 + G; cash *= 1.005;
  isaG *= 1 + IRR; sippG *= 1 + IRR;
  if (year < 2035) { abby += AVC[yi]; continue; }

  let isaCash = 0;
  if (year <= 2040) { isaG -= X; isaCash += X; }
  if (year >= 2041 && year <= 2045) { sippG -= X; sippE += X; } // rung matures inside SIPP
  if (year === 2041 && isaG > 0) { isaE += isaG; isaG = 0; }
  if (year === 2046 && sippG > 0) { sippE += sippG; sippG = 0; }

  const hb = year <= 2040 ? HB : 0;
  const spC = year >= 2052 ? 12.5 : 0, spA = year >= 2055 ? 12.5 : 0;
  const canC = year >= 2041, canA = year >= 2043;

  let dC = canC ? Math.max(0, Math.min(PA - spC - hb, sippE)) : 0;
  let dA = canA ? Math.max(0, Math.min(PA - spA, abby)) : 0;
  sippE -= dC; abby -= dA;
  const tax = personTax(spC + hb + dC) + personTax(spA + dA);
  const inflow = isaCash + hb + spC + spA + dC + dA;
  let net = inflow - SPEND - tax;
  let tfcUsed = 0, isaUsed = 0;
  if (net < 0) {
    let short = -net;
    const uC = Math.min(short, tfcC, sippE); tfcC -= uC; sippE -= uC; short -= uC; tfcUsed += uC;
    const uA = Math.min(short, tfcA, abby); tfcA -= uA; abby -= uA; short -= uA; tfcUsed += uA;
    const uI = Math.min(short, isaE); isaE -= uI; short -= uI; isaUsed = uI;
    const uG = Math.min(short, gia); gia -= uG; short -= uG;
    cash -= short;
    net = 0;
  } else {
    const toIsa = Math.min(net, 40); isaE += toIsa; gia += net - toIsa;
  }
  lifeTax += tax;
  rows.push({ year, isaCash, hb, sp: spC + spA, dC, dA, tax, tfcUsed, isaUsed, surplus: Math.max(0, inflow - SPEND - tax) });
}

console.log('Year | ISA rung |  HB | StatePen | Pension draws C+A | TAX  | TFC used | surplus->ISA/GIA');
const f = n => n ? n.toFixed(1).padStart(6) : '     -';
let last = null;
for (const r of rows) {
  const key = JSON.stringify([Math.round(r.isaCash), Math.round(r.hb), Math.round(r.sp), Math.round(r.dC + r.dA), r.tax.toFixed(1), Math.round(r.tfcUsed), Math.round(r.surplus)]);
  if (key === last && r.year !== 2075) continue; // compress identical years
  last = key;
  console.log(`${r.year} | ${f(r.isaCash)} | ${f(r.hb)} | ${f(r.sp)} |  ${f(r.dC)} + ${f(r.dA)} | ${r.tax.toFixed(1).padStart(4)} | ${f(r.tfcUsed)} | ${f(r.surplus)}`);
}
console.log(`\nLifetime income tax 2035-2075: £${lifeTax.toFixed(0)}k (real)`);
console.log(`TFC remaining: Chris £${tfcC.toFixed(0)}k, Abby £${tfcA.toFixed(0)}k of £268k each`);
console.log(`Pots at 2075: SIPP-E £${sippE.toFixed(0)}k, Abby DC £${abby.toFixed(0)}k, ISA £${isaE.toFixed(0)}k, GIA £${gia.toFixed(0)}k, cash £${cash.toFixed(0)}k`);
const pension = sippE + abby, E = isaE + gia + cash + pension + 697;
const rnrb = Math.max(0, 350 - Math.max(0, E - 2000) / 2);
const iht = 0.4 * Math.max(0, E - (650 + rnrb));
console.log(`Estate incl. house £697k: £${E.toFixed(0)}k | IHT if both die 2075: £${iht.toFixed(0)}k | beneficiary tax on pension @20/40%: £${(0.2 * pension * (1 - iht / E)).toFixed(0)}k/£${(0.4 * pension * (1 - iht / E)).toFixed(0)}k`);
console.log('\nCaveats: GIA dividend/CGT drag on reinvested surplus not modelled (~0.5%/yr of GIA);');
console.log('thresholds frozen real = conservative; pre-2035 tax is payroll-only (Amendment 1).');
