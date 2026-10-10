import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) });

const bodies: Record<string, unknown> = {
  '/api/accounts/summary': { netWorth: 1000, accountTypeBalances: [] },
  '/api/wealth/history': { snapshots: [{ date: '2026-10-01', total: 1000, byType: {} }], earliest: null, latest: null },
  '/api/budgets/savings-rate': { savingsRate: { totalExpenseActual: 100, totalExpenseBudget: 200, totalIncomeActual: 300 } },
  '/api/budgets/comparison': { comparisons: [{ categoryId: 'c', categoryName: 'Food', isIncome: false, budgetAmount: 200, actualAmount: 100 }] },
  '/api/transactions/by-category': [{ categoryId: 'c', categoryName: 'Food', amount: 100, percentage: 100 }],
  '/api/transactions/monthly-trend': [{ month: 'Oct', income: 300, expenses: 100 }],
  '/api/transactions/ids': { ids: [], rows: [], total: 4 },
  '/api/transactions': { data: [{ id: 't', date: '2026-10-01', amount: -1, description: 'x', category: null }], total: 1 },
  '/api/subscriptions': { subscriptions: [{ id: 's', name: 'Netflix', amount: 12.99, status: 'active', next_due: '2026-10-12' }] },
  '/api/fire/coast': { coastFire: null, error: 'not set up' },
};

function route(url: string) {
  const path = url.split('?')[0];
  return bodies[path];
}

const OCT = { year: 2026, month: 10 };

describe('useDashboardData', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => ok(route(url)));
  });

  it('starts every section loading', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useDashboardData(OCT));
    expect(result.current.budgets.isLoading).toBe(true);
    expect(result.current.netWorth.isLoading).toBe(true);
  });

  it('asks each API for the chosen month', async () => {
    renderHook(() => useDashboardData(OCT));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
    const urls = mockFetch.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain('/api/budgets/comparison?year=2026&month=10');
    expect(urls).toContain('/api/budgets/savings-rate?year=2026&month=10');
    expect(urls).toContain('/api/transactions/by-category?period=custom&start=2026-10-01&end=2026-10-31');
    expect(urls).toContain('/api/transactions/ids?start_date=2026-10-01&end_date=2026-10-31&status=uncategorised');
    expect(urls).toContain('/api/transactions?start_date=2026-10-01&end_date=2026-10-31&limit=5&sort_column=date&sort_direction=desc&totals=0');
    expect(urls).toContain('/api/transactions/monthly-trend?months=12');
  });

  it('picks out the data each section needs', async () => {
    const { result } = renderHook(() => useDashboardData(OCT));
    await waitFor(() => expect(result.current.fire.isLoading).toBe(false));
    await waitFor(() => expect(result.current.latest.data).not.toBeNull());
    expect(result.current.netWorth.data).toEqual({ netWorth: 1000 });
    expect(result.current.savings.data?.totalExpenseBudget).toBe(200);
    expect(result.current.budgets.data).toHaveLength(1);
    expect(result.current.uncategorised.data).toBe(4);
    expect(result.current.latest.data).toHaveLength(1);
    expect(result.current.upcoming.data?.[0].name).toBe('Netflix');
    expect(result.current.fire.data?.coastFire).toBeNull();
  });

  it('fails one section without affecting the others, and retries it', async () => {
    let budgetsFail = true;
    mockFetch.mockImplementation((url: string) =>
      url.startsWith('/api/budgets/comparison') && budgetsFail ? fail(500, { error: 'RPC timed out' }) : ok(route(url))
    );
    const { result } = renderHook(() => useDashboardData(OCT));
    await waitFor(() => expect(result.current.budgets.error).toBe('RPC timed out'));
    await waitFor(() => expect(result.current.savings.data).not.toBeNull());
    expect(result.current.savings.error).toBeNull();

    budgetsFail = false;
    act(() => result.current.budgets.retry());
    await waitFor(() => expect(result.current.budgets.data).toHaveLength(1));
    expect(result.current.budgets.error).toBeNull();
  });

  it('reports a status when the error body is not JSON', async () => {
    mockFetch.mockImplementation((url: string) =>
      url === '/api/fire/coast' ? Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('html')) }) : ok(route(url))
    );
    const { result } = renderHook(() => useDashboardData(OCT));
    await waitFor(() => expect(result.current.fire.error).toBe('The server answered 502'));
  });

  it('refetches month-scoped sections when the month changes', async () => {
    const { rerender } = renderHook(({ m }) => useDashboardData(m), { initialProps: { m: OCT } });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
    rerender({ m: { year: 2026, month: 9 } });
    await waitFor(() =>
      expect(mockFetch.mock.calls.map((c) => c[0])).toContain('/api/budgets/comparison?year=2026&month=9')
    );
    // Month-independent sections are not fetched again.
    expect(mockFetch.mock.calls.filter((c) => c[0] === '/api/accounts/summary')).toHaveLength(1);
  });
});
