// @ts-check
/**
 * Spreadsheet export of a run: outputs → plan.xlsx (phase 7). Rows are dumped
 * as they are in outputs; no arithmetic. Node-only (uses the xlsx package), so
 * it lives beside render.mjs rather than inside it.
 */
import XLSX from 'xlsx';

/** @param {any} outputs @param {any} inputs @param {{ assumptionsFile?: any }} [meta] */
export function buildWorkbook(outputs, inputs, meta = {}) {
  const wb = XLSX.utils.book_new();
  const add = (/** @type {string} */ name, /** @type {any[]} */ rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
  const a = inputs.assumptions;
  const L = outputs.ledger;
  add('Summary', [
    { item: 'engine', value: outputs.engineVersion }, { item: 'assumptions prepared', value: a.__preparedOn ?? '' }, { item: 'today', value: inputs.today ?? '' },
    { item: 'pots total (£)', value: a.pots.total }, { item: 'ladder budget (£)', value: a.ladder.budgetReal },
    { item: 'ISA rung redemption (£k real)', value: L?.wrappers.isa.R }, { item: 'SIPP rung redemption (£k real)', value: L?.wrappers.sipp.R },
    { item: 'at retirement (£k real, planning case)', value: L?.headline.atRetirement }, { item: 'at last rung (£k)', value: L?.headline.atLastRung }, { item: 'at end (£k)', value: L?.headline.atEnd },
    { item: 'lifetime tax (£k)', value: L?.lifeTax }, { item: 'drawdown strategy', value: L?.drawdown }, { item: 'estate at end (£k)', value: L?.estate?.total }, { item: 'inheritance tax, est. (£k)', value: L?.estate?.iht }, { item: 'left to the children (£k)', value: L?.estate?.netToHeirs }, { item: 'giftable income a year (£k)', value: L?.estate?.giftableAvg }, { item: 'AVC % to set', value: outputs.pivot.avcRecipe?.avcPct ?? '' }, { item: 'sustainable spend (£, outlook)', value: outputs.outlook.sustainableSpend },
  ]);
  if (L) add('Ledger', L.rows);
  add('Pivot', outputs.pivot.programme.years);
  if (outputs.ladder?.isa) add('Ladder ISA', outputs.ladder.isa.byGilt.map((/** @type {any} */ g) => ({ ...g, coversYears: g.coversYears.join(' '), notes: g.notes.join('; ') })));
  if (outputs.ladder?.sipp) add('Ladder SIPP', outputs.ladder.sipp.byGilt.map((/** @type {any} */ g) => ({ ...g, coversYears: g.coversYears.join(' '), notes: g.notes.join('; ') })));
  if (outputs.scenarios) {
    const rows = [];
    for (const s of Object.values(outputs.scenarios.scenarios)) for (const c of /** @type {any} */ (s).cases) rows.push({ scenario: /** @type {any} */ (s).id, title: /** @type {any} */ (s).title, G: c.G, atRetirement: c.atRetirement, atLastRung: c.atLastRung, atEnd: c.atEnd, lifeTax: c.lifeTax, iht: c.iht, netToHeirs: c.netToHeirs, firstCashNegative: c.firstCashNegative ?? '', preRetirementDraw: c.preRetirementDraw ?? 0 });
    add('Scenarios', rows);
    const grid = [];
    for (const g of outputs.scenarios.grid) for (const c of g.byReturn) grid.push({ spend: g.spend, G: c.G, atRetirement: c.atRetirement, atLastRung: c.atLastRung, atEnd: c.atEnd, lifeTax: c.lifeTax, firstCashNegative: c.firstCashNegative ?? '' });
    add('Grid', grid);
    if (outputs.scenarios.replay) add('Replay', [{ set: 'all starts', ...outputs.scenarios.replay.all }, { set: `CAPE ≥ ${outputs.scenarios.replay.highCape.threshold}`, ...outputs.scenarios.replay.highCape, threshold: undefined }]);
  }
  if (meta.assumptionsFile) add('Assumptions', Object.entries(meta.assumptionsFile.entries).map(([key, e]) => ({ key, value: (() => { const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), a); return typeof v === 'object' ? JSON.stringify(v) : v; })(), status: /** @type {any} */ (e).status, source: /** @type {any} */ (e).source ?? /** @type {any} */ (e).formula ?? '', asOf: /** @type {any} */ (e).asOf ?? '', reviewBy: /** @type {any} */ (e).reviewBy ?? '' })));
  add('Limitations', outputs.knownLimitations ?? []);
  return wb;
}

/** @param {any} outputs @param {any} inputs @param {string} file @param {{ assumptionsFile?: any }} [meta] */
export function writeWorkbook(outputs, inputs, file, meta = {}) {
  XLSX.writeFile(buildWorkbook(outputs, inputs, meta), file);
  return file;
}
