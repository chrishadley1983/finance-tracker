// Max floor back-end tax simulation. Real terms, £k, 2% planning case.
// Wrappers: bridge gilts (ISA+GIA, pays 2035-40), Chris SIPP (gilts 2041-45
// + recycled surpluses), Abby DC (equity + AVC), ISA equity, GIA, cash.
// Tax: PA 12.57, basic to 50.27 (frozen real), 20%/40%; TFC cap 268.275 each;
// IHT: NRB 650 joint, RNRB 350 joint tapered £1/£2 over £2M estate; pensions
// in estate (post Apr-2027 rules); beneficiary income tax on inherited
// pension (death after 75) at 20% or 40%.
// Strategies:
//  S1 minTax  — taxable draws only to fill PA; then TFC; then ISA (July-doc style)
//  S2 band    — taxable draws to top of basic band; excess -> ISA (40/yr) then GIA
//  S3 gift    — as S2 but excess beyond ISA allowance is gifted (out of estate)

const G = 0.02, IRR = 0.0193;
const PA = 12.57, BASIC = 50.27, TFC_CAP = 268.275;
const AVC = [18.08, 19.484, 20.918, 22.379, 23.87, 25.391, 26.942, 28.525, 30.138].map(x => x + 10.8);
// annuity-consistent payouts (coupons folded in): bridge £531k -> 2035-40; SIPP £625k -> 2041-45
let af1 = 0; for (let t = 9; t <= 14; t++) af1 += Math.pow(1 + IRR, -t);
let af2 = 0; for (let t = 15; t <= 19; t++) af2 += Math.pow(1 + IRR, -t);
const X1 = 531 / af1, X2 = 625 / af2;

function personTax(taxable) {
  return 0.2 * Math.max(0, Math.min(taxable, BASIC) - PA) + 0.4 * Math.max(0, taxable - BASIC);
}

function run(strategy, benRate) {
  let bridge = 531, sippG = 625, sippE = 0, abby = 273, isaE = 100, gia = 0, cash = 60;
  let tfcC = TFC_CAP, tfcA = TFC_CAP, lifeTax = 0, gifted = 0, fail = false;
  let taxByEra = { '2035-45': 0, '2046-60': 0, '2061-75': 0 };
  for (let year = 2026, yi = 0; year <= 2075; year++, yi++) {
    // growth
    isaE *= 1 + G; gia *= 1 + G; sippE *= 1 + G; abby *= 1 + G; cash *= 1.005;
    bridge *= 1 + IRR; sippG *= 1 + IRR;
    if (year < 2035) { abby += AVC[yi]; continue; }
    // ladder payouts
    let isaCash = 0;
    if (year <= 2040) { bridge -= X1; isaCash += X1; }
    if (year >= 2041 && year <= 2045) { sippG -= X2; sippE += X2; }
    if (year === 2041 && bridge > 0) { isaE += bridge; bridge = 0; }
    if (year === 2046 && sippG > 0) { sippE += sippG; sippG = 0; }
    const hb = year <= 2040 ? 13 : 0;
    const spC = year >= 2052 ? 12.5 : 0, spA = year >= 2055 ? 12.5 : 0;
    const canC = year >= 2041, canA = year >= 2043;
    // taxable pension draws per strategy
    const target = strategy === 'S1' ? PA : BASIC;
    let dC = canC ? Math.max(0, Math.min(target - spC - hb, sippE)) : 0;
    let dA = canA ? Math.max(0, Math.min(target - spA, abby)) : 0;
    sippE -= dC; abby -= dA;
    let tax = personTax(spC + hb + dC) + personTax(spA + dA);
    let inflow = isaCash + hb + spC + spA + dC + dA;
    let net = inflow - 60 - tax;
    if (net < 0) {
      // shortfall: TFC first (S1), then ISA, then GIA, then cash
      let short = -net;
      const useTfcC = Math.min(short, tfcC, sippE); tfcC -= useTfcC; sippE -= useTfcC; short -= useTfcC;
      const useTfcA = Math.min(short, tfcA, abby); tfcA -= useTfcA; abby -= useTfcA; short -= useTfcA;
      const useIsa = Math.min(short, isaE); isaE -= useIsa; short -= useIsa;
      const useGia = Math.min(short, gia); gia -= useGia; short -= useGia;
      cash -= short; if (cash < 0) fail = true;
    } else if (net > 0) {
      const toIsa = Math.min(net, 40); isaE += toIsa; net -= toIsa;
      if (strategy === 'S3') gifted += net; else gia += net;
    }
    lifeTax += tax;
    if (year <= 2045) taxByEra['2035-45'] += tax;
    else if (year <= 2060) taxByEra['2046-60'] += tax;
    else taxByEra['2061-75'] += tax;
  }
  // death 2075, both >75; house included
  const pension = sippE + Math.max(sippG, 0) + abby;
  const E = isaE + gia + cash + pension + 697;
  const rnrb = Math.max(0, 350 - Math.max(0, E - 2000) / 2);
  const iht = 0.4 * Math.max(0, E - (650 + rnrb));
  const eff = iht / E;
  const benTax = benRate * pension * (1 - eff);
  const heirs = (E - iht) - benTax + gifted;
  return { fail, lifeTax, taxByEra, isaE, gia, cash, pension, gifted, E, iht, benTax, heirs };
}

const f = n => '£' + Math.round(n) + 'k';
for (const s of ['S1', 'S2', 'S3']) {
  const r20 = run(s, 0.2), r40 = run(s, 0.4);
  const r = r40;
  console.log(`\n=== ${s === 'S1' ? 'S1 minimum-tax (July-doc style)' : s === 'S2' ? 'S2 fill basic band, keep' : 'S3 fill basic band, gift excess'} ===${r.fail ? ' FAIL' : ''}`);
  console.log(`Lifetime income tax: ${f(r.lifeTax)}  (2035-45 ${f(r.taxByEra['2035-45'])} | 2046-60 ${f(r.taxByEra['2046-60'])} | 2061-75 ${f(r.taxByEra['2061-75'])})`);
  console.log(`At 2075: pensions ${f(r.pension)} | ISA ${f(r.isaE)} | GIA ${f(r.gia)} | cash ${f(r.cash)} | gifted ${f(r.gifted)} | estate (incl house) ${f(r.E)}`);
  console.log(`IHT: ${f(r.iht)} | beneficiary tax on pension @40%: ${f(r.benTax)} (@20%: ${f(r20.benTax)})`);
  console.log(`NET TO HEIRS: @40% ben rate ${f(r.heirs)} | @20% ${f(r20.heirs)}`);
  console.log(`Total tax all-in (@40%): ${f(r.lifeTax + r.iht + r.benTax)}`);
}
