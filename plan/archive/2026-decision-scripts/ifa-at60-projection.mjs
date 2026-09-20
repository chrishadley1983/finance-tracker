import { readFileSync } from 'fs';
const D = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;

// Proposed plan: floor 498k @1.93% IRR; growth 1.02M equity; cash 60k @0.5%;
// contributions 22.3k/yr -> extension @2.2% until Jun 2035 (108 mo), then stop.
// From month 108: spend 60k/yr (5k/mo) from secure assets (floor+ext+cash, ~2% real);
// growth sleeve untouched. Age 60 = Nov 2043 = month 209 from Jun 2026.
const M_RET = 108, M_60 = 209;
const rows = [];
for (let s = CAPE_START; s + M_60 < D.length; s++) {
  let growth = 1020000;
  let secure = 498000 + 60000; // floor + cash
  let ext = 0;
  for (let i = s; i < s + M_60; i++) {
    const m = i - s;
    const re = D[i][0] / 10000;
    growth *= 1 + re;
    secure *= Math.pow(1.0185, 1 / 12); // blended floor/cash ~1.85% real
    ext *= Math.pow(1.022, 1 / 12);
    if (m < M_RET) ext += 22300 / 12;
    else { // retirement: spend 5k/mo from secure first
      const draw = 5000;
      if (secure + ext >= draw) {
        const fromSecure = Math.min(secure, draw);
        secure -= fromSecure;
        ext -= (draw - fromSecure);
      } else { growth -= (draw - secure - ext); secure = 0; ext = 0; }
    }
  }
  const at52 = null; // computed in prior script
  const endCape35 = D[s + M_RET][2] / 10;
  rows.push({ startCape: D[s][2] / 10, endCape35, at60: growth + secure + ext, sleeve60: growth });
}
const stats = (set, key) => {
  const v = set.map(x => x[key]).sort((a, b) => a - b);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const q = p => v[Math.floor(p * (v.length - 1))];
  return { p10: q(0.1), median: q(0.5), mean, p90: q(0.9) };
};
const hi = rows.filter(r => r.startCape >= 30);
for (const [label, set] of [['ALL starts', rows], ['CAPE>=30 starts', hi]]) {
  const t = stats(set, 'at60');
  console.log(`${label} (n=${set.length}) — TOTAL portfolio at age 60 (Nov 2043, real £):`);
  console.log(`  p10 £${(t.p10 / 1e6).toFixed(2)}M  median £${(t.median / 1e6).toFixed(2)}M  mean £${(t.mean / 1e6).toFixed(2)}M  p90 £${(t.p90 / 1e6).toFixed(2)}M`);
}

// SWR at 52: per-window ERN dynamic WR from CAPE at Jun 2035, applied to total portfolio at Jun 2035.
// Recompute portfolio at 52 (108mo) same as prior sim.
const rows52 = [];
for (let s = CAPE_START; s + M_RET < D.length; s++) {
  let growth = 1020000, ext = 0;
  for (let i = s; i < s + M_RET; i++) {
    growth *= 1 + D[i][0] / 10000;
    ext = ext * Math.pow(1.022, 1 / 12) + 22300 / 12;
  }
  const secure = (498000) * Math.pow(1.0193, 9) + 60000 * Math.pow(1.005, 9);
  const total = growth + ext + secure;
  const endCape = D[s + M_RET][2] / 10;
  const wr = endCape > 0 ? (1.75 + 0.5 * 100 / endCape) / 100 : 0.0303;
  rows52.push({ startCape: D[s][2] / 10, total, wr, spend: total * wr, implied60k: 60000 / total });
}
const hi52 = rows52.filter(r => r.startCape >= 30);
for (const [label, set] of [['ALL starts', rows52], ['CAPE>=30 starts', hi52]]) {
  const med = (key) => { const v = set.map(x => x[key]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  console.log(`\n${label} (n=${set.length}) at Jun 2035 (age 51.5):`);
  console.log(`  median portfolio £${(med('total') / 1e6).toFixed(2)}M; median ERN dynamic WR ${(med('wr') * 100).toFixed(2)}%; median sustainable spend £${(med('spend') / 1000).toFixed(0)}k`);
  console.log(`  median WR that £60k actually requires: ${(med('implied60k') * 100).toFixed(2)}%`);
}
