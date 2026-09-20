import { readFileSync } from 'fs';
const D = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;
const ym = (i) => `${1871 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

function windows(months, eq) {
  const rows = [];
  for (let s = CAPE_START; s + months < D.length; s++) {
    let g = 1;
    for (let i = s; i < s + months; i++) g *= 1 + (eq * D[i][0] + (1 - eq) * D[i][1]) / 10000;
    rows.push({ s, startCape: D[s][2] / 10, ann: Math.pow(g, 12 / months) - 1 });
  }
  return rows;
}
const pct = (arr, p) => arr[Math.max(0, Math.floor(p * (arr.length - 1)))];

// (a) 9-year windows: P(equity >= 2.1% real) — what the growth sleeve must do for
//     the portfolio-wide 2% target, all starts vs CAPE>=30 starts
for (const eq of [1.0, 0.85]) {
  const r9 = windows(113, eq);
  const all = r9.filter(x => x.ann >= 0.021).length / r9.length;
  const hi = r9.filter(x => x.startCape >= 30);
  const hiP = hi.filter(x => x.ann >= 0.021).length / hi.length;
  console.log(`9y, ${eq * 100}% equity: P(ann real >= 2.1%) all starts ${(all * 100).toFixed(0)}%, CAPE>=30 starts ${(hiP * 100).toFixed(0)}% (n=${hi.length})`);
}

// (b) 20-year windows: distribution of real returns — what the growth sleeve
//     must survive for post-2046 spending (needs ~0% real over ~20y)
for (const eq of [1.0, 0.7]) {
  const r20 = windows(240, eq);
  const anns = r20.map(x => x.ann).sort((a, b) => a - b);
  const below0 = r20.filter(x => x.ann < 0).length;
  const hi = r20.filter(x => x.startCape >= 30).map(x => x.ann).sort((a, b) => a - b);
  const worst = r20.reduce((m, x) => x.ann < m.ann ? x : m);
  console.log(`20y, ${eq * 100}% equity: n=${r20.length}, min ${(pct(anns, 0) * 100).toFixed(1)}% (${ym(worst.s)}), p5 ${(pct(anns, 0.05) * 100).toFixed(1)}%, p50 ${(pct(anns, 0.5) * 100).toFixed(1)}%; windows <0%: ${below0}; CAPE>=30 starts: n=${hi.length}, min ${hi.length ? (hi[0] * 100).toFixed(1) : '-'}%, p50 ${hi.length ? (pct(hi, 0.5) * 100).toFixed(1) : '-'}%`);
}

// (c) Worst 9y real return for context (sequence into 2035)
const r9e = windows(113, 1.0);
const w = r9e.reduce((m, x) => x.ann < m.ann ? x : m);
console.log(`Worst 9y 100% equity window: ${(w.ann * 100).toFixed(1)}%/yr starting ${ym(w.s)}`);

// (d) Ladder cost check: £60k/yr real due 2035..2045, real yields interpolated from
//     June 2026 curve (2035:1.6, 2036:1.72, 2040:2.07, 2045:2.30)
const yCurve = { 9: 1.62, 10: 1.72, 11: 1.80, 12: 1.89, 13: 1.98, 14: 2.07, 15: 2.12, 16: 2.17, 17: 2.21, 18: 2.26, 19: 2.30 };
let cost = 0;
for (let t = 9; t <= 19; t++) cost += 60000 / Math.pow(1 + yCurve[t] / 100, t);
console.log(`ILG ladder cost today for £60k real in each of 2035-2045 (11 rungs): £${Math.round(cost).toLocaleString()}`);
let bridgeCost = 0;
for (let t = 9; t <= 14; t++) bridgeCost += 60000 / Math.pow(1 + yCurve[t] / 100, t);
console.log(`  of which bridge rungs 2035-2040 (must sit in ISAs): £${Math.round(bridgeCost).toLocaleString()}`);
