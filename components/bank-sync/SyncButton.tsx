'use client';

import { useEffect, useRef, useState } from 'react';

interface SyncTotals {
  imported: number;
  alreadyPresent: number;
}

interface SyncButtonProps {
  /** Omit to sync all sync-enabled accounts. */
  accountId?: string;
  label?: string;
  className?: string;
}

const AUTO_CLEAR_MS = 6000;
const DEFAULT_CLASS_NAME =
  'text-sm px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5';

/**
 * Fire-and-forget sync trigger for TrueLayer. Safe to render even when
 * TrueLayer isn't configured — the error simply surfaces on click.
 */
export function SyncButton({ accountId, label, className }: SyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const scheduleClear = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setResult(null);
      setError(null);
      setNotConfigured(false);
    }, AUTO_CLEAR_MS);
  };

  const handleSync = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);
    setNotConfigured(false);

    try {
      const response = await fetch('/api/truelayer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountId ? { accountId } : {}),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 503) {
        setNotConfigured(true);
        setError(data.error || 'TrueLayer is not configured');
        scheduleClear();
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      const totals: SyncTotals = data.totals ?? { imported: 0, alreadyPresent: 0 };
      setResult(`Imported ${totals.imported} • ${totals.alreadyPresent} already up to date`);
      scheduleClear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      scheduleClear();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button onClick={handleSync} disabled={isLoading} className={className || DEFAULT_CLASS_NAME}>
        {isLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Syncing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {label || 'Sync now'}
          </>
        )}
      </button>

      {result && <p className="text-xs text-emerald-700">{result}</p>}

      {error && (
        <p className="text-xs text-red-600">
          {error}
          {notConfigured && (
            <>
              {' '}
              <a href="/settings/bank-sync" className="underline hover:text-red-700">
                Set up Bank Sync
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
