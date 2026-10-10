/**
 * Cockpit binding for the pivot model. The arithmetic lives in
 * plan/engine/pivot.mjs (pure, injected); this module binds it to the
 * repo's assumptions so components and tests keep their existing signatures.
 */
import { ASSUMPTIONS } from './assumptions';
import * as engine from '../../plan/engine/pivot.mjs';
import { childBenefitKept as engineCbKept, netPay as engineNetPay } from '../../plan/engine/tax.mjs';

export interface PivotYear {
  taxYear: string; // "2026/27"
  yearIndex: number;
  basic: number;
  packageTotal: number; // basic + bonus + car allowance + BIK
  aniBefore: number; // package minus existing 4.5% sacrifice
  extraSacrifice: number;
  aniAfter: number;
  avcPct: number; // ceil(extraSacrifice / basic × 100)
  takeHomeCut: number;
  cbFull: number;
  cbKept: number;
  netCost: number; // takeHomeCut − cbKept
}

export interface PivotResult {
  years: PivotYear[];
  totals: { extraSacrifice: number; takeHomeCut: number; cbKept: number };
}

export const childBenefitKept = (ani: number, fullAmount: number): number => engineCbKept(ASSUMPTIONS, ani, fullAmount);
export const netPay = (cashPay: number, taxablePay: number): number => engineNetPay(ASSUMPTIONS, cashPay, taxablePay);
export const takeHomeNominal = (yearIndex: number, extraSacrifice: number): number => engine.takeHomeNominal(ASSUMPTIONS, yearIndex, extraSacrifice);
export const pivotYear = (yearIndex: number, targetAni: number): PivotYear => engine.pivotYear(ASSUMPTIONS, yearIndex, targetAni);
export const pivotProgramme = (targetAni: number): PivotResult => engine.pivotProgramme(ASSUMPTIONS, targetAni);
export const currentRetune = (targetAni: number, today: Date = new Date()): PivotYear | null => engine.currentRetune(ASSUMPTIONS, targetAni, today);
export type AvcRecipe = ReturnType<typeof engine.avcRecipeFromYtd>;
export const avcRecipeFromYtd = (slip: Parameters<typeof engine.avcRecipeFromYtd>[1]): AvcRecipe => engine.avcRecipeFromYtd(ASSUMPTIONS, slip);
