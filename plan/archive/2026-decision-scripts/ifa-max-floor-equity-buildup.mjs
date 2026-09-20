// Max-floor variant: equity (VS100) pot trajectory to 2045, decomposed by
// source. Real terms, £k. Streams:
//   seed     — £100k VS100 kept at 2026
//   abbyPot  — Abby's £273k DC (can't hold gilts; stays equity)
//   abbyCont — her contributions to Jun 2035 (baseline 10.8 + Amendment AVC)
//   coupons  — ladder coupons reinvested (declining as rungs mature)
//   surplus  — gilt redemptions beyond spending, 2035-45 (£101k ISA rungs
//              less £47k net spend; £172k avg SIPP rungs less £60k)
const AVC = [18.08, 19.484, 20.918, 22.379, 23.87, 25.391, 26.942, 28.525, 30.138]
  .map(x => x + 10.8);
// coupons/yr: full ladder ~8.1 to 2035, then drop as each rung redeems
const COUPONS = { pre: 8.1, path: [8.1, 7.0, 6.8, 5.7, 3.9, 3.8, 3.2, 3.0, 1.4, 1.4, 0.5] }; // 2035..2045
// surplus/yr: 2035-40 = 101-47 = 54 (HB 13 still running); 2041-45 = 172-60 = 112
const SURPLUS = [54, 54, 54, 54, 54, 54, 112, 112, 112, 112, 112]; // 2035..2045

function build(g) {
  const c = { seed: 100, abbyPot: 273, abbyCont: 0, coupons: 0, surplus: 0 };
  const snap = {};
  for (let year = 2026, yi = 0; year <= 2045; year++, yi++) {
    for (const k of Object.keys(c)) c[k] *= 1 + g;
    if (year < 2035) {
      c.abbyCont += AVC[yi];
      c.coupons += COUPONS.pre;
    } else {
      c.coupons += COUPONS.path[year - 2035];
      c.surplus += SURPLUS[year - 2035];
    }
    if (year === 2034) snap.at2035 = { ...c };
    if (year === 2045) snap.at2045 = { ...c };
  }
  return snap;
}

const fmt = n => '£' + Math.round(n) + 'k';
for (const g of [0.00, 0.02, 0.04]) {
  const { at2035, at2045 } = build(g);
  const t35 = Object.values(at2035).reduce((a, b) => a + b, 0);
  const t45 = Object.values(at2045).reduce((a, b) => a + b, 0);
  console.log(`\n=== ${(g * 100).toFixed(0)}% real equity growth ===`);
  console.log('Source                          @2035      @2045');
  const names = {
    seed: 'VS100 kept at start (£100k)',
    abbyPot: "Abby's existing DC (£273k)",
    abbyCont: 'Abby contributions (£313k in)',
    coupons: 'Coupons reinvested (~£50k in)',
    surplus: 'Gilt surplus 2035-45 (£884k in)',
  };
  for (const k of Object.keys(names))
    console.log(`${names[k].padEnd(32)} ${fmt(at2035[k]).padStart(7)}    ${fmt(at2045[k]).padStart(7)}`);
  console.log(`${'TOTAL equity'.padEnd(32)} ${fmt(t35).padStart(7)}    ${fmt(t45).padStart(7)}`);
}
console.log('\nContext, plan-as-written growth sleeve (£1,020k start, same contribs+coupons on £498k ladder ~£4k/yr):');
for (const g of [0.00, 0.02, 0.04]) {
  let sleeve = 1020, cont = 0;
  for (let year = 2026, yi = 0; year <= 2045; year++, yi++) {
    sleeve *= 1 + g; cont *= 1 + g;
    if (year < 2035) cont += AVC[yi] + 4;      // AVC + small ladder coupons
    else cont += (year <= 2040 ? 13 + 4 : 0) - (year > 2045 ? 0 : 0); // HB surplus while it runs
  }
  console.log(`  ${(g * 100).toFixed(0)}% real: £${Math.round(sleeve + cont)}k at 2045`);
}
