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
  if (url === '/api/budgets/bulk') return bulkOk ? json({ success: true }) : json({ error: 'Database is down' }, 500);
  if (url === '/api/budgets/copy-month') {
    const body = JSON.parse(String(init?.body));
    if (copyStatus === 409 && !body.overwrite) return json({ error: 'exists', existing: 2 }, 409);
    return json({ success: true, copied: 2, replaced: 2, previous: [{ categoryId: 'cat-eat', amount: 250 }] });
  }
  return json({}, 404);
}

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
    await screen.findByText(/March 2025/, { selector: 'h2' });
    expect(calls.some((c) => c.url === '/api/budgets/comparison?year=2025&month=3')).toBe(true);
  });

  it('puts the period in the URL when moving months and switching to the year', async () => {
    renderView();
    await screen.findByText(/24 days to go/);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(push).toHaveBeenLastCalledWith('/budgets?month=2026-11', { scroll: false });
    fireEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(push).toHaveBeenLastCalledWith('/budgets?year=2026&view=year', { scroll: false });
  });

  it('year view reads ?view=year and fetches the whole year', async () => {
    search = new URLSearchParams('year=2026&view=year');
    renderView();
    await screen.findByText(/spent in 2026 so far, 2 months to go/);
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
