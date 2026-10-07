/**
 * Rounding for reading: large sums and rates as a person would say them.
 * Precise values stay in tooltips and tables.
 */
import { formatGBP } from '@/lib/format';

/** "£1.54m", "£540k", "£8,200". */
export function readableGBP(amount: number): string {
  if (!Number.isFinite(amount)) return '–';
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);
  if (a >= 1_000_000) {
    const m = a / 1_000_000;
    return `${sign}£${m >= 10 ? m.toFixed(1) : m.toFixed(2)}m`;
  }
  if (a >= 10_000) return `${sign}£${Math.round(a / 1000)}k`;
  return formatGBP(amount);
}

/** "3.2%" below 10, "94%" from 10 up. Input is already a percentage. */
export function readablePct(value: number): string {
  if (!Number.isFinite(value)) return '–';
  const a = Math.abs(value);
  return a < 10 ? `${value.toFixed(1)}%` : `${Math.round(value)}%`;
}

/** Share of historical cohorts whose safe withdrawal rate was at or above `wr` (both in %). */
export function historicalSurvival(cohorts: { swr: number }[] | undefined, wr: number): number | null {
  if (!cohorts || cohorts.length === 0 || !Number.isFinite(wr)) return null;
  const survived = cohorts.filter((c) => c.swr >= wr).length;
  return (survived / cohorts.length) * 100;
}

export interface ErnLedeInput {
  annualSpend: number;
  portfolio: number;
  personalWr: number;
  ernDynamicWr: number;
  horizonYears: number;
  historicalSurvivalPct: number | null;
  mcSurvivalRate: number | null;
  mcPaths: number;
  retirementAge?: number;
  currentAge: number;
  projectedPortfolio?: number;
}

/** Plain-English parts of the ERN tab's opening sentence. */
export function ernLedeParts(i: ErnLedeInput) {
  const retiresLater = i.retirementAge !== undefined && i.retirementAge > i.currentAge && i.projectedPortfolio !== undefined;
  const pot = retiresLater ? i.projectedPortfolio! : i.portfolio;
  const verdict =
    i.personalWr <= i.ernDynamicWr ? 'at or below' : i.personalWr - i.ernDynamicWr < 0.5 ? 'a little above' : 'well above';
  return {
    retiresLater,
    spend: readableGBP(i.annualSpend),
    pot: readableGBP(pot),
    wr: readablePct(i.personalWr),
    ernWr: readablePct(i.ernDynamicWr),
    verdict,
    years: Math.round(i.horizonYears),
    historical: i.historicalSurvivalPct === null ? null : readablePct(i.historicalSurvivalPct),
    mc: i.mcSurvivalRate === null ? null : readablePct(i.mcSurvivalRate),
  };
}
