'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NavSummary } from '@/lib/nav-summary';

const REFRESH_MS = 60_000;
export const NAV_SUMMARY_REFRESH_EVENT = 'nav-summary:refresh';

let cached: NavSummary | null = null;

/** Ask the navigation to re-fetch its live figures (e.g. after reviewing transactions). */
export function refreshNavSummary(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NAV_SUMMARY_REFRESH_EVENT));
}

export function useNavSummary(): { summary: NavSummary | null; stale: boolean } {
  const [summary, setSummary] = useState<NavSummary | null>(cached);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/nav-summary', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      cached = (await res.json()) as NavSummary;
      setSummary(cached);
      setStale(false);
    } catch {
      // Keep showing the last figures, but mark them as possibly out of date.
      setStale(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    window.addEventListener(NAV_SUMMARY_REFRESH_EVENT, load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(NAV_SUMMARY_REFRESH_EVENT, load);
    };
  }, [load]);

  return { summary, stale };
}
