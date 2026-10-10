import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';

const push = vi.fn();
let search = new URLSearchParams('month=2026-10');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/budgets',
  useSearchParams: () => search,
}));

import { BudgetsView } from '@/components/budgets/BudgetsView';

const NOW = new Date(2026, 9, 7, 12);

const groups = () => [
  {
    groupName: 'Food',
    isIncome: false,
    categories: [
      { categoryId: 'cat-eat', categoryName: 'Eating out', groupName: 'Food', isIncome: false, budgetAmount: 250, actualAmount: 286, variance: 36 },
      { categoryId: 'cat-gro', categoryName: 'Groceries', groupName: 'Food', isIncome: false, budgetAmount: 600, actualAmount: 186, variance: -414 },
      { categoryId: 'cat-none', categoryName: 'Takeaway', groupName: 'Food', isIncome: false, budgetAmount: 0, actualAmount: 0, variance: 0 },
    ],
    totals: { budget: 850, actual: 472, variance: -378 },
  },
  {
    groupName: 'Income',
    isIncome: true,
    categories: [{ categoryId: 'cat-sal', categoryName: 'Salary', groupName: 'Income', isIncome: true, budgetAmount: 5000, actualAmount: 5000, variance: 0 }],
    totals: { budget: 5000, actual: 5000, variance: 0 },
  },
];

const savingsRate = {
  totalIncomeBudget: 5000, totalIncomeActual: 5000, totalExpenseBudget: 850, totalExpenseActual: 472,
  savingsBudget: 4150, savingsActual: 4528, savingsRateBudget: 83, savingsRateActual: 90.6,
};

type Call = { url: string; init?: RequestInit };
let calls: Call[];
let bulkOk: boolean;
let copyStatus: number;
let comparisonGroups: ReturnType<typeof groups>;

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

function respond(url: string, init?: RequestInit) {
  calls.push({ url, init });
  if (url === '/api/budgets/sync') return json({ success: true });
  if (url.startsWith('/api/budgets/comparison')) return json({ groups: comparisonGroups });
  if (url.startsWith('/api/budgets/savings-rate')) return json({ savingsRate });
  if (url.startsWith('/api/budgets/bulk?year=')) {
    const months = (n: number) => Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { id: `b${i}`, amount: n }]));
    return json({ budgets: [{ categoryId: 'cat-eat', months: months(250) }, { categoryId: 'cat-gro', months: months(600) }, { categoryId: 'cat-sal', months: months(5000) }] });
  }
  if (url.startsWith('/api/budgets/category/')) return json(url.includes('month=') ? detail : yearDetail);
  if (url === '/api/budgets/bulk') return bulkOk ? json({ success: true }) : json({ error: 'Database is down' }, 500);
  if (url === '/api/budgets/copy-month') {
    const body = JSON.parse(String(init?.body));
    if (copyStatus === 409 && !body.overwrite) return json({ error: 'exists', existing: 2 }, 409);
    return json({ success: true, copied: 2, replaced: 2, previous: [{ categoryId: 'cat-eat', amount: 250 }] });
  }
  return json({}, 404);
}

const detail = {
  category: { id: 'cat-eat', name: 'Eating out', groupName: 'Food', isIncome: false },
  period: { view: 'month', year: 2026, month: 10, label: 'October 2026', from: '2026-10-01', to: '2026-10-31' },
  budget: 250,
  actual: 286,
  budgetToDate: null,
  months: Array.from({ length: 12 }, (_, i) => ({
    key: `2026-${String(i + 1).padStart(2, '0')}`, year: 2026, month: i + 1, label: 'M', actual: 200, budget: 250, partial: i === 9, future: i > 9,
  })),
  trend: { recentAvg: 240, priorAvg: 200, change: 0.2, sameMonthLastYear: 190, recentMonths: 6 },
  recent: [{ id: 't1', date: '2026-10-05', description: 'SOUL RAMEN', amount: -85.14, account: 'HSBC Joint' }],
  count: 7,
};

const yearDetail = {
  ...detail,
  period: { view: 'year', year: 2026, month: null, label: '2026', from: '2026-01-01', to: '2026-12-31' },
  budget: 3000,
  actual: 2692,
  budgetToDate: 2500,
  count: 88,
};

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function renderView() {
  return render(
    <ToastProvider>
      <BudgetsView now={NOW} />
    </ToastProvider>
  );
}

const posts = (path: string) => calls.filter((c) => c.url === path && c.init?.method === 'POST');

beforeEach(() => {
  calls = [];
  bulkOk = true;
  copyStatus = 200;
  comparisonGroups = groups();
  search = new URLSearchParams('month=2026-10');
  push.mockClear();
  mockFetch.mockReset();
  mockFetch.mockImplementation(respond);
});
afterEach(cleanup);

describe('BudgetsView', () => {
  it('opens with a sentence about the month and what is over', async () => {
    renderView();
    const lede = await screen.findByText(/spent in October, 24 days to go/);
    expect(lede.textContent).toContain('£472 of £850 spent in October, 24 days to go. Eating out is over.');
    expect(screen.getByText('£36 over')).toBeTruthy();
    expect(screen.getByText('£414 left')).toBeTruthy();
    // Empty categories are tucked away
    expect(screen.queryByText('Takeaway')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show 1 category with no budget/ }));
    expect(screen.getByText('Takeaway')).toBeTruthy();
  });

  it('fetches the month from the URL', async () => {
    search = new URLSearchParams('month=2025-03');
    renderView();
    await screen.findByRole('button', { name: /^March 2025\. Choose a month/ });
    expect(calls.some((c) => c.url === '/api/budgets/comparison?year=2025&month=3')).toBe(true);
  });

  it('puts the period in the URL when moving months and switching to the year', async () => {
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: /^Next month/ }));
    expect(push).toHaveBeenLastCalledWith('/budgets?month=2026-11', { scroll: false });
    fireEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(push).toHaveBeenLastCalledWith('/budgets?year=2026&view=year', { scroll: false });
  });

  it('year view reads ?view=year and fetches the whole year', async () => {
    search = new URLSearchParams('year=2026&view=year');
    renderView();
    // Mid-year the sentence compares with the budget for January to October.
    const lede = await screen.findByText(/spent in 2026 so far, against/);
    expect(lede.textContent).toBe('£472 spent in 2026 so far, against £8,500 budgeted to date (£850 for the year), 2 months to go. Nothing is over budget so far.');
    expect(calls.some((c) => c.url === '/api/budgets/comparison?year=2026')).toBe(true);
  });

  it('edits a budget in place: Enter saves optimistically and confirms with a toast', async () => {
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: /Edit budget for Eating out, £250/ }));
    const input = screen.getByRole('textbox', { name: 'Budget for Eating out in October' });
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Optimistic: the new figure and the recomputed words show straight away
    expect(screen.getByRole('button', { name: /Edit budget for Eating out, £300/ })).toBeTruthy();
    await screen.findByText('Eating out budget for October set to £300.');
    const body = JSON.parse(String(posts('/api/budgets/bulk')[0].init?.body));
    expect(body.entries).toEqual([{ categoryId: 'cat-eat', year: 2026, month: 10, amount: 300 }]);
  });

  it('rolls back and shows an error toast when the save fails', async () => {
    bulkOk = false;
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: /Edit budget for Groceries, £600/ }));
    const input = screen.getByRole('textbox', { name: /Budget for Groceries/ });
    fireEvent.change(input, { target: { value: '450' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await screen.findByText(/Couldn't save the Groceries budget \(Database is down\)\. It is back to £600\./);
    expect(screen.getByRole('button', { name: /Edit budget for Groceries, £600/ })).toBeTruthy();
    expect(screen.getByText('£414 left')).toBeTruthy();
  });

  it('Escape cancels an edit without saving', async () => {
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: /Edit budget for Eating out/ }));
    const input = screen.getByRole('textbox', { name: /Budget for Eating out/ });
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: /Budget for Eating out/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Edit budget for Eating out, £250/ })).toBeTruthy();
    expect(posts('/api/budgets/bulk')).toHaveLength(0);
  });

  it('rejects an invalid amount and keeps the editor open', async () => {
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: /Edit budget for Eating out/ }));
    const input = screen.getByRole('textbox', { name: /Budget for Eating out/ });
    fireEvent.change(input, { target: { value: 'lots' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Enter an amount, e.g. 250')).toBeTruthy();
    expect(posts('/api/budgets/bulk')).toHaveLength(0);
  });

  it('asks before copying last month over a month that already has budgets', async () => {
    copyStatus = 409;
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: 'Copy from September' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText("Replace October's budgets?")).toBeTruthy();
    expect(posts('/api/budgets/copy-month')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy from September' }));
    await screen.findByText('Copied 2 budgets from September.');
    expect(JSON.parse(String(posts('/api/budgets/copy-month')[0].init?.body))).toEqual({ from: '2026-09', to: '2026-10', overwrite: true });
  });

  it('shows an empty state with copy actions when nothing is budgeted', async () => {
    comparisonGroups = groups().map((g) => ({
      ...g,
      categories: g.categories.map((c) => ({ ...c, budgetAmount: 0, actualAmount: 0, variance: 0 })),
      totals: { budget: 0, actual: 0, variance: 0 },
    }));
    renderView();
    await screen.findByText('No budgets set for October 2026 yet');
    fireEvent.click(screen.getByRole('button', { name: 'Copy from September' }));
    await screen.findByText('Copied 2 budgets from September.');
    expect(JSON.parse(String(posts('/api/budgets/copy-month')[0].init?.body)).overwrite).toBe(false);
  });

  it('opens a detail panel for a budget line, linking to its transactions', async () => {
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: 'Eating out' }));
    const panel = await screen.findByRole('dialog');
    await within(panel).findByText('£286 of £250 spent in October 2026, £36 over budget.');
    expect(calls.some((c) => c.url === '/api/budgets/category/cat-eat?year=2026&month=10')).toBe(true);
    expect(within(panel).getByText('SOUL RAMEN')).toBeTruthy();
    expect(within(panel).getByText(/Averaging £240 a month over the last 6 months, up 20% on the 6 before/)).toBeTruthy();
    const link = within(panel).getByRole('link', { name: /See all 7 transactions in October 2026/ });
    expect(link.getAttribute('href')).toBe('/transactions?categoryId=cat-eat&dateFrom=2026-10-01&dateTo=2026-10-31');
  });

  it('the panel toggles its figures between the month and the year', async () => {
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: 'Eating out' }));
    const panel = await screen.findByRole('dialog');
    await within(panel).findByText('£286 of £250 spent in October 2026, £36 over budget.');
    expect(calls.some((c) => c.url === '/api/budgets/category/cat-eat?year=2026')).toBe(true);
    const toggle = within(panel).getByRole('group', { name: 'Figures for' });
    expect(within(toggle).getByRole('button', { name: 'October 2026' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(toggle).getByRole('button', { name: '2026' }));
    expect(within(panel).getByText('£2,692 spent in 2026 so far, against £2,500 budgeted to date (£3,000 for the year), £192 over budget.')).toBeTruthy();
    expect(within(panel).getByText('Budget to date')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: /See all 88 transactions in 2026/ }).getAttribute('href')).toBe(
      '/transactions?categoryId=cat-eat&dateFrom=2026-01-01&dateTo=2026-12-31'
    );
    // The chart and latest transactions stay put.
    expect(within(panel).getByText('SOUL RAMEN')).toBeTruthy();
  });

  it('clicking the row opens the detail, clicking the budget figure still edits', async () => {
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: /Edit budget for Groceries/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: /Budget for Groceries/ })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox', { name: /Budget for Groceries/ }), { key: 'Escape' });
    fireEvent.click(screen.getByText('£414 left'));
    await screen.findByRole('dialog');
    expect(calls.some((c) => c.url === '/api/budgets/category/cat-gro?year=2026&month=10')).toBe(true);
  });

  it('year view shows budget to date vs actual, with totals and the money left over', async () => {
    search = new URLSearchParams('year=2026&view=year');
    renderView();
    const table = await screen.findByTestId('budget-year-table');
    expect(within(table).getByText('Budget Jan–Oct')).toBeTruthy();
    // Eating out: £250 x 10 months to date = £2,500 vs £286 actual
    const eat = within(table).getAllByTestId('year-row').find((r) => r.textContent?.includes('Eating out'))!;
    expect(eat.textContent).toContain('£2,500');
    expect(eat.textContent).toContain('£2,214 under');
    expect(within(table).getByText('Total money in')).toBeTruthy();
    expect(within(table).getByText('Left over (money in minus spending)')).toBeTruthy();
    // Clicking a category opens the year's detail
    fireEvent.click(within(table).getByRole('button', { name: 'Salary' }));
    await screen.findByRole('dialog');
    expect(calls.some((c) => c.url === '/api/budgets/category/cat-sal?year=2026')).toBe(true);
  });

  it('shows an error with a retry when loading fails', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) =>
      url.startsWith('/api/budgets/comparison') ? json({}, 500) : respond(url, init)
    );
    renderView();
    await screen.findByText(/Could not load budgets for this period/);
    mockFetch.mockImplementation(respond);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText(/24 days to go/);
  });
});
