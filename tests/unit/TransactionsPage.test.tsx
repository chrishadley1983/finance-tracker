import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { __resetCategoriesCache } from '@/lib/hooks/useCategories';
import { __resetAccountsCache } from '@/lib/hooks/useAccounts';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/transactions',
  useSearchParams: () => search,
}));
vi.mock('@/components/bank-sync', () => ({ SyncButton: () => null }));

import { TransactionsPageContent } from '@/components/transactions/TransactionsPageContent';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const rows = [
  { id: 'a', date: '2026-10-07', amount: -10, description: 'TESCO STORES 1', account_id: 'acc-1', category_id: null, categorisation_source: 'import', hsbc_transaction_id: null, created_at: '', is_validated: false, needs_review: false, account: { name: 'Current' }, category: null },
  { id: 'b', date: '2026-10-07', amount: -20, description: 'TESCO STORES 2', account_id: 'acc-1', category_id: null, categorisation_source: 'import', hsbc_transaction_id: null, created_at: '', is_validated: true, needs_review: false, account: { name: 'Current' }, category: null },
  { id: 'c', date: '2026-10-06', amount: 100, description: 'SALARY', account_id: 'acc-1', category_id: null, categorisation_source: 'import', hsbc_transaction_id: null, created_at: '', is_validated: false, needs_review: true, account: { name: 'Current' }, category: null },
];

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let bulkFails = false;
let toValidateCount: number | null = null;

function json(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

function respond(url: string, init?: RequestInit) {
  calls.push({ url, init });
  if (url === '/api/categories') return json([{ id: 'cat-1', name: 'Groceries', group_name: 'Food' }]);
  if (url === '/api/accounts') return json({ accounts: [{ id: 'acc-1', name: 'Current', type: 'current' }, { id: 'acc-2', name: 'Joint', type: 'current' }] });
  if (url.startsWith('/api/transactions/ids')) {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `id-${i}`, amount: -1, description: 'TESCO STORES 9', needs_review: false, category_id: null }));
    return json({ ids: many.map((r) => r.id), rows: many, total: 40, capped: false });
  }
  if (url.startsWith('/api/transactions/validate-matching')) {
    if (init?.method === 'POST') {
      const ids = Array.from({ length: 12 }, (_, i) => `v-${i}`);
      return json({ updated: 12, ids, capped: false });
    }
    return json({ count: toValidateCount });
  }
  if (url.startsWith('/api/transactions?')) return json({ data: rows, total: 40, totals: { out: 1234.5, in: 100 } });
  if (url === '/api/transactions/bulk') {
    if (bulkFails) return json({ error: 'Bulk exploded' }, false);
    const body = JSON.parse(String(init?.body));
    return json({
      success: true,
      updated: body.ids.length,
      previous: body.ids.map((id: string) => ({ id, is_validated: id === 'b', needs_review: false, account_id: 'acc-1' })),
    });
  }
  return json({}, false);
}

function renderPage() {
  return render(
    <ToastProvider>
      <TransactionsPageContent />
    </ToastProvider>
  );
}

const bulkCalls = () => calls.filter((c) => c.url === '/api/transactions/bulk').map((c) => JSON.parse(String(c.init!.body)));

describe('Transactions page', () => {
  beforeEach(() => {
    calls = [];
    bulkFails = false;
    toValidateCount = null;
    search = new URLSearchParams();
    vi.clearAllMocks();
    __resetCategoriesCache();
    __resetAccountsCache();
    mockFetch.mockImplementation(respond);
  });

  afterEach(() => cleanup());

  it('shows "<N> transactions match · £X out · £Y in"', async () => {
    renderPage();
    const summary = await screen.findByTestId('transactions-summary');
    await waitFor(() => expect(summary.textContent).toBe('40 transactions match · £1,234.50 out · £100.00 in'));
  });

  it('seeds filters from the URL and writes changes back', async () => {
    search = new URLSearchParams('status=needs_review');
    renderPage();
    await waitFor(() => expect(calls.some((c) => c.url.includes('status=needs_review'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Needs review' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Needs category' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/transactions?status=uncategorised', { scroll: false }));
  });

  it('selects all matching rows via /api/transactions/ids', async () => {
    renderPage();
    await screen.findByText('SALARY');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select all 40 matching' }));
    const bar = await screen.findByRole('region', { name: 'Bulk actions' });
    await waitFor(() => expect(bar.textContent).toContain('40 selected'));
    expect(bar.textContent).toContain('£40.00');
    expect(screen.getByText(/All 40 matching transactions are selected/)).toBeInTheDocument();
    // All share one merchant: "Make a rule" is offered.
    expect(within(bar).getByRole('button', { name: /Make a rule/ })).toBeInTheDocument();
  });

  it('marks selected rows validated, with Undo restoring previous values', async () => {
    renderPage();
    await screen.findByText('SALARY');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select TESCO STORES 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select TESCO STORES 2' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(bar.textContent).toContain('2 selected');
    expect(bar.textContent).toContain('£30.00');

    fireEvent.click(within(bar).getByRole('button', { name: 'Mark validated' }));
    await screen.findByText('2 transactions marked validated');
    expect(bulkCalls()[0]).toEqual({ ids: ['a', 'b'], update: { is_validated: true } });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText('Undone');
    // Only "a" was unvalidated before; "b" already was validated.
    expect(bulkCalls().slice(1)).toEqual([
      { ids: ['a'], update: { is_validated: false } },
      { ids: ['b'], update: { is_validated: true } },
    ]);
  });

  it('filters to not-validated rows', async () => {
    renderPage();
    await screen.findByText('SALARY');
    fireEvent.click(screen.getByRole('button', { name: 'Not validated' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/transactions?status=unvalidated', { scroll: false }));
  });

  it('validates everything matching the filters after a confirm, with Undo', async () => {
    toValidateCount = 12;
    search = new URLSearchParams('status=unvalidated');
    renderPage();
    const summary = await screen.findByTestId('transactions-summary');
    await waitFor(() => expect(summary.textContent).toContain('12 not validated'));
    expect(calls.some((c) => c.url === '/api/transactions/validate-matching?status=unvalidated')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Validate all 12' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('every transaction matching the current filters');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Validate all' }));

    await screen.findByText('12 transactions marked validated');
    const post = calls.find((c) => c.url.startsWith('/api/transactions/validate-matching') && c.init?.method === 'POST');
    expect(post?.url).toBe('/api/transactions/validate-matching?status=unvalidated');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText('Undone');
    expect(bulkCalls()).toEqual([{ ids: Array.from({ length: 12 }, (_, i) => `v-${i}`), update: { is_validated: false } }]);
  });

  it('flags and moves rows through the bulk API', async () => {
    renderPage();
    await screen.findByText('SALARY');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select SALARY' }));
    let bar = screen.getByRole('region', { name: 'Bulk actions' });
    // SALARY is already flagged, so the action clears it.
    fireEvent.click(within(bar).getByRole('button', { name: 'Clear flag' }));
    await screen.findByText('Flag cleared on 1 transaction');
    expect(bulkCalls()[0]).toEqual({ ids: ['c'], update: { needs_review: false } });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select SALARY' }));
    bar = screen.getByRole('region', { name: 'Bulk actions' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Move to account' }));
    fireEvent.click(within(bar).getByRole('menuitem', { name: 'Joint' }));
    await screen.findByText('1 transaction moved to Joint');
    expect(bulkCalls()[1]).toEqual({ ids: ['c'], update: { account_id: 'acc-2' } });
  });

  it('shows an error toast when a bulk action fails', async () => {
    bulkFails = true;
    renderPage();
    await screen.findByText('SALARY');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select SALARY' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark validated' }));
    expect(await screen.findByText('Bulk exploded')).toBeInTheDocument();
  });

  it('opens the side panel on row click', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('SALARY'));
    const dialog = await screen.findByRole('dialog', { name: 'Transaction' });
    expect(within(dialog).getAllByText('+£100.00')[0]).toHaveClass('text-3xl', 'text-in');
  });
});
