import type { MonthlyReturn } from './types';
import shillerData from './data/shiller-monthly.json';

const D: MonthlyReturn[] = shillerData as MonthlyReturn[];

/** Index where CAPE data begins (first non-zero CAPE value) */
export const CAPE_START_INDEX = 119;

/** Total number of monthly data points (1871-01 to 2026-01) */
export function getDataLength(): number {
  return D.length;
}

/** Get raw monthly return tuple at index i: [stockBps, bondBps, cape10x] */
export function getMonthlyReturn(i: number): MonthlyReturn {
  if (i < 0 || i >= D.length) {
    throw new RangeError(`Index ${i} out of range [0, ${D.length - 1}]`);
  }
  return D[i];
}

/** Get CAPE ratio at index i (stored as value * 10, so divide by 10) */
export function getCape(i: number): number {
  return D[i][2] / 10;
}

/** Get real stock return as a decimal (basis points / 10000) */
export function getStockReturn(i: number): number {
  return D[i][0] / 10000;
}

/** Get real bond return as a decimal (basis points / 10000) */
export function getBondReturn(i: number): number {
  return D[i][1] / 10000;
}

/** Get weighted portfolio return for a given equity allocation (0-1) */
export function getWeightedReturn(i: number, equityPct: number): number {
  return equityPct * D[i][0] / 10000 + (1 - equityPct) * D[i][1] / 10000;
}

/** Access the raw data array (for Monte Carlo block sampling) */
export function getRawData(): MonthlyReturn[] {
  return D;
}
