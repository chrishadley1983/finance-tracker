// Third pole of the comparison: 80% equity / 20% bonds the whole way,
// no gilt ladder, rebalanced annually, same spending and contributions.
// Compared against plan-as-written (A) and max floor (B).
// Real terms, £k.

import { readFileSync } from 'fs';
const D = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;

const IRR = 0.0193, CASH0 = 60, CASH_R = 0.005;
const SPEND = 60, HB_RET = 13;
const SP1 = 2052, SP2 = 2055, SP_EACH = 12.5;
const AVC = [18.08, 19.484, 20.918, 22.379, 23.87, 25.391, 26.942, 28.525, 30.138]
  .map(x => x + 10.8);
const END = 2075;

let AF = 0;
for (let t = 9; t <= 19; t++) AF += Math.pow(1 + IRR, -t);

// A/B as in ifa-all-in-ladder.mjs; C = 80/20 of the full £1,578k
function simAB(v, eqRet, spend = SPEND) {
  let growth = v.growth0, cash = CASH0, ladder = v.ladder0;
  const X = v.ladder0 / AF;
  let out = { fail: false };
  for (let year = 2026, yi = 0; year < END; year++, yi++) {
    const g = eqRet(yi);
    if (year < 2035) { growth = growth * (1 + g) + AVC[yi]; ladder *= 1 + IRR; cash *= 1 + CASH_R; }
    else {
      let inflow = 0;
      if (year <= 2045) { ladder = ladder * (1 + IRR) - X; inflow += X; }
      if (year <= 2040) inflow += HB_RET;
      if (year >= SP1) inflow += SP_EACH;
      if (year >= SP2) inflow += SP_EACH;
      growth = growth * (1 + g) + inflow - spend;
      cash *= 1 + CASH_R;
      if (growth < 0) { cash += growth; growth = 0; }
      if (cash < 0) { out.fail = true; cash = 0; }
    }
    if (year === 2034) out.t2035 = growth + ladder + cash;
    if (year === 2044) out.t2045 = growth + Math.max(ladder, 0) + cash;
  }
  out.t2075 = growth + cash;
  return out;
}

function simC(eqRet, bdRet, spend = SPEND) {
  let eq = 0.8 * 1578, bd = 0.2 * 1578;
  let out = { fail: false };
  for (let year = 2026, yi = 0; year < END; year++, yi++) {
    eq *= 1 + eqRet(yi); bd *= 1 + bdRet(yi);
    if (year < 2035) eq += AVC[yi];
    else {
      let inflow = 0;
      if (year <= 2040) inflow += HB_RET;
      if (year >= SP1) inflow += SP_EACH;
      if (year >= SP2) inflow += SP_EACH;
      let total = eq + bd + inflow - spend;
      if (total < 0) { out.fail = true; total = 0; }
      eq = 0.8 * total; bd = 0.2 * total;
    }
    if (year === 2034) out.t2035 = eq + bd;
    if (year === 2044) out.t2045 = eq + bd;
    const t = eq + bd; eq = 0.8 * t; bd = 0.2 * t; // rebalance in accumulation too
  }
  out.t2075 = eq + bd;
  return out;
}

const VAR = {
  A: { name: 'Plan as written', ladder0: 498, growth0: 1020 },
  B: { name: 'Max floor', ladder0: 1145, growth0: 373 },
};
const fmt = n => (n >= 1000 ? '£' + (n / 1000).toFixed(2) + 'M' : '£' + n.toFixed(0) + 'k');

function sustainable(f) {
  let lo = 30, hi = 300;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; f(m).fail ? hi = m : lo = m; }
  return lo;
}

console.log('=== Deterministic (flat real returns; bonds/ladder both ~1.93%) ===');
console.log('Case      Variant             @2035      @2045      @2075     SustSpend');
for (const g of [0.00, 0.02, 0.05]) {
  for (const [k, v] of Object.entries(VAR)) {
    const r = simAB(v, () => g);
    const s = sustainable(sp => simAB(v, () => g, sp));
    console.log(`${(g*100).toFixed(0).padStart(2)}%       ${v.name.padEnd(17)} ${fmt(r.t2035).padStart(8)}  ${fmt(r.t2045).padStart(8)}  ${fmt(r.t2075).padStart(8)}${r.fail?' FAIL':'     '}  £${s.toFixed(0)}k`);
  }
  const rc = simC(() => g, () => IRR);
  const sc = sustainable(sp => simC(() => g, () => IRR, sp));
  console.log(`${(g*100).toFixed(0).padStart(2)}%       ${'80/20 throughout'.padEnd(17)} ${fmt(rc.t2035).padStart(8)}  ${fmt(rc.t2045).padStart(8)}  ${fmt(rc.t2075).padStart(8)}${rc.fail?' FAIL':'     '}  £${sc.toFixed(0)}k`);
}

// Historical: full 49-year windows (2026->2075 analogue), all starts.
// Bond sleeve for C uses historical bond returns.
function annualise(s, years) {
  const eq = [], bd = [];
  for (let y = 0; y < years; y++) {
    let fe = 1, fb = 1;
    for (let m = 0; m < 12; m++) { fe *= 1 + D[s + y*12 + m][0]/10000; fb *= 1 + D[s + y*12 + m][1]/10000; }
    eq.push(fe - 1); bd.push(fb - 1);
  }
  return { eq, bd };
}
const res = { A: [], B: [], C: [] };
let n = 0;
for (let s = CAPE_START; s + 588 < D.length; s++) {
  const { eq, bd } = annualise(s, 49);
  const fe = yi => eq[Math.min(yi, 48)], fb = yi => bd[Math.min(yi, 48)];
  res.A.push(simAB(VAR.A, fe)); res.B.push(simAB(VAR.B, fe)); res.C.push(simC(fe, fb));
  n++;
}
const q = (arr, key, p) => { const v = arr.map(x => x[key]).sort((a,b)=>a-b); return v[Math.floor(p*(v.length-1))]; };
console.log(`\n=== Historical 49-yr windows, ALL starts 1881-1977 (n=${n}) ===`);
console.log('NB: no CAPE>=30 starts exist this far back except 1929 — treat as base-rate, not today-analogue');
for (const k of ['A','B','C']) {
  const fails = res[k].filter(x => x.fail).length;
  console.log(`${k === 'A' ? 'Plan as written ' : k === 'B' ? 'Max floor       ' : '80/20 throughout'}: fail ${ (100*fails/n).toFixed(1)}%  | @2075 p5 ${fmt(q(res[k],'t2075',0.05))}  p50 ${fmt(q(res[k],'t2075',0.5))}  worst ${fmt(q(res[k],'t2075',0))}`);
}
// 1929 window specifically (CAPE 32, the only high-CAPE long window)
let s1929 = -1;
for (let s = CAPE_START; s + 588 < D.length; s++) { if (D[s][2]/10 >= 30) { s1929 = s; break; } }
if (s1929 >= 0) {
  const { eq, bd } = annualise(s1929, 49);
  const fe = yi => eq[Math.min(yi,48)], fb = yi => bd[Math.min(yi,48)];
  console.log(`\n1929-start window (CAPE ${(D[s1929][2]/10).toFixed(0)}):  A @2075 ${fmt(simAB(VAR.A, fe).t2075)}   B ${fmt(simAB(VAR.B, fe).t2075)}   C ${fmt(simC(fe, fb).t2075)}${simC(fe,fb).fail?' FAIL':''}`);
}
