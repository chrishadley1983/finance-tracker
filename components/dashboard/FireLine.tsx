'use client';

import Link from 'next/link';
import { formatGBP } from '@/lib/format';
import type { CoastFire } from '@/lib/hooks/useDashboardData';

/** One line on financial independence, from the Coast FIRE calculation. */
export function FireLine({ data }: { data: CoastFire }) {
  const c = data.coastFire;
  if (!c) {
    return (
      <p className="text-[13.5px] text-ink-2">
        Add your age, spending and target retirement age to see how close you are.{' '}
        <Link href="/fire" className="text-accent hover:underline">
          Set up FIRE
        </Link>
      </p>
    );
  }
  const age = data.inputs?.targetRetirementAge;
  const retire = age ? ` to retire at ${age}` : '';
  return (
    <p className="text-[13.5px] leading-relaxed text-ink-2">
      {c.isCoastFI ? (
        <>
          You&apos;ve reached Coast FI: <strong className="fig font-medium text-ink">{formatGBP(c.currentNetWorth)}</strong> against the{' '}
          <span className="fig">{formatGBP(c.value)}</span> you need today{retire}.
        </>
      ) : (
        <>
          <strong className="fig font-medium text-ink">{Math.round(c.progress)}%</strong> of the way to Coast FI:{' '}
          <span className="fig">{formatGBP(c.currentNetWorth)}</span> of the <span className="fig">{formatGBP(c.value)}</span> you need today{retire}.
        </>
      )}{' '}
      Target pot <span className="fig">{formatGBP(c.fireNumberAtRetirement)}</span>.
    </p>
  );
}
