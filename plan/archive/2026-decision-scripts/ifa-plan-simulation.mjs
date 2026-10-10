import { readFileSync } from 'fs';
const D = JSON.parse(readFileSync('lib/fire/ern/data/shiller-monthly.json', 'utf8'));
const CAPE_START = 119;

// ---- Plan parameters (June 2026, today's-money) ----
const MONTHS = 113; // ~9.4y to Jun 2035 (use 108 = 9.0y? retirement Jun 2035 = 108 months). Use 108.
const M = 108;
const CONTRIB_Y = 22300; // household savings/yr

// Current portfolio: £1.578M investable (ex business stock); ~87% equity-like (incl crypto), 13% bonds/cash
const CUR_TOTAL = 1578000;
const CUR_EQ = 0.87;

// Proposed: ladder £498k locked (IRR ~1.93% real), growth £1.02M equity, cash £60k (0.5% real)
const LADDER0 = 498000, LADDER_IRR = 0.0193;
const GROWTH0 = 1020000;
const CASH0 = 60000, CASH_R = 0.005;
// contributions go to ladder extension at ~2.2% real locked
const EXT_R = 0.022;

function simulate(s) {
  // returns {cur, prop} real values at retirement for window starting at index s
  let curEq = CUR_TOTAL * CUR_EQ, curBd = CUR_TOTAL * (1 - CUR_EQ);
  let growth = GROWTH0;
  const cm = CONTRIB_Y / 12;
  let ext = 0;
  for (let i = s; i < s + M; i++) {
    const re = D[i][0] / 10000, rb = D[i][1] / 10000;
    curEq *= 1 + re; curBd *= 1 + rb;
    // current plan: contributions into 87/13
    curEq += cm * CUR_EQ; curBd += cm * (1 - CUR_EQ);
    growth *= 1 + re;
    ext = ext * Math.pow(1 + EXT_R, 1 / 12) + cm;
  }
  const ladder = LADDER0 * Math.pow(1 + LADDER_IRR, M / 12);
  const cash = CASH0 * Math.pow(1 + CASH_R, M / 12);
  return { cur: curEq + curBd, prop: ladder + growth + ext + cash, growthOnly: growth };
}

const all = [], hi = [];
for (let s = CAPE_START; s + M < D.length; s++) {
  const r = simulate(s);
  r.startCape = D[s][2] / 10;
  all.push(r);
  if (r.startCape >= 30) hi.push(r);
}
const q = (arr, key, p) => {
  const v = arr.map(x => x[key]).sort((a, b) => a - b);
  return v[Math.max(0, Math.floor(p * (v.length - 1)))];
};
function report(label, set) {
  console.log(`\n=== ${label} (n=${set.length}) — real £ at Jun 2035 ===`);
  console.log('Pctile     Current(87%eq)   Proposed(floor+growth)   GrowthSleeveOnly');
  for (const p of [0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90]) {
    console.log(`p${String(p * 100).padStart(2)}        £${(q(set, 'cur', p) / 1e6).toFixed(2)}M           £${(q(set, 'prop', p) / 1e6).toFixed(2)}M                  £${(q(set, 'growthOnly', p) / 1e6).toFixed(2)}M`);
  }
  // Success tests
  const NEED_2035 = 1980000; // old framing: portfolio supporting £60k at ERN 3.03% w/o SP
  console.log(`P(total >= £1.98M): current ${(100 * set.filter(x => x.cur >= NEED_2035).length / set.length).toFixed(0)}%  proposed ${(100 * set.filter(x => x.prop >= NEED_2035).length / set.length).toFixed(0)}%`);
  // Proposed plan funded-by-construction check: ladder pays 2035-45 regardless.
  // Growth sleeve at 2035 must eventually cover need-at-2046 (~£1.10M today-money).
  // Conservative: growth sleeve value at 2035 already >= 1.10M means funded even with 0% real 2035-46.
  console.log(`P(growth sleeve at 2035 alone >= £1.10M post-2046 need): ${(100 * set.filter(x => x.growthOnly >= 1100000).length / set.length).toFixed(0)}%`);
}
report('ALL historical starts 1881-2017', all);
report('CAPE >= 30 starts (analogue of today)', hi);

// Retirement-phase: growth sleeve 2026->2046 (240mo) requirement: end >= £1.10M from £1.02M+contrib for 9y
let n20 = 0, ok20 = 0, okHi = 0, nHi = 0, worst = 1e12, worstHi = 1e12;
for (let s = CAPE_START; s + 240 < D.length; s++) {
  let g = GROWTH0; let ext2 = 0; const cm = CONTRIB_Y / 12;
  for (let i = s; i < s + 240; i++) {
    const re = D[i][0] / 10000;
    g *= 1 + re;
    if (i - s < M) { ext2 = ext2 * Math.pow(1 + EXT_R, 1 / 12) + cm; } else { ext2 *= Math.pow(1 + EXT_R, 1 / 12); }
  }
  // ext (ladder extension ~£222k) covers 2046-2051 partially; require growth >= 1.10M - ext2 surplus? Conservative: growth alone >= 1.10M
  n20++; if (g >= 1100000) ok20++;
  if (g < worst) worst = g;
  if (D[s][2] / 10 >= 30) { nHi++; if (g >= 1100000) okHi++; if (g < worstHi) worstHi = g; }
}
console.log(`\n=== Growth sleeve £1.02M, 20-yr horizon (2026->2046), need >= £1.10M real ===`);
console.log(`All starts: ${(100 * ok20 / n20).toFixed(1)}% funded (n=${n20}), worst outcome £${(worst / 1e6).toFixed(2)}M`);
console.log(`CAPE>=30 starts: ${(100 * okHi / nHi).toFixed(1)}% funded (n=${nHi}), worst £${(worstHi / 1e6).toFixed(2)}M`);

// Sustainable-spend framing at 2035 for the downside rows: ERN WR with CAPE matched to window end
function endCapeSpend(set, p, key) {
  // approximate: use portfolio percentile with WR by ending CAPE percentile (conservative: CAPE 39 -> 3.03%)
  return q(set, key, p) * 0.0303 / 1000;
}
console.log(`\nIndicative £60k-coverage at p5 (CAPE>=30 starts): current portfolio p5 supports £${endCapeSpend(hi, 0.05, 'cur').toFixed(0)}k at 3.03% WR; proposed floor pays £60k 2035-45 regardless + growth p5 £${(q(hi, 'growthOnly', 0.05) / 1e6).toFixed(2)}M continues compounding.`);
