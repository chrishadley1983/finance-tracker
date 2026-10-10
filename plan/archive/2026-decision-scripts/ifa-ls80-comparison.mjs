import { readFileSync } from 'fs';
const D = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;
const M_RET = 108, M_60 = 209;

// LS80 path: full £1.578M investable at 80/20 equity/bond, contributions 22.3k/yr to Jun 2035,
// then withdraw £60k/yr (5k/mo) proportionally. Track value at 52 and at 60.
const rows = [];
for (let s = CAPE_START; s + M_60 < D.length; s++) {
  let v = 1578000;
  let at52 = null;
  for (let i = s; i < s + M_60; i++) {
    const m = i - s;
    const r = 0.8 * D[i][0] / 10000 + 0.2 * D[i][1] / 10000;
    v *= 1 + r;
    if (m < M_RET) v += 22300 / 12; else v -= 5000;
    if (m === M_RET - 1) at52 = v;
  }
  const endCape = D[s + M_RET][2] / 10;
  const wr = endCape > 0 ? (1.75 + 0.5 * 100 / endCape) / 100 : 0.0303;
  rows.push({ startCape: D[s][2] / 10, at52, at60: v, wr, spend52: at52 * wr, req: 60000 / at52 });
}
const stats = (set, key) => {
  const v = set.map(x => x[key]).sort((a, b) => a - b);
  const q = p => v[Math.floor(p * (v.length - 1))];
  return { p10: q(0.1), median: q(0.5), mean: v.reduce((a, b) => a + b, 0) / v.length, p90: q(0.9) };
};
const med = (set, key) => stats(set, key).median;
const hi = rows.filter(r => r.startCape >= 30);
for (const [label, set] of [['ALL', rows], ['CAPE>=30', hi]]) {
  console.log(`${label} (n=${set.length}) — LS80 throughout:`);
  console.log(`  At 52: median £${(med(set, 'at52') / 1e6).toFixed(2)}M; median ERN WR ${(med(set, 'wr') * 100).toFixed(2)}%; median sustainable spend £${(med(set, 'spend52') / 1000).toFixed(0)}k; £60k requires ${(med(set, 'req') * 100).toFixed(2)}%`);
  const t = stats(set, 'at60');
  console.log(`  At 60: p10 £${(t.p10 / 1e6).toFixed(2)}M  median £${(t.median / 1e6).toFixed(2)}M  mean £${(t.mean / 1e6).toFixed(2)}M  p90 £${(t.p90 / 1e6).toFixed(2)}M`);
  const depleted52_45 = set.filter(x => x.at60 < 60000 * 8).length; // crude distress flag: less than 8 yrs spend left
  console.log(`  Windows reaching 60 with < 8 yrs spending left (<£480k): ${depleted52_45} (${(100 * depleted52_45 / set.length).toFixed(1)}%); minimum at 60: £${(stats(set, 'at60').p10 < 0 ? 'NEG' : (set.map(x => x.at60).sort((a, b) => a - b)[0] / 1e6).toFixed(2))}M`);
}
