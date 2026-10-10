// Full outcome grid: CURRENT portfolio vs A (June plan) vs B (max floor)
// vs D (Chris-only ladder), on 1 Sep 2026 balances (£1,626.9k investable).
// Amendment 1 AVCs run in ALL variants. Real terms, £k.
//  1. Deterministic flat real equity returns 0-7% (bonds/ladder 1.93%).
//  2. Historical 19y windows bucketed by STARTING CAPE, percentiles at
//     2035/2045, plus sustainable spend (19y actual returns then 2% real
//     equity / 1.93% bonds). Today's CAPE ~ 40.
// CURRENT = ~87% equity / 13% bonds-cash (LS80/LS100 blend, no gilts),
// rebalanced annually; bond sleeve uses historical real bond returns.

import { readFileSync } from 'fs';
const SH = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;

const IRR = 0.0193, CASH_R = 0.005;
const SPEND = 60, HB_RET = 13;
const SP1 = 2052, SP2 = 2055, SP_EACH = 12.5;
const AVC = [18.08, 19.484, 20.918, 22.379, 23.87, 25.391, 26.942, 28.525, 30.138]
  .map(x => x + 10.8);
const END = 2075;
const TOTAL = 1626.9, EQ_W = 0.87;

const af = (t0, t1) => { let s = 0; for (let t = t0; t <= t1; t++) s += Math.pow(1 + IRR, -t); return s; };

const VARIANTS = {
  A: { name: 'June plan', ladders: [{ amt: 498, t0: 9, t1: 19 }], growth0: 1068.9, cash0: 60 },
  B: { name: 'Max floor', ladders: [{ amt: 1183.9, t0: 9, t1: 19 }], growth0: 383.0, cash0: 60 },
  D: { name: 'Chris-only', ladders: [{ amt: 276.7, t0: 9, t1: 14 }, { amt: 632.7, t0: 15, t1: 19 }], growth0: 651.5, cash0: 66 },
  // E: same totals as D (£909k ladder / £651k equity) but FLAT payouts 2035-45.
  // Wrappers: bridge £519k = Chris ISA 277 + Abby ISA transfer ~242;
  // SIPP rungs £390k; remaining £243k of Chris pension stays equity.
  E: { name: 'Balanced D (flat £909k)', ladders: [{ amt: 909.4, t0: 9, t1: 19 }], growth0: 651.5, cash0: 66 },
};

function simLadder(v, eqRet, spend = SPEND) {
  let growth = v.growth0, cash = v.cash0;
  const Ls = v.ladders.map(L => ({ bal: L.amt, X: L.amt / af(L.t0, L.t1), y0: 2026 + L.t0, y1: 2026 + L.t1 }));
  const out = { fail: false };
  for (let year = 2026, yi = 0; year < END; year++, yi++) {
    const g = eqRet(yi);
    if (year < 2035) {
      growth = growth * (1 + g) + AVC[yi];
      for (const L of Ls) L.bal *= 1 + IRR;
      cash *= 1 + CASH_R;
    } else {
      let inflow = 0;
      for (const L of Ls) {
        if (year < L.y0) L.bal *= 1 + IRR;
        else if (year <= L.y1) { L.bal = L.bal * (1 + IRR) - L.X; inflow += L.X; }
      }
      if (year <= 2040) inflow += HB_RET;
      if (year >= SP1) inflow += SP_EACH;
      if (year >= SP2) inflow += SP_EACH;
      growth = growth * (1 + g) + inflow - spend;
      cash *= 1 + CASH_R;
      if (growth < 0) { cash += growth; growth = 0; }
      if (cash < 0) { out.fail = true; cash = 0; }
    }
    const lb = Ls.reduce((a, L) => a + Math.max(L.bal, 0), 0);
    if (year === 2034) out.t2035 = growth + lb + cash;
    if (year === 2044) out.t2045 = growth + lb + cash;
  }
  out.t2075 = growth + cash;
  return out;
}

function simCurrent(eqRet, bdRet, spend = SPEND) {
  let eq = EQ_W * TOTAL, bd = (1 - EQ_W) * TOTAL;
  const out = { fail: false };
  for (let year = 2026, yi = 0; year < END; year++, yi++) {
    eq *= 1 + eqRet(yi); bd *= 1 + bdRet(yi);
    let net = year < 2035 ? AVC[yi] : -spend;
    if (year >= 2035) {
      if (year <= 2040) net += HB_RET;
      if (year >= SP1) net += SP_EACH;
      if (year >= SP2) net += SP_EACH;
    }
    let t = eq + bd + net;
    if (t < 0) { out.fail = true; t = 0; }
    eq = EQ_W * t; bd = (1 - EQ_W) * t;
    if (year === 2034) out.t2035 = t;
    if (year === 2044) out.t2045 = t;
  }
  out.t2075 = eq + bd;
  return out;
}

function sustainable(f) {
  let lo = 30, hi = 300;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid).fail) hi = mid; else lo = mid;
  }
  return lo;
}

const fmt = n => (n >= 1000 ? (n / 1000).toFixed(2) + 'M' : n.toFixed(0) + 'k');
const KEYS = ['N', 'A', 'B', 'D', 'E']; // N = current portfolio

function runAll(eqRet, bdRet) {
  const out = {};
  out.N = simCurrent(eqRet, bdRet);
  out.N.sust = sustainable(sp => simCurrent(eqRet, bdRet, sp));
  for (const k of ['A', 'B', 'D', 'E']) {
    out[k] = simLadder(VARIANTS[k], eqRet);
    out[k].sust = sustainable(sp => simLadder(VARIANTS[k], eqRet, sp));
  }
  return out;
}

console.log('Columns: N=current 87/13 (no gilts) | A=June plan | B=max floor | D=Chris-only\n');
console.log('=== 1. Deterministic: flat real equity return (bonds/ladder 1.93%) ===');
console.log('Return |       @2035 N/A/B/D        |       @2045 N/A/B/D        | SustSpend N/A/B/D');
for (const g of [0.00, 0.01, 0.02, 0.03, 0.04, 0.05, 0.07]) {
  const r = runAll(() => g, () => IRR);
  console.log(
    `${(g * 100).toFixed(0).padStart(3)}%   | ${KEYS.map(k => fmt(r[k].t2035).padStart(6)).join(' ')} | ${KEYS.map(k => fmt(r[k].t2045).padStart(6)).join(' ')} | ${KEYS.map(k => ('£' + r[k].sust.toFixed(0) + 'k').padStart(5)).join(' ')}`
  );
}

function windows(loCape, hiCape) {
  const rows = { N: [], A: [], B: [], D: [], E: [] };
  for (let s = CAPE_START; s + 228 < SH.length; s++) {
    const cape = SH[s][2] / 10;
    if (cape < loCape || cape >= hiCape) continue;
    const eq = [], bd = [];
    for (let y = 0; y < 19; y++) {
      let fe = 1, fb = 1;
      for (let m = 0; m < 12; m++) { fe *= 1 + SH[s + y * 12 + m][0] / 10000; fb *= 1 + SH[s + y * 12 + m][1] / 10000; }
      eq.push(fe - 1); bd.push(fb - 1);
    }
    const fe = yi => (yi < 19 ? eq[yi] : 0.02), fb = yi => (yi < 19 ? bd[yi] : IRR);
    const r = runAll(fe, fb);
    for (const k of KEYS) rows[k].push(r[k]);
  }
  return rows;
}
const q = (arr, key, p) => {
  const vv = arr.map(x => x[key]).sort((a, b) => a - b);
  return vv[Math.max(0, Math.floor(p * (vv.length - 1)))];
};

const BANDS = [
  ['All starts', 0, 999],
  ['CAPE < 20 (cheap)', 0, 20],
  ['CAPE 20-30 (rich)', 20, 30],
  ['CAPE >= 20 (all rich+)', 20, 999],
  ['CAPE >= 30 (v.rich)', 30, 999],
  ['CAPE >= 35 (like today)', 35, 999],
];
for (const [label, lo, hi] of BANDS) {
  const rows = windows(lo, hi);
  const n = rows.A.length;
  if (!n) continue;
  console.log(`\n=== ${label}  (n=${n} monthly starts) ===`);
  console.log('Pctile |      @2035 N/A/B/D         |      @2045 N/A/B/D         |  SustSpend N/A/B/D');
  for (const p of [0, 0.05, 0.25, 0.50, 0.75, 0.95]) {
    const lab = p === 0 ? 'worst' : 'p' + String(p * 100).padStart(2);
    console.log(
      `${lab.padEnd(6)} | ${KEYS.map(k => fmt(q(rows[k], 't2035', p)).padStart(6)).join(' ')} | ${KEYS.map(k => fmt(q(rows[k], 't2045', p)).padStart(6)).join(' ')} | ${KEYS.map(k => ('£' + q(rows[k], 'sust', p).toFixed(0) + 'k').padStart(6)).join(' ')}`
    );
  }
}
console.log('\nSustainable spend: highest flat real spend from 2035, no failure to 2075 (age 92),');
console.log('spends to zero, pre-tax, no flexibility; window = 19 actual years then 2% eq / 1.93% bd.');
