import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const push = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => search,
}));

import { OverviewContent } from '@/components/dashboard/OverviewContent';
import { MonthNav } from '@/components/dashboard/MonthNav';
import { BudgetPace, overBudget } from '@/components/dashboard/BudgetPace';
import { upcomingCharges } from '@/components/dashboard/ComingUp';
import type { BudgetComparison } from '@/lib/types/budget';

const mockFetch = vi.fn();
global.fetch = mockFetch;
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (body: unknown) => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(body) });

const NOW = new Date(2026, 9, 7, 12);

const comparisons: BudgetComparison[] = [
  { categoryId: 'g', categoryName: 'Groceries', groupName: 'Food', isIncome: false, budgetAmount: 600, actualAmount: 186, variance: 0 },
  { categoryId: 'e', categoryName: 'Eating out', groupName: 'Food', isIncome: false, budgetAmount: 180, actualAmount: 214, variance: 0 },
  { categoryId: 's', categoryName: 'Salary', groupName: 'Income', isIncome: true, budgetAmount: 5000, actualAmount: 4100, variance: 0 },
  { categoryId: 'u', categoryName: 'Unbudgeted', groupName: 'Misc', isIncome: false, budgetAmount: 0, actualAmount: 40, variance: 0 },
];

const bodies: Record<string, unknown> = {
  '/api/accounts/summary': { netWorth: 486320 },
  '/api/wealth/history': {
    snapshots: [
      { date: '2026-09-01', total: 480200, byType: {} },
      { date: '2026-10-01', total: 486320, byType: {} },
    ],
  },
  '/api/budgets/savings-rate': { savingsRate: { totalExpenseActual: 1148, totalExpenseBudget: 3400, totalIncomeActual: 4100 } },
  '/api/budgets/comparison': { comparisons },
  '/api/transactions/by-category': [{ categoryId: 'g', categoryName: 'Groceries', amount: 186, percentage: 100 }],
  '/api/transactions/monthly-trend': [
    { month: 'Sep', income: 5000, expenses: 4000 },
    { month: 'Oct', income: 4100, expenses: 1148 },
  ],
  '/api/transactions/ids': { total: 6 },
  '/api/transactions': { data: [] },
  '/api/subscriptions': { subscriptions: [] },
  '/api/fire/coast': { coastFire: null },
};

let failing: string | null = null;
function respond(url: string) {
  const path = url.split('?')[0];
  if (path === failing) return fail({ error: 'Database unavailable' });
  return ok(bodies[path]);
}

describe('Overview page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    search = new URLSearchParams();
    failing = null;
    push.mockReset();
    mockFetch.mockReset();
    mockFetch.mockImplementation(respond);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens with a sentence built from the data', async () => {
    render(<OverviewContent />);
    await waitFor(() => expect(screen.getByText(/of a/)).toBeInTheDocument());
    const lede = screen.getByText(/plan with 24 days to go/).closest('p')!;
    expect(lede.textContent).toBe(
      "You've spent £1,148 of a £3,400 plan with 24 days to go, a little ahead of pace. Eating out is already over. £4,100 has come in. 6 transactions need a category."
    );
    expect(screen.getByRole('link', { name: '6 transactions' })).toHaveAttribute('href', '/review');
  });

  it('shows net worth with the change since the start of the month', async () => {
    render(<OverviewContent />);
    await waitFor(() => expect(screen.getByText('£486,320')).toBeInTheDocument());
    expect(screen.getByText('+£6,120')).toBeInTheDocument();
    expect(screen.getByText(/since 1 Oct/)).toBeInTheDocument();
  });

  it('reads the month from the URL and fetches that month', async () => {
    search = new URLSearchParams('month=2026-09');
    render(<OverviewContent />);
    await waitFor(() => expect(mockFetch.mock.calls.map((c) => c[0])).toContain('/api/budgets/comparison?year=2026&month=9'));
    expect(screen.getByRole('link', { name: 'All budgets →' })).toHaveAttribute('href', '/budgets?month=2026-09');
    await waitFor(() => expect(screen.getByText(/in September/)).toBeInTheDocument());
  });

  it('moves between months through the URL', async () => {
    search = new URLSearchParams('month=2026-09');
    render(<OverviewContent />);
    fireEvent.click(screen.getByRole('button', { name: /Previous month, August/ }));
    expect(push).toHaveBeenCalledWith('/?month=2026-08', { scroll: false });
    fireEvent.click(screen.getByRole('button', { name: /Next month, October/ }));
    expect(push).toHaveBeenLastCalledWith('/', { scroll: false });
  });

  it('shows an error with a retry for just the section that failed', async () => {
    failing = '/api/budgets/comparison';
    render(<OverviewContent />);
    await waitFor(() => expect(screen.getByText(/Couldn't load budgets/)).toBeInTheDocument());
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    // The rest of the page still loads.
    await waitFor(() => expect(screen.getByText('£486,320')).toBeInTheDocument());

    failing = null;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText(/Couldn't load budgets/)).not.toBeInTheDocument());
    expect(screen.getByRole('meter', { name: 'Groceries: £186 of £600' })).toBeInTheDocument();
  });
});

describe('MonthNav', () => {
  afterEach(cleanup);

  it('shows the month and year and blocks future months', () => {
    const onChange = vi.fn();
    render(<MonthNav month={{ year: 2026, month: 10 }} onChange={onChange} now={NOW} />);
    expect(screen.getByRole('button', { name: /October 2026\. Choose a month/ })).toBeInTheDocument();
    const next = screen.getByRole('button', { name: /Next month/ });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Previous month/ }));
    expect(onChange).toHaveBeenCalledWith({ year: 2026, month: 9 });
  });

  it('allows stepping into a past year', () => {
    render(<MonthNav month={{ year: 2025, month: 12 }} onChange={() => {}} now={NOW} />);
    expect(screen.getByRole('button', { name: /December 2025\. Choose a month/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month, January 2026' })).not.toBeDisabled();
  });
});

describe('BudgetPace', () => {
  afterEach(cleanup);

  it('shows budgeted expense categories, biggest plan first, with overspend', () => {
    render(<BudgetPace rows={comparisons} pace={0.23} budgetsHref="/budgets?month=2026-10" />);
    const meters = screen.getAllByRole('meter');
    expect(meters.map((m) => m.getAttribute('aria-label'))).toEqual(['Groceries: £186 of £600', 'Eating out: £214 of £180']);
    expect(screen.getByText('£34 over')).toHaveClass('text-bad');
    expect(screen.queryByText('Salary')).not.toBeInTheDocument();
    expect(screen.queryByText('Unbudgeted')).not.toBeInTheDocument();
  });

  it('lists over-budget categories, worst first', () => {
    expect(overBudget(comparisons)).toEqual(['Eating out']);
  });

  it('has an empty state with a way to set budgets', () => {
    render(<BudgetPace rows={[]} budgetsHref="/budgets?month=2026-10" />);
    expect(screen.getByText('No budgets for this month')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set budgets' })).toHaveAttribute('href', '/budgets?month=2026-10');
  });
});

describe('upcomingCharges', () => {
  it('keeps active charges due in the next 14 days, soonest first', () => {
    const subs = [
      { id: '1', name: 'Later', amount: 1, frequency: 'monthly', status: 'active', next_due: '2026-10-20' },
      { id: '2', name: 'Soon', amount: 1, frequency: 'monthly', status: null, next_due: '2026-10-08' },
      { id: '3', name: 'Too far', amount: 1, frequency: 'monthly', status: 'active', next_due: '2026-10-22' },
      { id: '4', name: 'Cancelled', amount: 1, frequency: 'monthly', status: 'cancelled', next_due: '2026-10-09' },
      { id: '5', name: 'Unknown', amount: 1, frequency: 'monthly', status: 'active', next_due: null },
    ];
    expect(upcomingCharges(subs, NOW).map((s) => s.name)).toEqual(['Soon', 'Later']);
  });
});
