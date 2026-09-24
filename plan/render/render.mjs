// @ts-check
/**
 * Renderers: outputs.json → documents. Rule 3 of plan/README.md: a renderer does
 * no arithmetic and contains no numeric literals. Every number reaches a document
 * through `em.v(key, formatted)` which records (key, formatted) and, in HTML, wraps
 * the text in <span data-key="…">. tests/unit/plan/render.test.ts re-renders, reads
 * every emission back and checks it against the value at that path in outputs.
 *
 * renderAll(outputs, inputs, meta) → { 'summary.html': string, 'ledger.html': string, 'execution.html': string,
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
  const flat = o.ledgerFlat.map((/** @type {any} */ f, /** @type {number} */ i) => `<tr><td class="left">${em.v(`ledgerFlat.${i}.G`, pct(f.G, 0))} real</td><td>${em.v(`ledgerFlat.${i}.atRetirement`, gbpFromK(f.atRetirement))}</td><td>${em.v(`ledgerFlat.${i}.atLastRung`, gbpFromK(f.atLastRung))}</td><td>${em.v(`ledgerFlat.${i}.atEnd`, gbpFromK(f.atEnd))}</td><td>${em.v(`ledgerFlat.${i}.lifeTax`, gbpFromK(f.lifeTax))}</td><td>${em.v(`ledgerFlat.${i}.iht`, gbpFromK(f.iht))}</td><td>${em.v(`ledgerFlat.${i}.netToHeirs`, gbpFromK(f.netToHeirs))}</td><td>${f.firstCashNegative ? `<span class="red">${em.v(`ledgerFlat.${i}.firstCashNegative`, yr(f.firstCashNegative))}</span>` : '<span class="ok">never</span>'}</td></tr>`).join('');
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
<div class="scroll"><table><thead><tr><th class="left">Equity return, every year</th><th>At retirement</th><th>After the last rung</th><th>At the end</th><th>Lifetime tax</th><th>Inheritance tax (est.)</th><th>Left to the children</th><th>Cash runs out</th></tr></thead><tbody>${flat}</tbody></table></div>
<p class="note">Spend ${em.v('inputs.assumptions.spend.retirementTarget', gbpShort(a.spend.retirementTarget))} a year from retirement, state pensions of ${em.v('inputs.assumptions.statePension.annualEach', gbpShort(a.statePension.annualEach))} each from ${em.v('inputs.assumptions.dates.chrisStatePensionYear', yr(a.dates.chrisStatePensionYear))} and ${em.v('inputs.assumptions.dates.abbyStatePensionYear', yr(a.dates.abbyStatePensionYear))}. The full ledger, the spend × return grid and the historical replay are in <code>ledger.html</code>. "Left to the children" is the estate at the end after inheritance tax and the income tax they would pay drawing inherited pensions, before the house.</p>
${estateBlock(em, o, a)}
${scenariosBlock(em, o, a, false)}
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
    return `<tr><th scope="row">${em.v(`ledger.rows.${i}.year`, yr(r.year))}</th>${c('isaLadC', kCell(r.isaLadC), 'g')}${c('isaLadA', kCell(r.isaLadA), 'g')}${c('sippLad', kCell(r.sippLad), 'g')}${c('pensionEq', kCell(r.pensionEq), 'e')}${c('abbyDC', kCell(r.abbyDC), 'e')}${c('isaEq', kCell(r.isaEq), 'e')}${c('gia', kCell(r.gia))}${c('cash', kCell(r.cash))}${c('crypto', kCell(r.crypto))}${c('total', kCell(r.total), 'tot')}${c('ladder', kCell(r.ladder), 'sep g')}${c('coupons', kCell(r.coupons))}${c('hb', kCell(r.hb))}${c('sp', kCell(r.sp))}${c('drawC', kCell(r.drawC))}${c('drawA', kCell(r.drawA))}${c('tfc', kCell(r.tfc))}${c('tax', kTax(r.tax))}${c('surplus', kCell(r.surplus))}${c('taxedDraw', kCell(r.taxedDraw))}${c('giftable', kCell(r.giftable))}</tr>`;
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
<div class="scroll"><table><thead><tr><th></th><th colspan="10">Where the money sits, £k real</th><th colspan="11" class="sep">Income and what it paid for, £k real</th></tr>
<tr><th>Year</th><th class="g">Ladder Chris ISA</th><th class="g">Ladder Abby ISA</th><th class="g">Ladder SIPP</th><th class="e">Pension equity</th><th class="e">Abby DC</th><th class="e">ISA equity</th><th>GIA</th><th>Cash</th><th>Crypto</th><th>Total</th><th class="sep g">Rung + coupons paid</th><th>of which coupons</th><th>HB</th><th>State pension</th><th>Chris draw</th><th>Abby draw</th><th>Tax-free cash</th><th>Income tax</th><th>Surplus reinvested</th><th>Taxed draw</th><th>Giftable income</th></tr></thead><tbody>${yearRows}</tbody></table></div>
<p class="note">Drawdown: ${em.t(L.drawdown === 'basicBand' ? 'each pension drawn to the top of the basic-rate band from the year it opens' : 'personal allowance draws, tax-free cash first')}. Lifetime income tax in this path: ${em.v('ledger.lifeTax', gbpFromK(L.lifeTax))}. The AVC schedule feeding Abby's DC, in today's money: ${L.avcSchedule.map((/** @type {number} */ x, /** @type {number} */ i) => em.v(`ledger.avcSchedule.${i}`, k1(x))).join(', ')} £k plus payroll ${em.v('ledger.payrollReal', k1(L.payrollReal))} £k a year.</p>
<h2>Other return worlds</h2>
<div class="scroll"><table><thead><tr><th class="left">Equity real return, every year</th><th>At retirement</th><th>After the last rung</th><th>At the end</th><th>Lifetime tax</th></tr></thead><tbody>${flat}</tbody></table></div>
${estateBlock(em, o, a)}
${scenariosBlock(em, o, a, true)}
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
  const cols = ['year', 'isaLadC', 'isaLadA', 'sippLad', 'sippEq', 'acn', 'abbyDC', 'abbyIsaEq', 'isaEqNew', 'gia', 'cash', 'crypto', 'shares', 'total', 'ladder', 'coupons', 'hb', 'sp', 'drawC', 'drawA', 'tfc', 'tax', 'surplus', 'taxedDraw', 'giftable'];
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

// ---------------------------------------------------------------------------
// estate block (summary + ledger): the drawdown strategy, inheritance tax, giftable income
// ---------------------------------------------------------------------------
function estateBlock(/** @type {ReturnType<typeof emitter>} */ em, /** @type {any} */ o, /** @type {any} */ a) {
  const E = o.ledger?.estate;
  if (!E) return '';
  const P = o.scenarios?.scenarios?.paFillDrawdown;
  const j = P ? P.cases.findIndex((/** @type {any} */ x) => x.G === a.returns.realEquity.planning) : -1;
  const cmp = P && j >= 0 ? ` Drawing only to the personal allowance and taking tax-free cash first (the previous assumption) would leave about ${em.v(`scenarios.scenarios.paFillDrawdown.cases.${j}.netToHeirs`, gbpFromK(P.cases[j].netToHeirs))} after ${em.v(`scenarios.scenarios.paFillDrawdown.cases.${j}.iht`, gbpFromK(P.cases[j].iht))} of inheritance tax.` : '';
  const gift = E.giftableFrom === null
    ? 'In this case no year has income left over after spending, so nothing is giftable from income.'
    : `Income left over after spending that could be given away under the normal-expenditure-out-of-income exemption: ${em.v('ledger.estate.giftableTotal', gbpFromK(E.giftableTotal))} in all, about ${em.v('ledger.estate.giftableAvg', gbpFromK(E.giftableAvg))} a year from ${em.v('ledger.estate.giftableFrom', yr(E.giftableFrom))}.`;
  return `<h2>Drawing the pensions, and what is left</h2><div class="box"><p>From the year each pension opens, the plan draws taxable pension income up to the top of the basic-rate band (a quarter of each withdrawal tax-free while the lump sum allowance lasts), paying basic-rate tax now rather than leaving pensions to be taxed on death. Planning case, ${em.v('inputs.assumptions.returns.realEquity.planning', pct(a.returns.realEquity.planning, 0))} real: the estate at ${em.v('ledger.estate.year', yr(E.year))} is ${em.v('ledger.estate.total', gbpFromK(E.total))}, of which ${em.v('ledger.estate.pensions', gbpFromK(E.pensions))} is still in pensions. Inheritance tax of about ${em.v('ledger.estate.iht', gbpFromK(E.iht))} and income tax on inherited pensions of ${em.v('ledger.estate.beneficiaryTax', gbpFromK(E.beneficiaryTax))} would leave about ${em.v('ledger.estate.netToHeirs', gbpFromK(E.netToHeirs))} to Emmie and Max, before the house.${cmp}</p><p class="note">${gift} Gifts are not modelled: any gift comes out of the buffer the tables above rely on, so it is a decision for the year, not a plan number.</p></div>`;
}

// ---------------------------------------------------------------------------
// scenarios block (summary + ledger)
// ---------------------------------------------------------------------------
function scenariosBlock(/** @type {ReturnType<typeof emitter>} */ em, /** @type {any} */ o, /** @type {any} */ a, full = false) {
  const S = o.scenarios;
  if (!S) return '';
  const ids = Object.keys(S.scenarios);
  const jPlan = S.scenarios[ids[0]].cases.findIndex((/** @type {any} */ x) => x.G === a.returns.realEquity.planning);
  const heirs = (/** @type {string} */ id) => (jPlan >= 0 ? `<td>${em.v(`scenarios.scenarios.${id}.cases.${jPlan}.netToHeirs`, gbpFromK(S.scenarios[id].cases[jPlan].netToHeirs))}</td>` : '<td>–</td>');
  const rows = ids.map((id) => { const s = S.scenarios[id]; const c = s.cases; return `<tr><td class="left wrap">${em.t(s.title)}<br><span class="note">${em.t(s.note)}</span></td>${c.map((/** @type {any} */ x, /** @type {number} */ j) => `<td>${em.v(`scenarios.scenarios.${id}.cases.${j}.atRetirement`, gbpFromK(x.atRetirement))}</td><td>${em.v(`scenarios.scenarios.${id}.cases.${j}.atEnd`, gbpFromK(x.atEnd))}</td><td>${x.firstCashNegative ? `<span class="red">${em.v(`scenarios.scenarios.${id}.cases.${j}.firstCashNegative`, yr(x.firstCashNegative))}</span>` : '<span class="ok">–</span>'}</td>`).join('')}${s.cases[0].preRetirementDraw ? `<td>${em.v(`scenarios.scenarios.${id}.cases.1.preRetirementDraw`, gbpFromK(s.cases[1].preRetirementDraw))}</td>` : '<td>–</td>'}${heirs(id)}</tr>`; }).join('');
  const head = S.scenarios[ids[0]].cases.map((/** @type {any} */ x, /** @type {number} */ j) => `<th colspan="3">${em.v(`scenarios.scenarios.${ids[0]}.cases.${j}.G`, pct(x.G, 0))} real</th>`).join('');
  const sub = S.scenarios[ids[0]].cases.map(() => `<th>At retirement</th><th>At end</th><th>Cash out</th>`).join('');
  // the grid and the replay only appear in the full (ledger) version — emit nothing for them otherwise
  const grid = full ? S.grid.map((/** @type {any} */ g, /** @type {number} */ i) => `<tr><td class="left">${em.v(`scenarios.grid.${i}.spend`, gbpShort(g.spend))} a year</td>${g.byReturn.map((/** @type {any} */ c, /** @type {number} */ j) => `<td>${em.v(`scenarios.grid.${i}.byReturn.${j}.atEnd`, gbpFromK(c.atEnd))}${c.firstCashNegative ? ` <span class="red">(${em.v(`scenarios.grid.${i}.byReturn.${j}.firstCashNegative`, yr(c.firstCashNegative))})</span>` : ''}</td>`).join('')}</tr>`).join('') : '';
  const gridHead = full ? S.returns.map((/** @type {number} */ r, /** @type {number} */ j) => `<th>${em.v(`scenarios.returns.${j}`, pct(r, 0))}</th>`).join('') : '';
  const R = full ? S.replay : null;
  const replay = R ? `<h3>Every start in the market record since ${em.v('scenarios.replay.firstStartYear', yr(R.firstStartYear))}</h3><p class="note">The planning case replayed with the equity sleeve following real US equity returns from each start month (${em.v('scenarios.replay.all.starts', int(R.all.starts))} starts of ${em.v('scenarios.replay.yearsPerPath', int(R.yearsPerPath))} years, ${em.v('scenarios.replay.firstStartYear', yr(R.firstStartYear))}–${em.v('scenarios.replay.lastStartYear', yr(R.lastStartYear))}); gilts stay at their locked real yields. Today's CAPE is ${em.v('scenarios.replay.currentCape', dec(R.currentCape, 0))}.</p><div class="scroll"><table><thead><tr><th class="left">Starts</th><th>Count</th><th>Cash ran out</th><th>Worst at end</th><th>5th pct</th><th>Median</th><th>95th pct</th></tr></thead><tbody><tr><td class="left">All</td><td>${em.v('scenarios.replay.all.starts', int(R.all.starts))}</td><td>${em.v('scenarios.replay.all.failRate', pct(R.all.failRate, 1))}</td><td>${em.v('scenarios.replay.all.worst', gbpFromK(R.all.worst))}</td><td>${em.v('scenarios.replay.all.p5', gbpFromK(R.all.p5))}</td><td>${em.v('scenarios.replay.all.p50', gbpFromK(R.all.p50))}</td><td>${em.v('scenarios.replay.all.p95', gbpFromK(R.all.p95))}</td></tr><tr><td class="left">CAPE at start ≥ ${em.v('scenarios.replay.highCape.threshold', int(R.highCape.threshold))} (expensive starts)</td><td>${em.v('scenarios.replay.highCape.starts', int(R.highCape.starts))}</td><td>${em.v('scenarios.replay.highCape.failRate', pct(R.highCape.failRate, 1))}</td><td>${em.v('scenarios.replay.highCape.worst', gbpFromK(R.highCape.worst))}</td><td>${em.v('scenarios.replay.highCape.p5', gbpFromK(R.highCape.p5))}</td><td>${em.v('scenarios.replay.highCape.p50', gbpFromK(R.highCape.p50))}</td><td>${em.v('scenarios.replay.highCape.p95', gbpFromK(R.highCape.p95))}</td></tr></tbody></table></div>` : '';
  return `<h2>Scenarios</h2><p class="note">Same engine, different knobs. "Cash out" is the first year the cash line goes negative; "reserve draw" is what the pre-retirement cash flow takes from the reserve by ${em.v('inputs.assumptions.dates.planRetirementYear', yr(a.dates.planRetirementYear))}.</p>
<div class="scroll"><table><thead><tr><th class="left">Scenario</th>${head}<th>Reserve draw</th><th>Left to the children</th></tr><tr><th></th>${sub}<th>to retirement</th><th>${jPlan >= 0 ? em.v(`scenarios.scenarios.${ids[0]}.cases.${jPlan}.G`, pct(S.scenarios[ids[0]].cases[jPlan].G, 0)) : ''} real</th></tr></thead><tbody>${rows}</tbody></table></div>
${full ? `<h3>Spend × return: what is left at ${em.v('inputs.assumptions.dates.simulationEndYear', yr(a.dates.simulationEndYear))}</h3><div class="scroll"><table><thead><tr><th class="left">Spend for life</th>${gridHead}</tr></thead><tbody>${grid}</tbody></table></div>${replay}` : ''}`;
}

// ---------------------------------------------------------------------------
// execution.html — the ladder purchase checklist, account by account
// ---------------------------------------------------------------------------
export function renderExecution(/** @type {any} */ o, /** @type {any} */ inputs, /** @type {any} */ meta) {
  const em = emitter('execution.html');
  const a = inputs.assumptions;
  const L = o.ladder;
  if (!L?.isa?.byHolder || !L?.sipp) return { html: page('Ladder execution', '<h1>Ladder execution</h1><p>No gilt prices in this run.</p>'), emissions: em.list };
  const H = L.isa.byHolder;
  const row0 = o.ledger?.rows?.[0];
  /** one purchase line: tick box, gilt, nominal to order, cost, real redemption, years covered, notes */
  const line = (/** @type {any} */ g, /** @type {string} */ k) => `<tr><td class="left tick">☐</td><td class="left wrap">${em.t(g.giltName)}<br><span class="note">${em.t(g.epic)} · matures ${em.t(g.maturity)} · real yield ${em.v(`${k}.realYield`, dec(g.realYield, 2))}%</span></td><td><b>${em.v(`${k}.face`, int(g.face))}</b></td><td>${em.v(`${k}.estCost`, gbp(g.estCost))}</td><td>${em.v(`${k}.realAmount`, gbp(g.realAmount))}</td><td class="left">${g.coversYears.map((/** @type {number} */ y, /** @type {number} */ j) => em.v(`${k}.coversYears.${j}`, yr(y))).join(', ')}</td><td class="left wrap note">${g.split ? 'part of this gilt — the rest is in the other ISA' : ''}${g.notes.map((/** @type {string} */ n) => em.t(n)).join('; ')}</td></tr>`;
  const head = `<thead><tr><th class="left">Done</th><th class="left">Gilt</th><th>Nominal to order (£)</th><th>Cost at these prices</th><th>Real redemption</th><th class="left">Covers</th><th class="left">Notes</th></tr></thead>`;
  const holderRows = (/** @type {string} */ h) => H.rows.map((/** @type {any} */ g, /** @type {number} */ i) => (g.holder === h ? line(g, `ladder.isa.byHolder.rows.${i}`) : '')).join('');
  const holderTotal = (/** @type {string} */ h) => `<tr class="tot"><td></td><td class="left">Total</td><td>${em.v(`ladder.isa.byHolder.totals.${h}.face`, int(H.totals[h].face))}</td><td>${em.v(`ladder.isa.byHolder.totals.${h}.estCost`, gbp(H.totals[h].estCost))}</td><td>${em.v(`ladder.isa.byHolder.totals.${h}.realAmount`, gbp(H.totals[h].realAmount))}</td><td></td><td></td></tr>`;
  const sippRows = L.sipp.byGilt.map((/** @type {any} */ g, /** @type {number} */ i) => line({ ...g, split: false }, `ladder.sipp.byGilt.${i}`)).join('');
  const body = `<p class="eyebrow">Household plan · ladder execution</p><h1>Buying the gilt ladder, account by account</h1>
<p class="lede">Every number here comes from the accepted plan at the gilt prices of ${em.t(String(L.pricesAsOf ?? '').slice(0, 10))}. Prices move daily, so on each dealing day regenerate this page (<code>npm run plan:render</code>) or the order sheets (<code>npm run plan:order-sheet</code>) and order the nominal amounts it shows then. You order index-linked gilts by <b>nominal</b> (face) amount; the cost column is what that nominal costs at today's dirty price.</p>
<div class="meta"><span>Generated ${em.t(meta.generatedAt ?? '')}</span>${meta.runId ? `<span>Run ${em.t(meta.runId)}</span>` : ''}<span>Engine ${em.t(o.engineVersion)}</span></div>
<div class="tiles">
<div class="tile"><div class="n">${em.v('inputs.assumptions.ladder.budgetReal', gbpShort(a.ladder.budgetReal))}</div><div class="l">total ladder budget</div></div>
<div class="tile"><div class="n">${em.v('inputs.assumptions.ladder.isaBudgetReal', gbpShort(a.ladder.isaBudgetReal))}</div><div class="l">ISA rungs ${em.v('inputs.assumptions.ladder.firstYear', yr(a.ladder.firstYear))}–${em.v('inputs.assumptions.dates.chrisPensionAccessYear', yr(a.dates.chrisPensionAccessYear))}, ${em.v('ladder.isa.amountPerYear', gbpShort(L.isa.amountPerYear))} real a year</div></div>
<div class="tile"><div class="n">${em.v('inputs.assumptions.ladder.sippBudgetReal', gbpShort(a.ladder.sippBudgetReal))}</div><div class="l">SIPP rungs to ${em.v('inputs.assumptions.ladder.lastYear', yr(a.ladder.lastYear))}, ${em.v('ladder.sipp.amountPerYear', gbpShort(L.sipp.amountPerYear))} real a year</div></div>
</div>
<div class="box"><b>Ground rules.</b><ul class="note"><li>Shortest rungs first: they are the years hardest to replace if real yields fall.</li><li>Phase the switch out of equity over a few months to average the entry, but do not stretch it beyond that.</li><li>ii deals index-linked gilts by phone through its fixed-income desk (number on the ii site); sell the funds first so the cash is in the account, and confirm the dealing charge when you book.</li><li>Vanguard cannot hold individual gilts, which is why the ISA rungs live at ii.</li><li>Coupons arrive as cash in the account; leave them invested in equity inside the same wrapper. They are the top-up, not part of the rung.</li><li>Tick each line here and mark the rung bought in the /plan cockpit so the next run tracks actual cost instead of the price feed.</li></ul></div>

<h2>Step 1 — open Abby's ii ISA and start the transfer</h2>
<p>Open a Stocks and Shares ISA at ii in Abby's name. Ask Vanguard for a <b>partial ISA transfer</b> of ${em.v('inputs.assumptions.ladder.abbyIiIsaTransfer', gbp(a.ladder.abbyIiIsaTransfer))} to it, in cash, from prior-year subscriptions (an ISA transfer keeps the tax wrapper and does not use this year's allowance; do not withdraw and re-subscribe). Her Vanguard ISA is ${em.v('inputs.assumptions.pots.abbyVanguardIsa', gbp(a.pots.abbyVanguardIsa))} today, so about ${row0 ? em.v('ledger.rows.0.abbyIsaEq', gbpFromK(row0.abbyIsaEq)) : '–'} stays there as equity. Transfers take a few weeks, so this goes first; steps 2 and 3 do not wait for it.</p>
<p class="note">☐ Account opened &nbsp; ☐ Transfer requested &nbsp; ☐ Cash landed at ii</p>

<h2>Step 2 — Chris's ii ISA: sell the funds, buy the near rungs</h2>
<p>Pot ${em.v('inputs.assumptions.pots.chrisIiIsa', gbp(a.pots.chrisIiIsa))}. Sell the LifeStrategy holdings to cash, then buy in this order:</p>
<div class="scroll"><table>${head}<tbody>${holderRows(H.holders[0])}${holderTotal(H.holders[0])}</tbody></table></div>

<h2>Step 3 — Chris's ii SIPP: sell, buy the far rungs, keep a slice in equity</h2>
<p>Pot ${em.v('inputs.assumptions.pots.chrisIiSipp', gbp(a.pots.chrisIiSipp))}. Sell enough to fund the rungs; about ${em.v('inputs.assumptions.ladder.sippEquityRetained', gbp(a.ladder.sippEquityRetained))} stays in equity. These rungs mature inside the SIPP, which opens at 57.</p>
<div class="scroll"><table>${head}<tbody>${sippRows}<tr class="tot"><td></td><td class="left">Total</td><td>${em.v('ladder.sipp.totals.face', int(L.sipp.totals.face))}</td><td>${em.v('ladder.sipp.totals.estCost', gbp(L.sipp.totals.estCost))}</td><td>${em.v('ladder.sipp.totals.realAmount', gbp(L.sipp.totals.realAmount))}</td><td></td><td></td></tr></tbody></table></div>

<h2>Step 4 — Abby's ii ISA: when the transfer lands, buy the middle rungs</h2>
<div class="scroll"><table>${head}<tbody>${holderRows(H.holders[1])}${holderTotal(H.holders[1])}</tbody></table></div>

<h2>Step 5 — record it</h2>
<p>After each purchase: mark the rung bought in the /plan cockpit (actual nominal and cost), then <code>npm run plan:trigger -- rung-bought</code> lists the assumptions to review. The next quarterly run reconciles bought rungs against the budget.</p>

<h2>Leave alone</h2>
<ul class="note">
<li><b>Chris's Accenture pension at L&amp;G</b> (${em.v('inputs.assumptions.pots.chrisAccenturePension', gbp(a.pots.chrisAccenturePension))}): stays where it is in the global equity tracker. Not part of the ladder; the transfer idea was retired.</li>
<li><b>Abby's Accenture pension at L&amp;G</b> (${em.v('inputs.assumptions.pots.abbyAccentureDc', gbp(a.pots.abbyAccentureDc))}): untouched, receiving the AVC, all equity.</li>
<li><b>The rest of Abby's Vanguard ISA</b>: stays as the growth sleeve; consolidating it into a single global tracker is housekeeping, not urgent.</li>
<li><b>Beneficiary nominations</b> on all four pension and ISA pots want refreshing while you are in the accounts.</li>
</ul>
<p class="note">None of this is regulated advice. A one-off, fee-only IFA check of the execution is cheap insurance.</p>
${limitationsBlock(em, o.knownLimitations)}`;
  return { html: page('Ladder execution', body), emissions: em.list };
}

/** All documents for a run. */
export function renderAll(/** @type {any} */ outputs, /** @type {any} */ inputs, /** @type {any} */ meta = {}) {
  const m = { generatedAt: inputs.today ?? '', ...meta };
  const s = renderSummary(outputs, inputs, m), l = renderLedger(outputs, inputs, m), x = renderExecution(outputs, inputs, m), am = renderAssumptionsMd(outputs, inputs, m), av = renderAvcMd(outputs, inputs, m), lc = renderLedgerCsv(outputs), oi = renderOrderSheetCsv(outputs, 'isa'), os = renderOrderSheetCsv(outputs, 'sipp');
  const emissions = [...s.emissions, ...l.emissions, ...x.emissions, ...am.emissions, ...av.emissions, ...lc.emissions, ...oi.emissions, ...os.emissions];
  return {
    'summary.html': s.html, 'ledger.html': l.html, 'execution.html': x.html, 'assumptions.md': am.text, 'avc-recipe.md': av.text, 'ledger.csv': lc.text,
    'order-sheet-isa.csv': oi.text, 'order-sheet-sipp.csv': os.text,
    'emissions.json': JSON.stringify(emissions),
  };
}
