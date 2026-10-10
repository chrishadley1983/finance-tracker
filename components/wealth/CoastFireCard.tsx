'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatGBP } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Notice, SkeletonRows } from '@/components/ui/Notice';

export interface CoastFireData {
  coastFire: {
    value: number;
    fireNumberAtRetirement: number;
    currentNetWorth: number;
    progress: number;
    surplus: number;
    isCoastFI: boolean;
  } | null;
  inputs: {
    currentAge: number;
    targetRetirementAge: number;
    yearsLeft: number;
    excludeProperty?: boolean;
  };
  settings: {
    annualSpend: number;
    withdrawalRate: number;
    expectedReturn: number;
  };
  error?: string;
}

/** Where FIRE inputs are edited (the one place). */
export const FIRE_SETTINGS_HREF = '/fire?tab=settings';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

interface CoastFireCardProps {
  /** Change this to refetch (e.g. after balances are saved). */
  refreshKey?: number;
}

/**
 * Coast FIRE in plain words, plus a read-only summary of the FIRE inputs it
 * uses. The inputs are edited on the FIRE page only.
 */
export function CoastFireCard({ refreshKey = 0 }: CoastFireCardProps) {
  const [data, setData] = useState<CoastFireData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    if (!loaded.current) setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/fire/coast', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const result = (await response.json().catch(() => ({}))) as Partial<CoastFireData>;
      if (!response.ok) throw new Error(result.error || 'The server returned an error.');
      if (!result.coastFire) {
        setNotConfigured(true);
        setData(null);
      } else {
        setNotConfigured(false);
        setData(result as CoastFireData);
      }
      loaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (isLoading) return <SkeletonRows rows={4} />;

  if (error) {
    return (
      <Notice tone="error" action={<Button size="sm" onClick={load}>Try again</Button>}>
        Couldn&apos;t work out Coast FIRE. {error}
      </Notice>
    );
  }

  if (notConfigured || !data?.coastFire) {
    return (
      <p className="text-sm text-ink-2">
        Coast FIRE needs your spending, withdrawal rate and retirement age.{' '}
        <Link href={FIRE_SETTINGS_HREF} className="text-accent underline-offset-2 hover:underline">
          Set them on the FIRE page
        </Link>
        .
      </p>
    );
  }

  const { coastFire, inputs, settings } = data;
  const ahead = coastFire.surplus >= 0;
  const progress = Math.max(0, Math.min(coastFire.progress, 100));

  return (
    <div className="grid gap-3">
      <p className="text-[14px] leading-relaxed text-ink-2">
        To stop saving and still retire at {inputs.targetRetirementAge}, you need about{' '}
        <strong className="fig font-semibold text-ink">{formatGBP(coastFire.value)}</strong> invested today.{' '}
        {ahead ? (
          <>
            You have <span className="fig text-ink">{formatGBP(coastFire.currentNetWorth)}</span>, so you&apos;re{' '}
            <span className="fig font-medium text-in">{formatGBP(coastFire.surplus)}</span> past it.
          </>
        ) : (
          <>
            You have <span className="fig text-ink">{formatGBP(coastFire.currentNetWorth)}</span>, so you&apos;re{' '}
            <span className="fig font-medium text-ink">{formatGBP(Math.abs(coastFire.surplus))}</span> short.
          </>
        )}
      </p>

      <div>
        <div
          role="meter"
          aria-label="Progress to Coast FIRE"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="relative h-1.5 rounded-full bg-line-2"
        >
          <div className={`absolute inset-y-0 left-0 rounded-full ${ahead ? 'bg-accent' : 'bg-ink-2'}`} style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[12px] text-ink-3">
          <span className="fig">{Math.round(coastFire.progress)}%</span> of the way there
        </p>
      </div>

      <div className="border-t border-line-2 pt-3">
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          Based on spending <span className="fig text-ink-2">{formatGBP(settings.annualSpend)}</span> a year, a{' '}
          <span className="fig text-ink-2">{settings.withdrawalRate}%</span> withdrawal rate and{' '}
          <span className="fig text-ink-2">{settings.expectedReturn}%</span> growth a year, retiring in{' '}
          {plural(inputs.yearsLeft, 'year')} (target pot{' '}
          <span className="fig text-ink-2">{formatGBP(coastFire.fireNumberAtRetirement)}</span>)
          {inputs.excludeProperty ? ', not counting property' : ''}.
        </p>
        <Link href={FIRE_SETTINGS_HREF} className="mt-1.5 inline-block text-[12.5px] text-accent underline-offset-2 hover:underline">
          Edit on the FIRE page
        </Link>
      </div>
    </div>
  );
}
