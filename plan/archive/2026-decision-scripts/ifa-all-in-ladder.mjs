// "Max floor" scenario (Chris's walk idea, Aug 2026):
// Move ALL gilt-able money into the 2035-2045 ILG ladder, keeping only
// ~£100k in VS100 (global equity) + Abby's DC pot (can't hold gilts) +
// her ongoing contributions + coupons/surpluses reinvested into equity.
//
// Compares against the plan-as-written (June 2026 + Amendment 1 adopted):
// ladder £498k, growth ~£1.02M, Abby AVC schedule running in both cases.
//
// All figures in £k, today's money (real terms throughout).

import { readFileSync } from 'fs';
const D = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;

// ---- Shared parameters ----
const IRR = 0.0193;              // ladder real IRR (June 2026 curve)
const CASH0 = 60, CASH_R = 0.005;
const SPEND = 60;                // £60k/yr from Jun 2035
const HB_RET = 13;               // HB £13k/yr 2035/36..2040/41 (to Chris pension)
const SP1_YEAR = 2052, SP2_YEAR = 2055; // state pensions land (Nov 2051 / Aug 2054)
const SP_EACH = 12.5;
// Abby contributions (Amendment 1 adopted in BOTH variants): baseline 10.8 + AVC schedule
const AVC = [18.08, 19.484, 20.918, 22.379, 23.87, 25.391, 26.942, 28.525, 30.138]
  .map(x => x + 10.8);
const END_YEAR = 2075;           // Chris 92

// Annuity factor for payout years 2035..2045 (t = 9..19 from Jun 2026)
let AF = 0;
for (let t = 9; t <= 19; t++) AF += Math.pow(1 + IRR, -t);

// ---- Variants ----
// A: plan as written. Investable 1578 = ladder 498 + growth 1020 + cash 60.
// B: max floor. Gilt-able = 1578 - cash 60 - VS100 100 - Abby DC 273 = 1145.
//    Growth = 100 (VS100) + 273 (Abby DC) = 373.
const VARIANTS = {
  A: { name: 'Plan as written (ladder £498k)', ladder0: 498, growth0: 1020 },
  B: { name: 'Max floor (ladder £1,145k)',     ladder0: 1145, growth0: 373 },
};
for (const v of Object.values(VARIANTS)) v.X = v.ladder0 / AF; // real payout/yr 2035-45

// ---- Deterministic simulation ----
// eqRet: function(yearIndex from 2026) -> real return for that year
// spend: retirement spend level (for sustainable-spend bisection)
function sim(v, eqRet, spend = SPEND) {
  let growth = v.growth0, cash = CASH0, ladder = v.ladder0;
  let out = { fail: false };
  let yi = 0;
  for (let year = 2026; year < END_YEAR; year++, yi++) {
    const g = eqRet(yi);
    if (year < 2035) {
      // accumulation: income covers spending (Amendment: net new cash savings ~0)
      growth = growth * (1 + g) + AVC[yi];
      ladder *= 1 + IRR;
      cash *= 1 + CASH_R;
    } else {
      let inflow = 0;
      if (year <= 2045) { ladder = ladder * (1 + IRR) - v.X; inflow += v.X; }
      if (year <= 2040) inflow += HB_RET;
      if (year >= SP1_YEAR) inflow += SP_EACH;
      if (year >= SP2_YEAR) inflow += SP_EACH;
      const net = inflow - spend;
      growth = growth * (1 + g) + net;      // surplus reinvested / deficit drawn
      cash *= 1 + CASH_R;
      if (growth < 0) { cash += growth; growth = 0; }
      if (cash < 0) out.fail = true;
    }
    if (year === 2034) out.t2035 = growth + ladder + cash;
    if (year === 2044) out.t2045 = growth + Math.max(ladder, 0) + cash;
  }
  out.t2075 = growth + cash;
  return out;
}

// Sustainable spend: highest constant real spend from 2035 with no failure by 2075
function sustainable(v, eqRet) {
  let lo = 40, hi = 250;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (sim(v, eqRet, mid).fail) hi = mid; else lo = mid;
  }
  return lo;
}

const fmt = n => (n >= 1000 ? '£' + (n / 1000).toFixed(2) + 'M' : '£' + n.toFixed(0) + 'k');

console.log(`Ladder payouts: A £${VARIANTS.A.X.toFixed(1)}k/yr, B £${VARIANTS.B.X.toFixed(1)}k/yr (real, 2035-2045)\n`);

console.log('=== Deterministic cases (real equity return, flat) ===');
console.log('Case        Variant                          Total@2035   Total@2045   Left@92(2075)  SustainableSpend');
for (const g of [0.00, 0.02, 0.04, 0.05, 0.07]) {
  for (const [k, v] of Object.entries(VARIANTS)) {
    const r = sim(v, () => g);
    const s = sustainable(v, () => g);
    console.log(
      `${(g * 100).toFixed(0).padStart(2)}% real    ${v.name.padEnd(32)} ${fmt(r.t2035).padStart(9)}    ${fmt(r.t2045).padStart(9)}    ${fmt(r.t2075).padStart(9)}${r.fail ? ' FAIL' : ''}      £${s.toFixed(0)}k/yr`
    );
  }
}

// ---- Historical windows (Shiller monthly real equity returns) ----
// Annualise each window's monthly returns; run the same model with the
// actual return sequence for years 0..18 (2026->2045), then hold the last
// available... only report to 2045 (19y windows keep the CAPE>=30 sample).
function windowStats(minCape) {
  const rows = { A: [], B: [] };
  for (let s = CAPE_START; s + 228 < D.length; s++) {
    if (minCape && D[s][2] / 10 < minCape) continue;
    const annual = [];
    for (let y = 0; y < 19; y++) {
      let f = 1;
      for (let m = 0; m < 12; m++) f *= 1 + D[s + y * 12 + m][0] / 10000;
      annual.push(f - 1);
    }
    for (const [k, v] of Object.entries(VARIANTS)) {
      const r = sim(v, yi => annual[Math.min(yi, 18)]);
      rows[k].push(r);
    }
  }
  return rows;
}
const q = (arr, key, p) => {
  const vv = arr.map(x => x[key]).sort((a, b) => a - b);
  return vv[Math.max(0, Math.floor(p * (vv.length - 1)))];
};
for (const [label, minCape] of [['ALL starts 1881-2007', 0], ['CAPE>=30 starts (like today)', 30]]) {
  const rows = windowStats(minCape);
  console.log(`\n=== Historical windows: ${label} (n=${rows.A.length}) — household total ===`);
  console.log('Pctile      A@2035     B@2035  |   A@2045     B@2045');
  for (const p of [0.05, 0.25, 0.50, 0.75, 0.95]) {
    console.log(
      `p${String(p * 100).padStart(2)}      ${fmt(q(rows.A, 't2035', p)).padStart(8)}  ${fmt(q(rows.B, 't2035', p)).padStart(8)}  | ${fmt(q(rows.A, 't2045', p)).padStart(8)}  ${fmt(q(rows.B, 't2045', p)).padStart(8)}`
    );
  }
  console.log(
    `worst     ${fmt(q(rows.A, 't2035', 0)).padStart(8)}  ${fmt(q(rows.B, 't2035', 0)).padStart(8)}  | ${fmt(q(rows.A, 't2045', 0)).padStart(8)}  ${fmt(q(rows.B, 't2045', 0)).padStart(8)}`
  );
}
