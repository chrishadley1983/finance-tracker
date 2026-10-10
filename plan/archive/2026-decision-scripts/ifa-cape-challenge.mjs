import { readFileSync } from 'fs';
const D = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119; // first non-zero CAPE (1880-12)
const startYM = (i) => { const y = 1871 + Math.floor(i / 12), m = (i % 12) + 1; return `${y}-${String(m).padStart(2, '0')}`; };

const WINDOW = 113; // months ≈ 9.4 years
const EQ = 0.8; // 80/20 portfolio; also run 100/0
function run(eq) {
  const rows = [];
  for (let s = CAPE_START; s + WINDOW < D.length; s++) {
    let g = 1;
    for (let i = s; i < s + WINDOW; i++) g *= 1 + (eq * D[i][0] + (1 - eq) * D[i][1]) / 10000;
    const ann = Math.pow(g, 12 / WINDOW) - 1;
    rows.push({ s, startCape: D[s][2] / 10, endCape: D[s + WINDOW][2] / 10, ann });
  }
  return rows;
}

for (const eq of [1.0, 0.8]) {
  const rows = run(eq);
  const bad = rows.filter(r => r.ann <= 0);
  console.log(`\n=== ${eq * 100}/${100 - eq * 100} portfolio, ${WINDOW}mo (~9.4y) windows, n=${rows.length} ===`);
  console.log(`Windows with annualised real return <= 0%: ${bad.length} (${(100 * bad.length / rows.length).toFixed(1)}%)`);
  const buckets = { '<15': 0, '15-20': 0, '20-25': 0, '25-30': 0, '30-35': 0, '>=35': 0 };
  for (const r of bad) {
    const c = r.endCape;
    if (c < 15) buckets['<15']++; else if (c < 20) buckets['15-20']++; else if (c < 25) buckets['20-25']++;
    else if (c < 30) buckets['25-30']++; else if (c < 35) buckets['30-35']++; else buckets['>=35']++;
  }
  console.log('Ending CAPE distribution of those <=0% windows:', JSON.stringify(buckets));
  const worstHighCape = bad.filter(r => r.endCape >= 30).sort((a, b) => b.endCape - a.endCape).slice(0, 8);
  console.log('Zero-return windows ending with CAPE>=30:');
  for (const r of worstHighCape) console.log(`  ${startYM(r.s)} -> ${startYM(r.s + WINDOW)}: ann ${(r.ann * 100).toFixed(1)}%, CAPE ${r.startCape.toFixed(0)} -> ${r.endCape.toFixed(1)}`);
  const medEnd = bad.map(r => r.endCape).sort((a, b) => a - b);
  if (medEnd.length) console.log(`Median ending CAPE in <=0% windows: ${medEnd[Math.floor(medEnd.length / 2)].toFixed(1)}; max: ${medEnd[medEnd.length - 1].toFixed(1)}`);

  // From high starting CAPE (>=30, closest analogue to today's 39)
  const high = rows.filter(r => r.startCape >= 30);
  if (high.length) {
    const anns = high.map(r => r.ann).sort((a, b) => a - b);
    const pct = (p) => (anns[Math.floor(p * (anns.length - 1))] * 100).toFixed(1);
    const ends = high.map(r => r.endCape).sort((a, b) => a - b);
    console.log(`Windows STARTING at CAPE>=30: n=${high.length}; ann real return p10/p50/p90: ${pct(0.1)}% / ${pct(0.5)}% / ${pct(0.9)}%`);
    console.log(`  ending CAPE p10/p50/p90: ${ends[Math.floor(0.1 * (ends.length - 1))].toFixed(0)} / ${ends[Math.floor(0.5 * (ends.length - 1))].toFixed(0)} / ${ends[Math.floor(0.9 * (ends.length - 1))].toFixed(0)}`);
    const joint = high.filter(r => r.ann <= 0 && r.endCape >= 35);
    console.log(`  start>=30 AND ann<=0 AND end CAPE>=35: ${joint.length} windows`);
  }
}
