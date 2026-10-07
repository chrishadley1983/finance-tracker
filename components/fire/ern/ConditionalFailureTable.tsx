'use client';

import { Panel } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Notice';

interface ConditionalFailureRow {
  label: string;
  count: number;
  failureRates: Record<string, number>;
}

interface ConditionalFailureTableProps {
  table: {
    wrRates: number[];
    rows: ConditionalFailureRow[];
  } | null;
  /** Your withdrawal rate (%), to mark the nearest column. */
  personalWr?: number;
  isLoading?: boolean;
}

/** Cell style: quiet when safe, amber when some periods failed, red when many did. */
export function failureCellClass(rate: number): string {
  if (rate === 0) return 'text-ink-3';
  if (rate < 5) return 'text-ink';
  if (rate < 20) return 'bg-warn-soft text-warn';
  return 'bg-bad-soft text-bad';
}

/**
 * On a phone only a few rate columns fit: keep the `size` columns centred on
 * your rate (or the lowest ones) and hide the rest below the sm breakpoint.
 */
export function phoneRateWindow(wrRates: number[], nearest: number | undefined, size = 4): Set<number> {
  const i = nearest === undefined ? 0 : Math.max(0, wrRates.indexOf(nearest));
  const start = Math.max(0, Math.min(i - Math.floor(size / 2) + 1, wrRates.length - size));
  return new Set(wrRates.slice(start, start + size));
}

export function ConditionalFailureTable({ table, personalWr, isLoading = false }: ConditionalFailureTableProps) {
  if (isLoading) {
    return (
      <Panel title="How often each rate failed, by starting valuation">
        <SkeletonRows rows={5} />
      </Panel>
    );
  }
  if (!table || !table.rows || table.rows.length === 0) return null;

  const { wrRates, rows } = table;
  const nearest =
    personalWr !== undefined && wrRates.length > 0
      ? wrRates.reduce((best, r) => (Math.abs(r - personalWr) < Math.abs(best - personalWr) ? r : best), wrRates[0])
      : undefined;
  const onPhone = phoneRateWindow(wrRates, nearest);
  const rateCol = (rate: number) => (onPhone.has(rate) ? '' : 'hidden sm:table-cell');

  return (
    <Panel title="How often each rate failed, by starting valuation">
      <p className="mb-3 max-w-[75ch] text-[13px] text-ink-2">
        The share of historical retirements that ran out of money, grouped by how expensive the market was at the start (CAPE).
        {nearest !== undefined && <> The underlined column is closest to your rate.</>}
        <span className="sm:hidden"> On a phone, only the rates either side of yours are shown.</span>
      </p>
      <div className="overflow-x-auto rounded-[3px] border border-line bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">Failure rate (%) by starting CAPE and withdrawal rate</caption>
          <thead>
            <tr className="border-b border-line bg-sunk text-[11.5px] text-ink-3">
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left font-medium">
                CAPE at start
              </th>
              <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                Months
              </th>
              {wrRates.map((rate) => (
                <th
                  key={rate}
                  scope="col"
                  className={`fig px-2 py-2 text-right ${rateCol(rate)} ${rate === nearest ? 'font-semibold text-ink underline decoration-[1.5px] underline-offset-4' : 'font-medium'}`}
                  aria-label={`${rate}% withdrawal${rate === nearest ? ', closest to yours' : ''}`}
                >
                  {rate}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-2">
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-ink">
                  {row.label}
                </th>
                <td className="fig hidden px-2 py-1.5 text-right text-ink-3 sm:table-cell">{row.count}</td>
                {wrRates.map((rate) => {
                  const failRate = row.failureRates[rate.toFixed(2)] ?? 0;
                  return (
                    <td
                      key={rate}
                      title={`${failRate.toFixed(1)}% of ${row.count} start months failed at ${rate}%`}
                      className={`fig px-2 py-1.5 text-right ${rateCol(rate)} ${failureCellClass(failRate)} ${rate === nearest ? 'font-semibold' : ''}`}
                    >
                      {Math.round(failRate)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
