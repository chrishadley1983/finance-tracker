/**
 * Phase 7: scenario knobs, the NIC-cap branch, the historical replay, and a
 * regression that the refactored ledger still reproduces the accepted run.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assumptionsFile from '../../../plan/assumptions.json';
import yields20 from '../../../plan/observations/gilt-yields/2026-09-20.json';
import yields21 from '../../../plan/observations/gilt-yields/2026-09-21.json';
import shiller from '../../../plan/observations/market/shiller-monthly.json';
import { buildAssumptions } from '../../../plan/inputs/assumptions.mjs';
import { runLedger } from '../../../plan/engine/ledger.mjs';
import { runScenarios } from '../../../plan/engine/scenarios.mjs';
import { nicLiableSacrifice, reliefOnSacrifice } from '../../../plan/engine/tax.mjs';
import { pivotYear, takeHomeNominal } from '../../../plan/engine/pivot.mjs';
import { writeWorkbook } from '../../../plan/render/xlsx.mjs';
import XLSX from 'xlsx';

const root = path.resolve(__dirname, '../../..');
const a = buildAssumptions(assumptionsFile as never).values;
const y21 = yields21 as never;

describe('ledger scenario knobs (phase 7)', () => {
  // 23 Sep 2026: the engine now works in today's money throughout (AVC deflated, thresholds and the lump sum
  // allowance frozen in cash, tax-free cash capped at 25% of what is crystallised). With inflation set to zero those
  // corrections vanish, so every row up to Chris's pension opening (no pension draws yet) must still equal run 2026-09-21.
  it('regression: with cpi = 0 the ledger reproduces accepted run 2026-09-21 up to the first pension draw', () => {
    const acc = JSON.parse(fs.readFileSync(path.join(root, 'plan/runs/2026-09-21/outputs.json'), 'utf8'));
    const accInputs = JSON.parse(fs.readFileSync(path.join(root, 'plan/runs/2026-09-21/inputs.json'), 'utf8'));
    const old = accInputs.assumptions;
    expect(() => runLedger(old, yields20 as never)).toThrow(/returns\.cpi/); // old inputs are refused, not silently re-read
    const zero = { ...old, returns: { ...old.returns, cpi: 0 }, tax: { ...old.tax, thresholdsFrozenThroughTaxYear: a.tax.thresholdsFrozenThroughTaxYear }, drawdown: { ...old.drawdown, strategy: 'paFill' }, iht: a.iht };
    const l = runLedger(zero, yields20 as never);
    expect(l.headline.atRetirement).toBe(acc.ledger.headline.atRetirement);
    const upTo = (rows: Array<{ year: number; total: number }>) => rows.filter((r) => r.year <= a.dates.chrisPensionAccessYear).map((r) => r.total);
    expect(upTo(l.rows)).toEqual(upTo(acc.ledger.rows));
  });

  it('the three corrections only ever lower the planning case, and the band strategy leaves more to the children', () => {
    const band = runLedger(a, y21), pa = runLedger(a, y21, { drawdown: 'paFill' });
    const noCpi = runLedger({ ...a, returns: { ...a.returns, cpi: 0 } }, y21, { drawdown: 'paFill' });
    expect(pa.headline.atRetirement!).toBeLessThan(noCpi.headline.atRetirement!); // AVC in today's money
    expect(pa.headline.atEnd!).toBeLessThan(noCpi.headline.atEnd!);
    expect(pa.lifeTax).toBeGreaterThan(noCpi.lifeTax);
    expect(band.estate.netToHeirs).toBeGreaterThan(pa.estate.netToHeirs);
    expect(band.estate.pensions).toBeLessThan(pa.estate.pensions);
    expect(band.headline.firstCashNegative).toBeNull();
  });

  it('tax-free cash stays within the cash-frozen lump sum allowance in every case', () => {
    for (const dd of ['basicBand', 'paFill'] as const) for (const G of [0, 0.02, 0.04]) {
      const l = runLedger(a, y21, { G, drawdown: dd });
      const tfc = l.rows.reduce((s: number, r: { tfc: number }) => s + r.tfc, 0);
      const lastOpen = l.rows.filter((r: { year: number }) => r.year >= a.dates.abbyPensionAccessYear);
      expect(tfc).toBeLessThan((2 * a.drawdown.tfcCapEach) / 1000); // nominal cap; its real value is lower still
      for (const r of lastOpen) { expect(r.lsaC).toBeGreaterThanOrEqual(-1e-6); expect(r.lsaA).toBeGreaterThanOrEqual(-1e-6); }
    }
  });

  it('step-down spend sits between the flat plan-line and the flat retirement-target cases', () => {
    const lo = runLedger(a, y21, { spend: a.spend.retirementTarget }).headline.atEnd!;
    const hi = runLedger(a, y21, { spend: a.spend.planLine + 10_000 }).headline.atEnd!;
    const step = runLedger(a, y21, { spendSchedule: [{ fromYear: a.dates.planRetirementYear, spend: a.spend.planLine + 10_000 }, { fromYear: 2040, spend: a.spend.retirementTarget + 5_000 }] }).headline.atEnd!;
    expect(step).toBeLessThan(lo);
    expect(step).toBeGreaterThan(hi);
  });

  it('pre-retirement cash flow: Chris at £20k with the plan line draws on the reserve; at £25k it roughly breaks even', () => {
    const at20 = runLedger(a, y21, { preRetirement: { spend: a.spend.planLine, hbTakeHome: 20_000, cottrell: 3_000 } });
    const at25 = runLedger(a, y21, { preRetirement: { spend: a.spend.planLine, hbTakeHome: 25_000, cottrell: 3_000 } });
    expect(at20.headline.preRetirementDraw).toBeGreaterThan(at25.headline.preRetirementDraw);
    expect(at20.headline.atRetirement!).toBeLessThan(at25.headline.atRetirement!);
    const base = runLedger(a, y21);
    expect(Math.abs(at25.headline.atRetirement! - base.headline.atRetirement!)).toBeLessThan(60); // £k: the plan's breakeven assumption within a few £k a year
  });

  it('extension: buying 2046–50 rungs from the Accenture pot lowers equity but adds a floor to 2050', () => {
    const ext = runLedger(a, y21, { extension: { budget: a.pots.chrisAccenturePension, fromYear: 2046, toYear: 2050, source: 'acn' } });
    expect(ext.extension?.R).toBeGreaterThan(40);
    expect(ext.rows.find((r: { year: number }) => r.year === 2026)!.extLad).toBeCloseTo(a.pots.chrisAccenturePension / 1000, 0);
    expect(ext.rows.find((r: { year: number }) => r.year === 2026)!.acn).toBeCloseTo(0, 6);
    expect(ext.rows.find((r: { year: number }) => r.year === 2051)!.extLad).toBe(0);
    const zero = runLedger(a, y21, { G: 0, extension: { budget: a.pots.chrisAccenturePension, fromYear: 2046, toYear: 2050, source: 'acn' } });
    expect(zero.headline.atEnd!).toBeGreaterThan(runLedger(a, y21, { G: 0 }).headline.atEnd!); // at 0% equity the locked 2.4% real beats the sleeve
  });

  it('gPath drives year-by-year returns and a flat gPath equals the flat G', () => {
    const years = a.dates.simulationEndYear - 2026;
    const flat = runLedger(a, y21, { gPath: Array(years).fill(a.returns.realEquity.planning) });
    expect(flat.headline.atEnd).toBe(runLedger(a, y21).headline.atEnd);
  });
});

describe('salary-sacrifice NIC cap from 2029/30', () => {
  it('nothing is NI-able before the cap year; the whole extra is NI-able after (existing sacrifice uses the threshold)', () => {
    expect(nicLiableSacrifice(a, 2028, 25_000, 3_500)).toBe(0);
    expect(nicLiableSacrifice(a, 2029, 25_000, 3_500)).toBe(25_000);
    expect(nicLiableSacrifice(a, 2029, 25_000, 1_000)).toBe(24_000);
  });
  it('relief drops from 42% to 40% on the NI-able part above the UEL', () => {
    const pre = reliefOnSacrifice(a, 90_000, 20_000, { taxYearStart: 2028, existingSacrifice: 3_500 });
    const post = reliefOnSacrifice(a, 90_000, 20_000, { taxYearStart: 2029, existingSacrifice: 3_500 });
    expect(pre / 20_000).toBeCloseTo(0.42, 6);
    expect(post / 20_000).toBeCloseTo(0.40, 6);
  });
  it('the pivot years from 2029/30 carry the higher take-home cut and lower take-home', () => {
    const y2 = pivotYear(a, 2, 60_000), y3 = pivotYear(a, 3, 60_000); // 2028/29 vs 2029/30
    expect(1 - y2.takeHomeCut / y2.extraSacrifice).toBeCloseTo(0.42, 6);
    expect(1 - y3.takeHomeCut / y3.extraSacrifice).toBeCloseTo(0.40, 6);
    const th3 = takeHomeNominal(a, 3, y3.extraSacrifice);
    const th3NoCap = takeHomeNominal({ ...a, tax: { ...a.tax, salarySacrificeNicCapFromTaxYear: 2099 } }, 3, y3.extraSacrifice);
    expect(th3NoCap - th3).toBeCloseTo(y3.extraSacrifice * a.tax.niUpperRate, 0);
  });
});

describe('scenarios and replay', () => {
  const sc = runScenarios(a, y21, { shiller: shiller as number[][] });
  it('produces the named scenarios, the grid and the replay', () => {
    expect(Object.keys(sc.scenarios)).toEqual(expect.arrayContaining(['baseline', 'spendPlanLine', 'spendPlanLinePlus10', 'stepDown', 'reserveSpent', 'chris20kPlanLine', 'chris20kPlus10', 'ratchetTo2050']));
    expect(sc.grid).toHaveLength(3);
    expect(sc.grid[0].byReturn).toHaveLength(5);
    expect(sc.scenarios.baseline.cases[1].atEnd).toBe(runLedger(a, y21).headline.atEnd);
    expect(sc.replay?.all.starts).toBeGreaterThan(1000);
    expect(sc.replay?.highCape.starts).toBeGreaterThan(0);
    expect(sc.replay?.all.p50).toBeGreaterThan(sc.replay!.all.p5);
    expect(sc.replay?.all.failRate).toBeGreaterThanOrEqual(0);
    expect(sc.replay?.currentCape).toBeGreaterThan(20);
  });
  it('spreadsheet export has the expected sheets', () => {
    const outputs = { engineVersion: 'test', ledger: runLedger(a, y21), pivot: { programme: { years: [pivotYear(a, 0, 60_000)] }, avcRecipe: null }, ladder: null, scenarios: sc, outlook: { sustainableSpend: 0 }, knownLimitations: [] };
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'plan-xlsx-')), 'plan.xlsx');
    writeWorkbook(outputs, { assumptions: a, today: '2026-09-21' }, file, { assumptionsFile });
    const wb = XLSX.readFile(file);
    expect(wb.SheetNames).toEqual(expect.arrayContaining(['Summary', 'Ledger', 'Pivot', 'Scenarios', 'Grid', 'Replay', 'Assumptions', 'Limitations']));
  });
});
