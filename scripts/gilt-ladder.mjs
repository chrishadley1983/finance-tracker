// Gilt ladder purchase helper — index-linked gilts on Interactive Investor.
//
// Fetches the live index-linked gilt table (EPIC, clean, DIRTY price, real
// yield) from dividenddata.co.uk, then sizes each ladder rung: how much
// nominal to order and what it should cost at today's dirty price.
//
// Usage:
//   node scripts/gilt-ladder.mjs                          # Plan E: 2035-2045 sized by the £909.4k budget
//   node scripts/gilt-ladder.mjs --budget 519500 --years 2035-2040   # the ISA bridge only
//   node scripts/gilt-ladder.mjs --years 2032-2040        # early-retirement variant (still budget-sized)
//   node scripts/gilt-ladder.mjs --year 2036 --amount 98000   # single rung at a fixed real redemption
//
// SIZING RULE (Plan E, 20 Sep 2026): the ladder is sized by the money committed
// (default £909,400 real), so each rung's REDEMPTION is whatever that buys at
// live prices (~£98k at Sep 2026 yields). Coupons are the top-up on top of the
// rung. --amount overrides with a fixed real redemption per year; the old £60k
// default is gone because it printed order sheets for the June ladder.
//
// Sizing model (deliberately conservative):
//   - A linker's redemption repays face value scaled by its index ratio, so
//     £1 of face bought today redeems at ~£1 of TODAY'S purchasing power
//     (real value preserved by construction).
//   - Face to order = target real amount / index ratio.
//   - Index ratio is estimated as dirty/clean (exact ratio also includes a
//     sliver of accrued interest — error < ~0.5% on these low coupons).
//   - Coupons received along the way are NOT counted toward the target, so
//     every rung arrives with a small bonus rather than a shortfall.
//   - Years with no maturing linker are split 50/50 across the nearest
//     earlier and later maturities (real value is what matters, not the year
//     the cash arrives — hold the early half in a money-market fund).
//
// At dealing time on II: search the EPIC, order in NOMINAL (face) amount.
// You'll be quoted a live dirty price — expect small drift from this
// snapshot (prices are ~15-min delayed; settlement accrued is recalculated
// to the settlement date). The £ cost column is a budget, not a quote.

const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
}
const amountArg = arg('amount', null);
const budget = Number(arg('budget', 909400));
let years = [];
if (arg('year')) {
  years = [Number(arg('year'))];
} else {
  const [a, b] = String(arg('years', '2035-2045')).split('-').map(Number);
  for (let y = a; y <= (b || a); y++) years.push(y);
}

const SRC = 'https://www.dividenddata.co.uk/index-linked-gilts-prices-yields.py';
const res = await fetch(SRC, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!res.ok) {
  console.error(`Source fetch failed (HTTP ${res.status}). Try again, or check ${SRC} in a browser.`);
  process.exit(1);
}
const html = await res.text();

const gilts = [];
for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
  const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&pound;/g, '£').trim());
  if (cells.length < 8 || cells[0] === 'Ticker') continue;
  const [ticker, name, coupon, matStr, , cleanStr, dirtyStr, yieldStr] = cells;
  const mat = new Date(matStr);
  if (isNaN(mat)) continue;
  const clean = Number(cleanStr.replace(/[£,]/g, ''));
  const dirty = Number(dirtyStr.replace(/[£,]/g, ''));
  if (!clean || !dirty) continue;
  gilts.push({
    ticker, name, coupon,
    maturity: matStr, matYear: mat.getFullYear(), matDate: mat,
    clean, dirty,
    realYield: Number(yieldStr.replace('%', '')),
    indexRatio: dirty / clean,
  });
}
if (!gilts.length) {
  console.error('Parsed no gilts — the source page layout may have changed.');
  process.exit(1);
}
gilts.sort((a, b) => a.matDate - b.matDate);

// Allocate each target year: exact-year match, else 50/50 nearest either side.
// Cost of £1 real redemption for a year = Σ clean/100 over the covering gilt(s)
// (face = real/indexRatio, cost = face × dirty/100, indexRatio = dirty/clean).
function coverage(y) {
  const exact = gilts.filter(g => g.matYear === y);
  if (exact.length) return [{ gilt: exact[exact.length - 1], share: 1 }];
  const before = [...gilts].reverse().find(g => g.matYear < y);
  const after = gilts.find(g => g.matYear > y);
  if (before && after) return [{ gilt: before, share: 0.5 }, { gilt: after, share: 0.5 }];
  return [{ gilt: before || after, share: 1 }];
}
const costPerPound = years.reduce((s, y) => s + coverage(y).reduce((t, c) => t + c.share * c.gilt.clean / 100, 0), 0);
const amount = amountArg !== null ? Number(amountArg) : budget / costPerPound;
const allocations = []; // {year, gilt, realAmount, note}
for (const y of years) {
  const exact = gilts.filter(g => g.matYear === y);
  if (exact.length) {
    const g = exact[exact.length - 1];
    allocations.push({ year: y, gilt: g, realAmount: amount, note: '' });
  } else {
    const before = [...gilts].reverse().find(g => g.matYear < y);
    const after = gilts.find(g => g.matYear > y);
    if (before && after) {
      allocations.push({ year: y, gilt: before, realAmount: amount / 2, note: `no ${y} linker — half via ${before.matYear}` });
      allocations.push({ year: y, gilt: after, realAmount: amount / 2, note: `no ${y} linker — half via ${after.matYear}` });
    } else {
      const g = before || after;
      allocations.push({ year: y, gilt: g, realAmount: amount, note: `no ${y} linker — nearest is ${g.matYear}` });
    }
  }
}

// Merge allocations that landed on the same gilt.
const byGilt = new Map();
for (const a of allocations) {
  const k = a.gilt.ticker;
  if (!byGilt.has(k)) byGilt.set(k, { gilt: a.gilt, realAmount: 0, forYears: [], notes: [] });
  const e = byGilt.get(k);
  e.realAmount += a.realAmount;
  e.forYears.push(a.year);
  if (a.note) e.notes.push(a.note);
}

const fmt = n => n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
console.log(`\nGILT LADDER ORDER SHEET — £${fmt(amount)} real REDEMPTION per year, years ${years[0]}–${years[years.length - 1]}${amountArg !== null ? ' (fixed --amount)' : ` (sized by £${fmt(budget)} budget)`}`);
console.log(`Prices: dividenddata.co.uk (LSE ~15-min delay), fetched ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC\n`);
console.log('EPIC   Gilt                                          Maturity      Dirty£   Real yld  Face to order   Est cost £   Covers');
console.log('-'.repeat(125));
let totalCost = 0, totalFace = 0;
for (const { gilt: g, realAmount, forYears, notes } of byGilt.values()) {
  const face = realAmount / g.indexRatio;
  const cost = (face / 100) * g.dirty;
  totalCost += cost; totalFace += face;
  console.log(
    `${g.ticker.padEnd(6)} ${g.name.padEnd(45)} ${g.maturity.padEnd(13)} ${g.dirty.toFixed(2).padStart(7)} ${String(g.realYield.toFixed(2) + '%').padStart(8)}  £${fmt(face).padStart(9)}    £${fmt(cost).padStart(8)}   ${forYears.join(', ')}${notes.length ? '  (' + notes[0] + ')' : ''}`
  );
}
console.log('-'.repeat(125));
console.log(`TOTAL${' '.repeat(85)}£${fmt(totalFace).padStart(9)}    £${fmt(totalCost).padStart(8)}\n`);
// Coupon top-up: real coupon income per year while each gilt is outstanding.
const couponRate = g => Number(String(g.coupon).replace('%', '')) / 100;
const thisYear = new Date().getFullYear();
const couponRow = [];
for (let y = thisYear + 1; y <= years[years.length - 1]; y++) {
  let cpn = 0;
  for (const { gilt: g, realAmount } of byGilt.values()) if (g.matYear >= y) cpn += realAmount * couponRate(g);
  couponRow.push(`${y}: £${fmt(cpn)}`);
}
console.log('Coupon top-up (real, approx, paid in two halves a year, on top of the redemptions):');
for (let i = 0; i < couponRow.length; i += 6) console.log('  ' + couponRow.slice(i, i + 6).join('   '));
console.log('');
console.log('Notes:');
console.log(' - Order the FACE (nominal) amount on II; you pay ~the dirty price per £100 face. The est cost is a budget, not a quote.');
console.log(' - Sizing counts redemption only; the coupon row above is the top-up on top of each £' + fmt(amount) + ' — it is NOT part of the rung.');
console.log(' - Index ratio estimated as dirty/clean (<0.5% error). For the exact settlement ratio see DMO daily index ratios.');
console.log(' - Cross-check dirty price at dealing: II quote screen, or LSE (search the EPIC).');
