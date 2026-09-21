// @ts-check
/**
 * Renderers: outputs.json → documents. Rule 3 of plan/README.md: a renderer does
 * no arithmetic and contains no numeric literals. Every number reaches a document
 * through `em.v(key, formatted)` which records (key, formatted) and, in HTML, wraps
 * the text in <span data-key="…">. tests/unit/plan/render.test.ts re-renders, reads
 * every emission back and checks it against the value at that path in outputs.
 *
 * renderAll(outputs, inputs, meta) → { 'summary.html': string, 'ledger.html': string,
 *   'assumptions.md': string, 'avc-recipe.md': string, 'ledger.csv': string,
 *   'order-sheet-isa.csv': string, 'order-sheet-sipp.csv': string, 'emissions.json': string }
 *
 * meta = { generatedAt: 'YYYY-MM-DD', assumptionsFile?: raw plan/assumptions.json, drift?: { verdict, items[] }, runId?: string }
 */
import { gbp, gbpShort, gbpFromK, kCell, k1, kTax, pct, int, dec, dateGB, yr } from './fmt.mjs';

/** assumptions the loader marks DERIVED-by-engine → where the engine puts the value in outputs */
const ENGINE_DERIVED = { 'income.abbyTakeHomeYear1': 'pivot.takeHomeYear1AtLine' };

/** Resolve a dotted path (array indices allowed: rows.3.total) */
export function getPath(/** @type {any} */ obj, /** @type {string} */ path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Emission recorder. Each document gets its own so the test can attribute keys. */
export function emitter(/** @type {string} */ docName, html = true) {
  /** @type {Array<{ doc: string, key: string, text: string }>} */
  const list = [];
  const esc = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return {
    list,
    /** emit a formatted value that came from `key` in outputs */
    v(/** @type {string} */ key, /** @type {string} */ text) { list.push({ doc: docName, key, text }); return html ? `<span data-key="${esc(key)}">${esc(text)}</span>` : text; },
    /** plain text that is not a number (labels) — escaped for HTML */
    t(/** @type {string} */ text) { return html ? esc(text) : text; },
  };
}

const CSS = `
:root{--ink:#0f2a4a;--navy:#14467d;--blue:#3a6ea5;--green:#2e9d5b;--amber:#c77c1b;--grey:#8a97a8;--line:#e3e8ef;--bg:#fbfcfe}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:72rem;margin:0 auto;padding:2rem 1.25rem 4rem}h1{font-size:1.9rem;margin:.2rem 0 .4rem}h2{font-size:1.25rem;margin:2.2rem 0 .6rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}h3{font-size:1.05rem;margin:1.4rem 0 .4rem}
.eyebrow{color:var(--grey);font-size:.85rem;letter-spacing:.04em;text-transform:uppercase}.lede{color:#3b4a5e;max-width:60rem}.meta{display:flex;flex-wrap:wrap;gap:.6rem 1.4rem;font-size:.9rem;color:#3b4a5e;margin:.6rem 0 1.2rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.8rem;margin:1rem 0}.tile{background:#fff;border:1px solid var(--line);border-radius:.6rem;padding:.9rem 1rem}.tile .n{font-size:1.5rem;font-weight:650;color:var(--navy)}.tile .l{font-size:.85rem;color:#3b4a5e}
.tile.g .n{color:var(--navy)}.tile.e .n{color:var(--green)}.tile.a .n{color:var(--amber)}
table{border-collapse:collapse;width:100%;background:#fff;font-size:.9rem;font-variant-numeric:tabular-nums}th,td{padding:.35rem .55rem;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th{background:#f2f5f9;font-weight:600}th.left,td.left{text-align:left}td.wrap{white-space:normal}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:.5rem}.g{color:var(--navy)}.e{color:var(--green)}.tot{font-weight:650}.sep{border-left:2px solid var(--line)}
.note{font-size:.88rem;color:#3b4a5e}.box{background:#fff;border:1px solid var(--line);border-left:4px solid var(--navy);border-radius:.5rem;padding:.9rem 1rem;margin:1rem 0}.box.warn{border-left-color:var(--amber)}
.ok{color:var(--green)}.amber{color:var(--amber)}.red{color:#b3261e;font-weight:650}code{font-family:ui-monospace,Consolas,monospace;font-size:.85em;background:#f2f5f9;padding:.05rem .3rem;border-radius:.25rem}
dl{display:grid;grid-template-columns:max-content 1fr;gap:.3rem 1rem}dt{font-weight:600}
`;

function page(/** @type {string} */ title, /** @type {string} */ body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;
}

function limitationsBlock(/** @type {ReturnType<typeof emitter>} */ em, /** @type {any[]} */ lims, html = true) {
  if (!lims?.length) return '';
  if (html) return `<h2>What this model knowingly gets wrong</h2><ul class="note">${lims.map((l) => `<li id="lim-${em.t(l.id)}"><b>${em.t(l.id)}</b> — ${em.t(l.text)}${l.impact ? ` <i>(${em.t(l.impact)})</i>` : ''}${l.fixBy ? ` <span class="amber">fix by ${em.t(l.fixBy)}</span>` : ''}</li>`).join('')}</ul>`;
  return `\n## What this model knowingly gets wrong\n\n${lims.map((l) => `- **${l.id}** — ${l.text}${l.impact ? ` _(${l.impact})_` : ''}${l.fixBy ? ` — fix by ${l.fixBy}` : ''}`).join('\n')}\n`;
}

function driftBlock(/** @type {ReturnType<typeof emitter>} */ em, /** @type {any} */ drift) {
  if (!drift) return '';
  const cls = drift.verdict === 'RED' ? 'red' : drift.verdict === 'AMBER' ? 'amber' : 'ok';
  return `<div class="box ${drift.verdict === 'GREEN' ? '' : 'warn'}"><b>Inputs check: <span class="${cls}">${em.t(drift.verdict)}</span></b><ul class="note">${drift.items.map((/** @type {any} */ d) => `<li><span class="${d.level === 'RED' ? 'red' : d.level === 'AMBER' ? 'amber' : 'ok'}">${em.t(d.level)}</span> ${em.t(d.item)}: ${em.t(d.detail)}</li>`).join('')}</ul></div>`;
}

// ---------------------------------------------------------------------------
// summary.html — the one page Abby reads
// ---------------------------------------------------------------------------
export function renderSummary(/** @type {any} */ o, /** @type {any} */ inputs, /** @type {any} */ meta) {
  const em = emitter('summary.html');
  const a = inputs.assumptions;
  const L = o.ledger, R = o.pivot.avcRecipe;
  const rowAt = (/** @type {number} */ y) => L.rows.findIndex((/** @type {any} */ r) => r.year === y);
  const iR = rowAt(a.dates.planRetirementYear), iE = L.rows.length - 1;
  const tiles = [
    `<div class="tile"><div class="n">${em.v('inputs.assumptions.pots.total', gbpShort(a.pots.total))}</div><div class="l">Everything outside the house and the business, ${em.t(dateGB(inputs.observations?.snapshots?.asOf ?? a.pots.__asOf ?? meta.generatedAt))}</div></div>`,
    `<div class="tile g"><div class="n">${em.v('inputs.assumptions.ladder.budgetReal', gbpShort(a.ladder.budgetReal))}</div><div class="l">Index-linked gilt ladder, rungs ${em.v('inputs.assumptions.ladder.firstYear', yr(a.ladder.firstYear))}–${em.v('inputs.assumptions.ladder.lastYear', yr(a.ladder.lastYear))}</div></div>`,
    `<div class="tile g"><div class="n">${em.v('ledger.wrappers.isa.R', gbpFromK(L.wrappers.isa.R))}</div><div class="l">Redeemed by each ISA rung (${em.v('ledger.wrappers.sipp.R', gbpFromK(L.wrappers.sipp.R))} per SIPP rung), plus coupons</div></div>`,
    `<div class="tile e"><div class="n">${em.v(`ledger.rows.${iR}.total`, gbpFromK(L.rows[iR].total))}</div><div class="l">Pots at retirement, ${em.v(`ledger.rows.${iR}.year`, yr(L.rows[iR].year))}, planning case</div></div>`,
    `<div class="tile e"><div class="n">${em.v(`ledger.rows.${iE}.total`, gbpFromK(L.rows[iE].total))}</div><div class="l">Left at ${em.v(`ledger.rows.${iE}.year`, yr(L.rows[iE].year))} after ${em.v('inputs.assumptions.spend.retirementTarget', gbp(a.spend.retirementTarget))} a year, planning case</div></div>`,
    R ? `<div class="tile a"><div class="n">${em.v('pivot.avcRecipe.avcPct', int(R.avcPct) + '%')}</div><div class="l">Abby's AVC for the rest of ${em.t(R.taxYear)}; take-home about ${em.v('pivot.avcRecipe.netMonthlyAfter', gbp(R.netMonthlyAfter))} a month</div></div>` : '',
  ].join('');
  const avc = R ? `<h2>Abby's payslip: what to set</h2><div class="box"><p>From the ${em.t(inputs.observations?.payslip?.month ?? '')} payslip (tax month ${em.v('pivot.avcRecipe.taxMonth', int(R.taxMonth))}): doing nothing, adjusted net income lands at ${em.v('pivot.avcRecipe.aniDoNothing', gbp(R.aniDoNothing))}. To finish the year at ${em.v('pivot.avcRecipe.target', gbp(R.target))} the remaining ${em.v('pivot.avcRecipe.remaining', int(R.remaining))} payslips need ${em.v('pivot.avcRecipe.extraNeeded', gbp(R.extraNeeded))} of extra sacrifice, so <b>set the AVC to ${em.v('pivot.avcRecipe.avcPct', int(R.avcPct) + '%')}</b> (${em.v('pivot.avcRecipe.actualPerPayslip', gbp(R.actualPerPayslip))} a payslip). Income then lands at ${em.v('pivot.avcRecipe.landedAni', gbp(R.landedAni))}, take-home falls by about ${em.v('pivot.avcRecipe.netCutMonthly', gbp(R.netCutMonthly))} to ${em.v('pivot.avcRecipe.netMonthlyAfter', gbp(R.netMonthlyAfter))} a month, and paid basic stays at ${em.v('pivot.avcRecipe.paidBasicAnnual', gbp(R.paidBasicAnnual))} against a minimum-wage floor of ${em.v('pivot.avcRecipe.nmwFloor', gbp(R.nmwFloor))} (${R.nmwOk ? '<span class="ok">fine</span>' : '<span class="red">breach — sacrifice bonus instead</span>'}).</p>${R.aboveCliff ? '<p class="red">Above the cliff even at this rate: sacrifice bonus or add a lump sum.</p>' : ''}</div>` : '';
  const prog = o.pivot.programme;
  const progRows = prog.years.map((/** @type {any} */ y, /** @type {number} */ i) => `<tr><td class="left">${em.t(y.taxYear)}</td><td>${em.v(`pivot.programme.years.${i}.avcPct`, int(y.avcPct) + '%')}</td><td>${em.v(`pivot.programme.years.${i}.extraSacrifice`, gbp(y.extraSacrifice))}</td><td>${em.v(`pivot.programme.years.${i}.takeHomeCut`, gbp(y.takeHomeCut))}</td><td>${em.v(`pivot.programme.years.${i}.cbKept`, gbp(y.cbKept))}</td></tr>`).join('');
  const flat = o.ledgerFlat.map((/** @type {any} */ f, /** @type {number} */ i) => `<tr><td class="left">${em.v(`ledgerFlat.${i}.G`, pct(f.G, 0))} real</td><td>${em.v(`ledgerFlat.${i}.atRetirement`, gbpFromK(f.atRetirement))}</td><td>${em.v(`ledgerFlat.${i}.atLastRung`, gbpFromK(f.atLastRung))}</td><td>${em.v(`ledgerFlat.${i}.atEnd`, gbpFromK(f.atEnd))}</td><td>${em.v(`ledgerFlat.${i}.lifeTax`, gbpFromK(f.lifeTax))}</td><td>${f.firstCashNegative ? `<span class="red">${em.v(`ledgerFlat.${i}.firstCashNegative`, yr(f.firstCashNegative))}</span>` : '<span class="ok">never</span>'}</td></tr>`).join('');
  const body = `
<header><div class="eyebrow">Household plan · generated ${em.t(meta.generatedAt)}${meta.runId ? ` · run ${em.t(meta.runId)}` : ''} · engine ${em.t(o.engineVersion)}</div>
<h1>Where we are, and what to do this month</h1>
<p class="lede">Everything in today's money. Numbers come from <code>plan/assumptions.json</code> (prepared ${em.t(a.__preparedOn ?? '')}) and the observations listed at the foot; nothing on this page is typed by hand.</p>
<div class="meta"><span>Retire <b>${em.v('inputs.assumptions.dates.planRetirementYear', yr(a.dates.planRetirementYear))}</b></span><span>Spend <b>${em.v('inputs.assumptions.spend.planLine', gbpShort(a.spend.planLine))}</b> a year to then, <b>${em.v('inputs.assumptions.spend.retirementTarget', gbpShort(a.spend.retirementTarget))}</b> after</span><span>Equity <b>${em.v('inputs.assumptions.returns.realEquity.planning', pct(a.returns.realEquity.planning, 0))} real</b> in the planning case</span><span>Gilts at the <b>${em.t(dateGB(L.yieldsAsOf))}</b> curve</span></div></header>
<div class="tiles">${tiles}</div>
${driftBlock(em, meta.drift)}
${avc}
<h2>The pivot: Abby's salary sacrifice, year by year</h2>
<p class="note">Modelled to the ${em.v('pivot.modelledTo', gbp(o.pivot.modelledTo))} line, operated to ${em.v('pivot.operatedTo', gbp(o.pivot.operatedTo))}. Over the programme: ${em.v('pivot.programme.totals.extraSacrifice', gbpShort(prog.totals.extraSacrifice))} extra into her pension for ${em.v('pivot.programme.totals.takeHomeCut', gbpShort(prog.totals.takeHomeCut))} of take-home, keeping ${em.v('pivot.programme.totals.cbKept', gbpShort(prog.totals.cbKept))} of child benefit.</p>
<div class="scroll"><table><thead><tr><th class="left">Tax year</th><th>AVC %</th><th>Extra sacrifice</th><th>Take-home given up</th><th>Child benefit kept</th></tr></thead><tbody>${progRows}</tbody></table></div>
<h2>How the plan holds up</h2>
<div class="scroll"><table><thead><tr><th class="left">Equity return, every year</th><th>At retirement</th><th>After the last rung</th><th>At the end</th><th>Lifetime tax</th><th>Cash runs out</th></tr></thead><tbody>${flat}</tbody></table></div>
<p class="note">Spend ${em.v('inputs.assumptions.spend.retirementTarget', gbpShort(a.spend.retirementTarget))} a year from retirement, state pensions of ${em.v('inputs.assumptions.statePension.annualEach', gbpShort(a.statePension.annualEach))} each from ${em.v('inputs.assumptions.dates.chrisStatePensionYear', yr(a.dates.chrisStatePensionYear))} and ${em.v('inputs.assumptions.dates.abbyStatePensionYear', yr(a.dates.abbyStatePensionYear))}. The full ledger is in <code>ledger.html</code>.</p>
${limitationsBlock(em, o.knownLimitations)}
<h2>Inputs behind this page</h2>
<dl><dt>Assumptions</dt><dd><code>plan/assumptions.json</code> prepared ${em.t(a.__preparedOn ?? '')} — register in <code>assumptions.md</code></dd>
<dt>Gilt prices</dt><dd>${em.t(inputs.giltPrices?.asOf ?? '')} ${em.t(inputs.observations?.giltPrices?.live ? '(live)' : '(observation file)')}</dd>
<dt>Gilt yields for the ledger</dt><dd>${em.t(L.yieldsAsOf)}</dd>
<dt>Payslip</dt><dd>${em.t(inputs.observations?.payslip ? `${inputs.observations.payslip.month} (tax month ${inputs.observations.payslip.taxMonth})` : 'none')}</dd>
<dt>Snapshots</dt><dd>${em.t(inputs.observations?.snapshots?.asOf ?? 'not collected (offline run)')}</dd></dl>`;
  return { html: page('Household plan — summary', body), emissions: em.list };
}

// ---------------------------------------------------------------------------
// ledger.html — Plan E account by account, year by year
// ---------------------------------------------------------------------------
export function renderLedger(/** @type {any} */ o, /** @type {any} */ inputs, /** @type {any} */ meta) {
  const em = emitter('ledger.html');
  const a = inputs.assumptions;
  const L = o.ledger;
  const rungRows = ['isa', 'sipp'].flatMap((w) => L.wrappers[w].rungs.map((/** @type {any} */ r, /** @type {number} */ i) => `<tr><td>${em.v(`ledger.wrappers.${w}.rungs.${i}.y`, yr(r.y))}</td><td class="left">${em.t(w === 'isa' ? 'ISAs' : 'Chris II SIPP')}</td><td class="left">${em.t(r.epic)}</td><td>${em.v(`ledger.wrappers.${w}.rungs.${i}.yld`, pct(r.yld, 2))}</td><td>${em.v(`ledger.wrappers.${w}.rungs.${i}.price`, dec(r.price, 4))}</td><td>${em.v(`ledger.wrappers.${w}.rungs.${i}.cost`, k1(r.cost))}</td><td>${em.v(`ledger.wrappers.${w}.R`, k1(L.wrappers[w].R))}${r.mult !== 1 ? ` × ${em.v(`ledger.wrappers.${w}.rungs.${i}.mult`, dec(r.mult, 1))}` : ''}</td></tr>`));
  const cpn = Object.keys(L.wrappers.isa.flows).map((y) => `${em.t(y)}: ${em.v(`ledger.wrappers.isa.flows.${y}.coupon`, k1(L.wrappers.isa.flows[y].coupon))}+${em.v(`ledger.wrappers.sipp.flows.${y}.coupon`, k1(L.wrappers.sipp.flows[y]?.coupon ?? 0))}`).join(' · ');
  const yearRows = L.rows.map((/** @type {any} */ r, /** @type {number} */ i) => {
    const c = (/** @type {string} */ f, /** @type {string} */ text, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${em.v(`ledger.rows.${i}.${f}`, text)}</td>`;
    return `<tr><th scope="row">${em.v(`ledger.rows.${i}.year`, yr(r.year))}</th>${c('isaLadC', kCell(r.isaLadC), 'g')}${c('isaLadA', kCell(r.isaLadA), 'g')}${c('sippLad', kCell(r.sippLad), 'g')}${c('pensionEq', kCell(r.pensionEq), 'e')}${c('abbyDC', kCell(r.abbyDC), 'e')}${c('isaEq', kCell(r.isaEq), 'e')}${c('gia', kCell(r.gia))}${c('cash', kCell(r.cash))}${c('crypto', kCell(r.crypto))}${c('total', kCell(r.total), 'tot')}${c('ladder', kCell(r.ladder), 'sep g')}${c('coupons', kCell(r.coupons))}${c('hb', kCell(r.hb))}${c('sp', kCell(r.sp))}${c('drawC', kCell(r.drawC))}${c('drawA', kCell(r.drawA))}${c('tfc', kCell(r.tfc))}${c('tax', kTax(r.tax))}${c('surplus', kCell(r.surplus))}${c('taxedDraw', kCell(r.taxedDraw))}</tr>`;
  }).join('');
  const flat = o.ledgerFlat.map((/** @type {any} */ f, /** @type {number} */ i) => `<tr><td class="left">${em.v(`ledgerFlat.${i}.G`, pct(f.G, 0))} real</td><td>${em.v(`ledgerFlat.${i}.atRetirement`, gbpFromK(f.atRetirement))}</td><td>${em.v(`ledgerFlat.${i}.atLastRung`, gbpFromK(f.atLastRung))}</td><td>${em.v(`ledgerFlat.${i}.atEnd`, gbpFromK(f.atEnd))}</td><td>${em.v(`ledgerFlat.${i}.lifeTax`, gbpFromK(f.lifeTax))}</td></tr>`).join('');
  const body = `
<header><div class="eyebrow">Plan E ledger · generated ${em.t(meta.generatedAt)} · engine ${em.t(o.engineVersion)}</div>
<h1>The flat gilt ladder, account by account, year by year</h1>
<p class="lede">Real £k throughout. Row ${em.v('ledger.baseYear', yr(L.baseYear))} is the snapshot balances; each later row is September of that year, after that year's rung has matured. Growth: equity ${em.v('inputs.assumptions.returns.realEquity.planning', pct(a.returns.realEquity.planning, 0))} real, cash ${em.v('inputs.assumptions.returns.cashReal', pct(a.returns.cashReal, 1))} real, each ladder at its own locked real yield.</p>
<div class="meta"><span>Retire <b>${em.v('inputs.assumptions.dates.planRetirementYear', yr(a.dates.planRetirementYear))}</b></span><span>Spend <b>${em.v('inputs.assumptions.spend.retirementTarget', gbpShort(a.spend.retirementTarget))}</b> real</span><span>HB <b>${em.v('inputs.assumptions.income.hbPostRetirement', gbpShort(a.income.hbPostRetirement))}</b> a year to ${em.v('inputs.assumptions.dates.chrisPensionAccessYear', yr(a.dates.chrisPensionAccessYear))}</span><span>Yields <b>${em.t(dateGB(L.yieldsAsOf))}</b></span></div></header>
<h2>The ladder</h2>
<p class="note">Each wrapper's money buys a redemption per rung-year at the observed yields (coupon-inclusive prices): ISA ${em.v('ledger.wrappers.isa.budget', gbpFromK(L.wrappers.isa.budget))} buys ${em.v('ledger.wrappers.isa.R', gbpFromK(L.wrappers.isa.R))} a year (portfolio real yield ${em.v('ledger.wrappers.isa.irr', pct(L.wrappers.isa.irr, 2))}); SIPP ${em.v('ledger.wrappers.sipp.budget', gbpFromK(L.wrappers.sipp.budget))} buys ${em.v('ledger.wrappers.sipp.R', gbpFromK(L.wrappers.sipp.R))} a year (${em.v('ledger.wrappers.sipp.irr', pct(L.wrappers.sipp.irr, 2))}). Coupons are paid separately and are the top-up, not part of the rung.</p>
<div class="scroll"><table><thead><tr><th>Matures</th><th class="left">Wrapper</th><th class="left">Gilt</th><th>Real yield</th><th>Price per pound redeemed</th><th>Cost £k</th><th>Redeems £k real</th></tr></thead><tbody>${rungRows}</tbody></table></div>
<p class="note">Coupons by year, real £k (ISA + SIPP): ${cpn}</p>
<h2>Where the money sits, and what it paid for</h2>
<div class="scroll"><table><thead><tr><th></th><th colspan="10">Where the money sits, £k real</th><th colspan="10" class="sep">Income and what it paid for, £k real</th></tr>
<tr><th>Year</th><th class="g">Ladder Chris ISA</th><th class="g">Ladder Abby ISA</th><th class="g">Ladder SIPP</th><th class="e">Pension equity</th><th class="e">Abby DC</th><th class="e">ISA equity</th><th>GIA</th><th>Cash</th><th>Crypto</th><th>Total</th><th class="sep g">Rung + coupons paid</th><th>of which coupons</th><th>HB</th><th>State pension</th><th>Chris draw</th><th>Abby draw</th><th>Tax-free cash</th><th>Income tax</th><th>Surplus reinvested</th><th>Taxed draw</th></tr></thead><tbody>${yearRows}</tbody></table></div>
<p class="note">Lifetime income tax in this path: ${em.v('ledger.lifeTax', gbpFromK(L.lifeTax))}. The AVC schedule feeding Abby's DC: ${L.avcSchedule.map((/** @type {number} */ x, /** @type {number} */ i) => em.v(`ledger.avcSchedule.${i}`, k1(x))).join(', ')} £k plus payroll ${em.v('ledger.payrollReal', k1(L.payrollReal))} £k a year.</p>
<h2>Other return worlds</h2>
<div class="scroll"><table><thead><tr><th class="left">Equity real return, every year</th><th>At retirement</th><th>After the last rung</th><th>At the end</th><th>Lifetime tax</th></tr></thead><tbody>${flat}</tbody></table></div>
${limitationsBlock(em, o.knownLimitations)}`;
  return { html: page('Plan E ledger', body), emissions: em.list };
}

// ---------------------------------------------------------------------------
// assumptions.md — the register with provenance
// ---------------------------------------------------------------------------
export function renderAssumptionsMd(/** @type {any} */ o, /** @type {any} */ inputs, /** @type {any} */ meta) {
  const em = emitter('assumptions.md', false);
  const file = meta.assumptionsFile;
  if (!file) return { text: `# Assumptions register\n\n_Not available: the run did not carry the raw assumptions file._\n`, emissions: em.list };
  const lines = [`# Assumptions register`, ``, `Prepared ${file.preparedOn}; ${file.moneyBasis ?? ''}. Generated ${meta.generatedAt}. Statuses: FACT documented · CHECK pending verification · GUESS · DECISION (cites plan/decisions.md) · DERIVED (formula, recomputed by the loader).`, ``, `| Key | Value | Status | Source | As of | Review by |`, `|---|---|---|---|---|---|`];
  for (const [key, e] of Object.entries(file.entries)) {
    const enginePath = /** @type {Record<string, string>} */ (ENGINE_DERIVED)[key];
    const v = enginePath ? getPath(o, enginePath) : getPath(inputs.assumptions, key);
    const srcKey = enginePath ?? `inputs.assumptions.${key}`;
    let cell;
    if (typeof v === 'number') cell = em.v(srcKey, Math.abs(v) < 1 ? String(v) : int(v));
    else if (Array.isArray(v)) cell = em.v(srcKey, v.join(','));
    else if (v && typeof v === 'object') cell = em.t(`(${Object.keys(v).length} entries — see assumptions.json)`);
    else cell = em.v(srcKey, String(v));
    lines.push(`| \`${key}\` | ${cell} | ${e.status}${enginePath ? ' (engine)' : ''} | ${(e.status === 'DERIVED' ? `= ${e.formula}` : e.source ?? '').replace(/\|/g, '/')} | ${e.asOf ?? ''} | ${e.reviewBy ?? ''} |`);
  }
  lines.push(limitationsBlock(em, o.knownLimitations, false));
  return { text: lines.join('\n') + '\n', emissions: em.list };
}

// ---------------------------------------------------------------------------
// avc-recipe.md, ledger.csv, order-sheet csvs
// ---------------------------------------------------------------------------
export function renderAvcMd(/** @type {any} */ o, /** @type {any} */ inputs, /** @type {any} */ meta) {
  const em = emitter('avc-recipe.md', false);
  const R = o.pivot.avcRecipe;
  if (!R) return { text: `# AVC recipe\n\n_No payslip observation in this run._\n`, emissions: em.list };
  const text = `# Abby's AVC recipe — ${R.taxYear}, from tax month ${em.v('pivot.avcRecipe.taxMonth', int(R.taxMonth))}

Generated ${meta.generatedAt} from payslip ${inputs.observations?.payslip?.month ?? ''}.

- Projected adjusted net income doing nothing: ${em.v('pivot.avcRecipe.aniDoNothing', gbp(R.aniDoNothing))}
- Operating target: ${em.v('pivot.avcRecipe.target', gbp(R.target))}
- Extra sacrifice still needed: ${em.v('pivot.avcRecipe.extraNeeded', gbp(R.extraNeeded))} over ${em.v('pivot.avcRecipe.remaining', int(R.remaining))} payslips
- **Set the AVC to ${em.v('pivot.avcRecipe.avcPct', int(R.avcPct) + '%')}** (${em.v('pivot.avcRecipe.actualPerPayslip', gbp(R.actualPerPayslip))} a payslip)
- Income then lands at ${em.v('pivot.avcRecipe.landedAni', gbp(R.landedAni))} (${em.v('pivot.avcRecipe.bufferBelowCliff', gbp(R.bufferBelowCliff))} under the cliff)
- Take-home: about ${em.v('pivot.avcRecipe.netMonthlyAfter', gbp(R.netMonthlyAfter))} a month (cut ${em.v('pivot.avcRecipe.netCutMonthly', gbp(R.netCutMonthly))})
- Paid basic ${em.v('pivot.avcRecipe.paidBasicAnnual', gbp(R.paidBasicAnnual))} vs minimum-wage floor ${em.v('pivot.avcRecipe.nmwFloor', gbp(R.nmwFloor))}: ${R.nmwOk ? 'OK' : 'BREACH — sacrifice bonus instead'}
${R.aboveCliff ? '\n**Above the cliff even at this rate: sacrifice bonus or add a lump sum.**\n' : ''}`;
  return { text, emissions: em.list };
}

export function renderLedgerCsv(/** @type {any} */ o) {
  const em = emitter('ledger.csv', false);
  const cols = ['year', 'isaLadC', 'isaLadA', 'sippLad', 'sippEq', 'acn', 'abbyDC', 'abbyIsaEq', 'isaEqNew', 'gia', 'cash', 'crypto', 'shares', 'total', 'ladder', 'coupons', 'hb', 'sp', 'drawC', 'drawA', 'tfc', 'tax', 'surplus', 'taxedDraw'];
  const lines = [cols.join(',')];
  o.ledger.rows.forEach((/** @type {any} */ r, /** @type {number} */ i) => lines.push(cols.map((c) => em.v(`ledger.rows.${i}.${c}`, c === 'year' ? yr(r.year) : dec(Number(r[c] ?? 0), 1))).join(',')));
  return { text: lines.join('\n') + '\n', emissions: em.list };
}

export function renderOrderSheetCsv(/** @type {any} */ o, /** @type {'isa'|'sipp'} */ w) {
  const em = emitter(`order-sheet-${w}.csv`, false);
  const P = o.ladder?.[w];
  if (!P) return { text: 'no prices in this run\n', emissions: em.list };
  const lines = [`epic,gilt,maturity,dirty,realYieldPct,faceToOrder,estCost,realAmount,coversYears,notes`];
  P.byGilt.forEach((/** @type {any} */ g, /** @type {number} */ i) => lines.push([g.epic, `"${g.giltName}"`, g.maturity, em.v(`ladder.${w}.byGilt.${i}.dirty`, dec(g.dirty, 2)), em.v(`ladder.${w}.byGilt.${i}.realYield`, dec(g.realYield, 2)), em.v(`ladder.${w}.byGilt.${i}.face`, int(g.face)), em.v(`ladder.${w}.byGilt.${i}.estCost`, int(g.estCost)), em.v(`ladder.${w}.byGilt.${i}.realAmount`, int(g.realAmount)), `"${g.coversYears.join(' ')}"`, `"${g.notes.join('; ')}"`].join(',')));
  lines.push(`TOTAL,,,,,${em.v(`ladder.${w}.totals.face`, int(P.totals.face))},${em.v(`ladder.${w}.totals.estCost`, int(P.totals.estCost))},${em.v(`ladder.${w}.totals.realAmount`, int(P.totals.realAmount))},,"redemption per year ${em.v(`ladder.${w}.amountPerYear`, int(P.amountPerYear))}; prices ${o.ladder.pricesAsOf}"`);
  return { text: lines.join('\n') + '\n', emissions: em.list };
}

/** All documents for a run. */
export function renderAll(/** @type {any} */ outputs, /** @type {any} */ inputs, /** @type {any} */ meta = {}) {
  const m = { generatedAt: inputs.today ?? '', ...meta };
  const s = renderSummary(outputs, inputs, m), l = renderLedger(outputs, inputs, m), am = renderAssumptionsMd(outputs, inputs, m), av = renderAvcMd(outputs, inputs, m), lc = renderLedgerCsv(outputs), oi = renderOrderSheetCsv(outputs, 'isa'), os = renderOrderSheetCsv(outputs, 'sipp');
  const emissions = [...s.emissions, ...l.emissions, ...am.emissions, ...av.emissions, ...lc.emissions, ...oi.emissions, ...os.emissions];
  return {
    'summary.html': s.html, 'ledger.html': l.html, 'assumptions.md': am.text, 'avc-recipe.md': av.text, 'ledger.csv': lc.text,
    'order-sheet-isa.csv': oi.text, 'order-sheet-sipp.csv': os.text,
    'emissions.json': JSON.stringify(emissions),
  };
}
