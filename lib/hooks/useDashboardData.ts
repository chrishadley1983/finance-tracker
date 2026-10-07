'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BudgetComparison, SavingsRate } from '@/lib/types/budget';
import type { NetWorthHistory } from '@/lib/types/fire';
import { monthRange, type TrendPoint, type YearMonth } from '@/lib/dashboard/overview';

/** One section's data: each section loads, fails and retries on its own. */
export interface Resource<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  needs_review?: boolean | null;
  category: { name: string } | null;
}

export interface CategorySpend {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
}

export interface UpcomingCharge {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  status: string | null;
  next_due: string | null;
}

export interface CoastFire {
  coastFire: {
    value: number;
    fireNumberAtRetirement: number;
    currentNetWorth: number;
    progress: number;
    surplus: number;
    isCoastFI: boolean;
  } | null;
  inputs?: { currentAge: number; targetRetirementAge: number; yearsLeft: number };
  error?: string;
}

export interface DashboardData {
  netWorth: Resource<{ netWorth: number }>;
  netWorthHistory: Resource<NetWorthHistory>;
  savings: Resource<SavingsRate>;
  budgets: Resource<BudgetComparison[]>;
  categorySpend: Resource<CategorySpend[]>;
  trend: Resource<TrendPoint[]>;
  latest: Resource<Transaction[]>;
  uncategorised: Resource<number>;
  upcoming: Resource<UpcomingCharge[]>;
  fire: Resource<CoastFire>;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    // not JSON
  }
  return `The server answered ${res.status}`;
}

/** GET a URL and pick out the part a section needs. */
export function useResource<T>(url: string, pick: (json: unknown) => T): Resource<T> {
  const [state, setState] = useState<{ data: T | null; isLoading: boolean; error: string | null }>({
    data: null,
    isLoading: true,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  // `pick` is a pure mapping per call site; only the URL decides when to refetch.
  const select = useCallback(pick, [url]);

  useEffect(() => {
    let live = true;
    setState({ data: null, isLoading: true, error: null });
    (async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(await readError(res));
        const data = select(await res.json());
        if (live) setState({ data, isLoading: false, error: null });
      } catch (err) {
        if (live) setState({ data: null, isLoading: false, error: err instanceof Error ? err.message : 'Something went wrong' });
      }
    })();
    return () => {
      live = false;
    };
  }, [url, select, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

const asArray = <T,>(json: unknown): T[] => (Array.isArray(json) ? (json as T[]) : []);

/** Everything the Overview shows for one month, fetched section by section. */
export function useDashboardData(month: YearMonth): DashboardData {
  const { start, end } = monthRange(month);
  const ym = `year=${month.year}&month=${month.month}`;
  const range = `start_date=${start}&end_date=${end}`;

  return {
    netWorth: useResource('/api/accounts/summary', (j) => ({ netWorth: Number((j as { netWorth?: number }).netWorth) || 0 })),
    netWorthHistory: useResource('/api/wealth/history?period=1y', (j) => {
      const h = j as Partial<NetWorthHistory>;
      return { snapshots: h.snapshots ?? [], earliest: h.earliest ?? null, latest: h.latest ?? null };
    }),
    savings: useResource(`/api/budgets/savings-rate?${ym}`, (j) => (j as { savingsRate: SavingsRate }).savingsRate),
    budgets: useResource(`/api/budgets/comparison?${ym}`, (j) => asArray<BudgetComparison>((j as { comparisons?: unknown }).comparisons)),
    categorySpend: useResource(`/api/transactions/by-category?period=custom&start=${start}&end=${end}`, (j) => asArray<CategorySpend>(j)),
    trend: useResource('/api/transactions/monthly-trend?months=12', (j) => asArray<TrendPoint>(j)),
    latest: useResource(
      `/api/transactions?${range}&limit=5&sort_column=date&sort_direction=desc&totals=0`,
      (j) => asArray<Transaction>((j as { data?: unknown }).data)
    ),
    uncategorised: useResource(`/api/transactions/ids?${range}&status=uncategorised`, (j) => Number((j as { total?: number }).total) || 0),
    upcoming: useResource('/api/subscriptions', (j) => asArray<UpcomingCharge>((j as { subscriptions?: unknown }).subscriptions)),
    fire: useResource('/api/fire/coast', (j) => j as CoastFire),
  };
}
