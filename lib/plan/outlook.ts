/**
 * Cockpit binding for the outlook models (pots at exit, sustainable spend,
 * drawdown simulation). The arithmetic lives in plan/engine/outlook.mjs.
 */
import { ASSUMPTIONS } from './assumptions';
import * as engine from '../../plan/engine/outlook.mjs';

export interface PotsAtExit {
  chrisPension: number;
  abbyPension: number;
  nonPension: number;
  total: number;
}

export interface OutlookOptions {
  retireYear: number; // June of this year, 2031–2035
  realReturn: number; // 0.02 or 0.04
  retirementSpend: number; // £/yr real
  aniTarget: number; // pivot target while working
  hbPostRetirement: number; // £/yr to Nov 2040 — only paid when retiring on plan
  /** Pin the at-exit pots (e.g. to reproduce a published sim). */
  potsOverride?: PotsAtExit;
}

export interface DrawdownResult {
  surplusAt92: number;
  chrisPensionAt92: number;
  abbyPensionAt92: number;
  nonPensionAt92: number;
  firstTaxedYear: number | null;
  totalTax: number;
  pensionWithdrawn: number;
  effectiveTaxRate: number;
  depletedYear: number | null;
  fundingByYear: Array<{
    year: number;
    hb: number;
    statePension: number;
    chrisPensionDraw: number;
    abbyPensionDraw: number;
    ladderDraw: number;
    isaDraw: number;
    nonPensionDraw: number;
    tax: number;
  }>;
}

export const DEFAULT_OUTLOOK: OutlookOptions = engine.defaultOutlook(ASSUMPTIONS);
export const potsAtExit = (opts: OutlookOptions): PotsAtExit => engine.potsAtExit(ASSUMPTIONS, opts);
export const sustainableSpend = (opts: OutlookOptions): number => engine.sustainableSpend(ASSUMPTIONS, opts);
export const drawdownSim = (opts: OutlookOptions): DrawdownResult => engine.drawdownSim(ASSUMPTIONS, opts) as DrawdownResult;
