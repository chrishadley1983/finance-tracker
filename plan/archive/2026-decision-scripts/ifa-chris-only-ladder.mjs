// Variant D — "Chris-only ladder" (Chris's idea, 31 Aug 2026):
//   Chris SIPP + ACN (£632.7k)  -> 2041-45 rungs
//   Chris II ISA   (£276.7k)    -> 2035-40 bridge rungs
//   Abby DC        (£282.9k)    -> stays 100% equity + AVCs
//   Abby Vanguard ISA (£312.6k) -> stays VS100 equity (no transfer)
//   Other savings  (£119.9k)    -> as-is: crypto ~£54k modelled as equity,
//                                  ~£66k accessible cash buffer
// Compared against A (June plan) and B (max floor), all rebuilt on the
// 1 Sep 2026 tracker balances (investable £1,626.9k) so the three are
// apples-to-apples. Real terms, £k throughout.

import { readFileSync } from 'fs';
const SH = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;

const IRR = 0.0193, CASH_R = 0.005;
const SPEND = 60, HB_RET = 13;
const SP1 = 2052, SP2 = 2055, SP_EACH = 12.5;
const AVC = [18.08, 19.484, 20.918, 22.379, 23.87, 25.391, 26.942, 28.525, 30.138]
  .map(x => x + 10.8);
const END = 2075;

const af = (t0, t1) => { let s = 0; for (let t = t0; t <= t1; t++) s += Math.pow(1 + IRR, -t); return s; };

// ladders: {amt, t0, t1} with t measured from 2026 (2035 -> t=9, 2045 -> t=19)
const VARIANTS = {
  A: { name: 'Plan as written (£498k ladder)', ladders: [{ amt: 498, t0: 9, t1: 19 }], growth0: 1068.9, cash0: 60 },
  B: { name: 'Max floor (£1,184k ladder)', ladders: [{ amt: 1183.9, t0: 9, t1: 19 }], growth0: 383.0, cash0: 60 },
  D: { name: 'Chris-only ladder (£909k)', ladders: [{ amt: 276.7, t0: 9, t1: 14 }, { amt: 632.7, t0: 15, t1: 19 }], growth0: 651.5, cash0: 66 },
};

function sim(v, eqRet, spend = SPEND) {
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
    const ladderBal = Ls.reduce((a, L) => a + Math.max(L.bal, 0), 0);
    if (year === 2034) out.t2035 = growth + ladderBal + cash;
    if (year === 2044) out.t2045 = growth + ladderBal + cash;
  }
  out.t2075 = growth + cash;
  return out;
}

function sustainable(v, eqRet) {
  let lo = 40, hi = 250;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (sim(v, eqRet, mid).fail) hi = mid; else lo = mid;
  }
  return lo;
}

const fmt = n => (n >= 1000 ? '£' + (n / 1000).toFixed(2) + 'M' : '£' + n.toFixed(0) + 'k');

console.log('Payout profiles (real £k/yr):');
for (const [k, v] of Object.entries(VARIANTS)) {
  const parts = v.ladders.map(L => `${(L.amt / af(L.t0, L.t1)).toFixed(1)}/yr ${2026 + L.t0}-${2026 + L.t1}`);
  console.log(`  ${k}: ${parts.join(' then ')}  (equity sleeve £${v.growth0}k)`);
}

console.log('\n=== Deterministic (flat real equity return) ===');
console.log('Case   Variant                            @2035      @2045      @2075    SustSpend');
for (const g of [0.00, 0.02, 0.04, 0.05]) {
  for (const [k, v] of Object.entries(VARIANTS)) {
    const r = sim(v, () => g);
    const s = sustainable(v, () => g);
    console.log(`${(g * 100).toFixed(0).padStart(3)}%   ${v.name.padEnd(33)} ${fmt(r.t2035).padStart(8)}   ${fmt(r.t2045).padStart(8)}   ${fmt(r.t2075).padStart(8)}${r.fail ? ' FAIL' : ''}   £${s.toFixed(0)}k`);
  }
}

function windowStats(minCape) {
  const rows = { A: [], B: [], D: [] };
  for (let s = CAPE_START; s + 228 < SH.length; s++) {
    if (minCape && SH[s][2] / 10 < minCape) continue;
    const annual = [];
    for (let y = 0; y < 19; y++) {
      let f = 1;
      for (let m = 0; m < 12; m++) f *= 1 + SH[s + y * 12 + m][0] / 10000;
      annual.push(f - 1);
    }
    for (const [k, v] of Object.entries(VARIANTS)) rows[k].push(sim(v, yi => annual[Math.min(yi, 18)]));
  }
  return rows;
}
const q = (arr, key, p) => {
  const vv = arr.map(x => x[key]).sort((a, b) => a - b);
  return vv[Math.max(0, Math.floor(p * (vv.length - 1)))];
};
for (const [label, minCape] of [['ALL starts 1881-2007', 0], ['CAPE>=30 starts (like today)', 30]]) {
  const rows = windowStats(minCape);
  console.log(`\n=== Historical windows: ${label} (n=${rows.A.length}) ===`);
  console.log('Pctile     A@2035    B@2035    D@2035  |   A@2045    B@2045    D@2045');
  for (const p of [0.05, 0.25, 0.50, 0.75, 0.95]) {
    console.log(`p${String(p * 100).padStart(2)}     ${['A', 'B', 'D'].map(k => fmt(q(rows[k], 't2035', p)).padStart(8)).join('  ')}  | ${['A', 'B', 'D'].map(k => fmt(q(rows[k], 't2045', p)).padStart(8)).join('  ')}`);
  }
  console.log(`worst    ${['A', 'B', 'D'].map(k => fmt(q(rows[k], 't2035', 0)).padStart(8)).join('  ')}  | ${['A', 'B', 'D'].map(k => fmt(q(rows[k], 't2045', 0)).padStart(8)).join('  ')}`);
}
