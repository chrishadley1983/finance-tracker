'use client';

import { SkeletonRows } from '@/components/ui/Notice';
import { Chip } from '@/components/ui/Chip';
import { readablePct } from '../readable';

interface ErnSummaryCardsProps {
  failSafeSwr: number;
  medianSwr: number;
  ernDynamicWr: number;
  personalWr: number;
  currentCape: number;
  mcSurvivalRate: number | null;
  totalCohorts: number;
  mcPaths?: number;
  isLoading?: boolean;
}

interface RateRow {
  label: string;
  value: string;
  precise: string;
  note: string;
  detail: string;
  chip?: { tone: 'in' | 'warn' | 'bad' | 'neutral'; text: string };
}

/**
 * The four rates that matter, as a list (label and plain note on the left,
 * the figure on the right). Figures are rounded; hover shows the precise value.
 */
export function ErnSummaryCards({
  failSafeSwr,
  medianSwr,
  ernDynamicWr,
  personalWr,
  currentCape,
  mcSurvivalRate,
  totalCohorts,
  mcPaths = 500,
  isLoading = false,
}: ErnSummaryCardsProps) {
  if (isLoading) {
    return (
      <section aria-label="Key rates" className="border-t-[1.5px] border-ink pt-3">
        <SkeletonRows rows={4} />
      </section>
    );
  }

  const wrDelta = personalWr - ernDynamicWr;
  const rows: RateRow[] = [
    {
      label: 'Your withdrawal rate',
      value: readablePct(personalWr),
      precise: `${personalWr.toFixed(2)}%`,
      note: 'Your yearly spending as a share of the pot at retirement.',
      detail:
        "This is what you're planning to withdraw. If it's above the market-adjusted rate, you're taking more risk than today's valuations suggest is safe.",
      chip:
        wrDelta <= 0
          ? { tone: 'in', text: 'at or below the adjusted rate' }
          : wrDelta < 0.5
            ? { tone: 'warn', text: 'a little above the adjusted rate' }
            : { tone: 'bad', text: 'well above the adjusted rate' },
    },
    {
      label: 'Market-adjusted rate',
      value: readablePct(ernDynamicWr),
      precise: `${ernDynamicWr.toFixed(2)}%`,
      note: `ERN's rule of thumb for today's valuations (CAPE ${Math.round(currentCape)}): 1.75% + half of 1/CAPE.`,
      detail:
        'When shares are expensive (high CAPE), future returns tend to be lower, so this rate drops. Based on ERN Safe Withdrawal Rate Series Parts 18 and 54.',
    },
    {
      label: 'Worst-case historical rate',
      value: readablePct(failSafeSwr),
      precise: `${failSafeSwr.toFixed(2)}%`,
      note: `The most you could have withdrawn in the worst of ${totalCohorts.toLocaleString('en-GB')} start months on record. Typical: ${readablePct(medianSwr)}.`,
      detail: 'Retiring in the single worst month in history, this is the most you could have taken each year without running out. An ultra-cautious floor.',
    },
    {
      label: 'Simulated futures that last',
      value: mcSurvivalRate !== null ? readablePct(mcSurvivalRate) : '–',
      precise: mcSurvivalRate !== null ? `${mcSurvivalRate.toFixed(1)}%` : 'Not run',
      note:
        mcSurvivalRate !== null
          ? `Of ${mcPaths.toLocaleString('en-GB')} futures built from real historical returns, the share where the money lasts. 95% or more is robust.`
          : "The Monte Carlo simulation didn't return a result.",
      detail: 'Uses 60-month blocks of real returns so good and bad periods cluster as they do in real markets. Includes state pension and spending rules.',
      chip:
        mcSurvivalRate === null
          ? undefined
          : mcSurvivalRate >= 95
            ? { tone: 'in', text: 'robust' }
            : mcSurvivalRate >= 85
              ? { tone: 'warn', text: 'some risk' }
              : { tone: 'bad', text: 'fragile' },
    },
  ];

  return (
    <section aria-labelledby="ern-rates-title" className="border-t-[1.5px] border-ink">
      <h2 id="ern-rates-title" className="py-2.5 text-[13.5px] font-semibold text-ink">
        The key rates
      </h2>
      <dl className="grid divide-y divide-line-2 md:grid-cols-2 md:gap-x-10 md:divide-y-0">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 py-3 md:border-t md:border-line-2" title={r.detail}>
            <div className="min-w-0">
              <dt className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                {r.label}
                {r.chip && <Chip tone={r.chip.tone}>{r.chip.text}</Chip>}
              </dt>
              <dd className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{r.note}</dd>
            </div>
            <dd className="fig shrink-0 text-[22px] font-medium leading-none text-ink" title={r.precise}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
