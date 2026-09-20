import { readFileSync } from 'fs';
const D = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;
const idx = (y, m) => (y - 1871) * 12 + (m - 1);
const ym = (i) => `${1871 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const last = D.length - 1; // Jan 2026

// 1. CAPE each January 2010-2026 + realized annualised real equity return from then to Jan 2026
console.log('Jan of  CAPE   Realised real eq return/yr to Jan 2026');
for (let y = 2010; y <= 2026; y++) {
  const i = idx(y, 1);
  if (i >= D.length) break;
  let g = 1;
  for (let j = i; j < last; j++) g *= 1 + D[j][0] / 10000;
  const n = (last - i) / 12;
  const ann = n > 0.5 ? (Math.pow(g, 1 / n) - 1) * 100 : null;
  console.log(`${y}    ${(D[i][2] / 10).toFixed(1).padStart(5)}   ${ann !== null ? ann.toFixed(1) + '%' : '—'}`);
}

// 2. Historical relationship: avg & range of 10y real returns by starting CAPE bucket (all windows)
const buckets = {};
for (let s = CAPE_START; s + 120 < D.length; s++) {
  const c = D[s][2] / 10;
  const b = c < 10 ? '<10' : c < 15 ? '10-15' : c < 20 ? '15-20' : c < 25 ? '20-25' : c < 30 ? '25-30' : c < 35 ? '30-35' : '>=35';
  let g = 1;
  for (let j = s; j < s + 120; j++) g *= 1 + D[j][0] / 10000;
  const ann = (Math.pow(g, 1 / 10) - 1) * 100;
  (buckets[b] ??= []).push(ann);
}
console.log('\nStart CAPE   n     10y real return: p10 / median / p90');
for (const b of ['<10', '10-15', '15-20', '20-25', '25-30', '30-35', '>=35']) {
  const v = (buckets[b] ?? []).sort((a, x) => a - x);
  if (!v.length) { console.log(`${b.padEnd(11)} 0`); continue; }
  const q = p => v[Math.floor(p * (v.length - 1))].toFixed(1);
  console.log(`${b.padEnd(11)} ${String(v.length).padStart(4)}   ${q(0.1)}% / ${q(0.5)}% / ${q(0.9)}%`);
}

// 3. The specific last-10y window: Jan 2016 -> Jan 2026
const s16 = idx(2016, 1);
let g16 = 1;
for (let j = s16; j < s16 + 120 && j < last; j++) g16 *= 1 + D[j][0] / 10000;
console.log(`\nJan 2016 CAPE: ${(D[s16][2] / 10).toFixed(1)}; realised 2016-2026 real return: ${((Math.pow(g16, 12 / Math.min(120, last - s16)) - 1) * 100).toFixed(1)}%/yr`);
// CAPE path peak/trough since 2015
let mx = 0, mn = 100, mxI = 0, mnI = 0;
for (let i = idx(2015, 1); i < D.length; i++) {
  const c = D[i][2] / 10;
  if (c > mx) { mx = c; mxI = i; } if (c < mn) { mn = c; mnI = i; }
}
console.log(`CAPE since 2015: low ${mn.toFixed(1)} (${ym(mnI)}), high ${mx.toFixed(1)} (${ym(mxI)})`);
