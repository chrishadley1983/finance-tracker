import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { TransactionPanel, summariseMerchantHistory } from '@/components/transactions/TransactionPanel';
import { ToastProvider } from '@/components/ui/Toast';
import type { TransactionWithRelations } from '@/lib/hooks/useTransactions';
import { __resetCategoriesCache } from '@/lib/hooks/useCategories';
import { __resetAccountsCache } from '@/lib/hooks/useAccounts';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const categories = [
  { id: 'cat-1', name: 'Groceries', group_name: 'Food', group_id: null },
  { id: 'cat-2', name: 'Eating out', group_name: 'Food', group_id: null },
];

const txn: TransactionWithRelations = {
  id: 'txn-1',
  date: '2026-10-07',
  amount: -42.1,
  description: 'TESCO STORES 3297',
  account_id: 'acc-1',
  category_id: 'cat-1',
  categorisation_source: 'rule',
  hsbc_transaction_id: null,
  created_at: '2026-10-07T10:00:00Z',
  is_validated: false,
  needs_review: true,
  account: { name: 'HSBC Current' },
  category: { name: 'Groceries', group_name: 'Food' },
};

const history = [
  { id: 'txn-1', date: '2026-10-07', amount: -42.1, description: 'TESCO STORES 3297', category: { name: 'Groceries' } },
  { id: 'h-2', date: '2026-09-01', amount: -10, description: 'TESCO STORES 1111', category: { name: 'Groceries' } },
  { id: 'h-3', date: '2025-12-01', amount: -5, description: 'TESCO STORES 2222', category: { name: 'Eating out' } },
  { id: 'h-4', date: '2026-08-01', amount: -99, description: 'TESCOMOBILE BILL', category: null },
];

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];

function respond(url: string, init?: RequestInit) {
  calls.push({ url, init });
  const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });
  if (url === '/api/categories') return json(categories);
  if (url === '/api/accounts') return json({ accounts: [{ id: 'acc-1', name: 'HSBC Current', type: 'current' }] });
  if (url.startsWith('/api/transactions?')) return json({ data: history, total: history.length });
  if (url.startsWith('/api/transactions/txn-1')) return json({ id: 'txn-1' });
  if (url === '/api/transactions') return json({ id: 'new' });
  if (url === '/api/categorisation/answers') return json({ results: [{ rule: { status: 'created', pattern: 'tesco stores' } }] });
  return json({}, false);
}

function renderPanel(props: Partial<React.ComponentProps<typeof TransactionPanel>> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <TransactionPanel open transaction={txn} onClose={onClose} onSaved={onSaved} {...props} />
    </ToastProvider>
  );
  return { onSaved, onClose };
}

describe('TransactionPanel', () => {
  beforeEach(() => {
    calls = [];
    vi.clearAllMocks();
    __resetCategoriesCache();
    __resetAccountsCache();
    mockFetch.mockImplementation(respond);
  });

  afterEach(() => cleanup());

  it('shows the amount, date, account and bank text', () => {
    renderPanel();
    const dialog = screen.getByRole('dialog', { name: 'Transaction' });
    expect(within(dialog).getByText('£42.10')).toHaveClass('fig');
    expect(within(dialog).getByText(/7 Oct 2026 · HSBC Current/)).toBeInTheDocument();
    expect(within(dialog).getAllByText('TESCO STORES 3297').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Needs review')).toBeInTheDocument();
  });

  it('loads merchant history for the same merchant key only', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/recent transactions/)).toBeInTheDocument());
    const historyCall = calls.find((c) => c.url.startsWith('/api/transactions?'))!;
    expect(historyCall.url).toContain('search=tesco');
    expect(historyCall.url).toContain('limit=20');
    expect(historyCall.url).toContain('totals=0');
    // TESCOMOBILE is a different merchant key and is excluded.
    const summary = screen.getByText(/recent transactions/);
    expect(summary.textContent).toContain('3');
    expect(summary.textContent).toContain('£52.10'); // this year: -42.10 + -10
    expect(summary.textContent).toContain('usually Groceries');
  });

  it('saves only the changed fields', async () => {
    const { onSaved, onClose } = renderPanel();
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Tesco weekly shop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const put = calls.find((c) => c.init?.method === 'PUT')!;
    expect(put.url).toBe('/api/transactions/txn-1');
    expect(JSON.parse(String(put.init!.body))).toEqual({ description: 'Tesco weekly shop' });
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText('Transaction saved')).toBeInTheDocument();
  });

  it('saves a new category as a manual decision', async () => {
    const { onSaved } = renderPanel();
    await waitFor(() => expect(calls.some((c) => c.url === '/api/categories')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Category: Groceries/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Eating out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const put = calls.find((c) => c.init?.method === 'PUT')!;
    expect(JSON.parse(String(put.init!.body))).toEqual({ category_id: 'cat-2', categorisation_source: 'manual' });
  });

  it('closes without a request when nothing changed', () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClose).toHaveBeenCalled();
    expect(calls.some((c) => c.init?.method === 'PUT')).toBe(false);
  });

  it('shows an error toast when saving fails', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Database down' }) });
      }
      return respond(url, init);
    });
    const { onSaved } = renderPanel();
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Database down')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('"Always use" posts an always answer for the merchant', async () => {
    const { onSaved } = renderPanel();
    await waitFor(() => expect(calls.some((c) => c.url === '/api/categories')).toBe(true));
    const always = await screen.findByRole('button', { name: /Always use Groceries for .tesco stores./ });
    fireEvent.click(always);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = calls.find((c) => c.url === '/api/categorisation/answers')!;
    expect(JSON.parse(String(post.init!.body))).toEqual({
      answers: [{ transaction_ids: ['txn-1'], category_id: 'cat-1', always: true }],
    });
    expect(await screen.findByText(/Rule saved/)).toBeInTheDocument();
  });

  it('adds a transaction (money out is stored negative)', async () => {
    const { onSaved } = renderPanel({ transaction: null, defaultAccountId: 'acc-1' });
    expect(screen.getByRole('dialog', { name: 'Add transaction' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('option', { name: 'HSBC Current' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Amount (£)'), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Cash' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = calls.find((c) => c.url === '/api/transactions' && c.init?.method === 'POST')!;
    const body = JSON.parse(String(post.init!.body));
    expect(body).toMatchObject({ description: 'Cash', amount: -12.5, account_id: 'acc-1', categorisation_source: 'manual' });
  });

  it('validates the add form', () => {
    renderPanel({ transaction: null });
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(screen.getByText('Enter a description.')).toBeInTheDocument();
  });
});

describe('summariseMerchantHistory', () => {
  it('counts, totals this year and finds the most common category', () => {
    const s = summariseMerchantHistory(
      [
        { id: 'a', date: '2026-01-02', amount: -10, description: 'x', category: { name: 'A' } },
        { id: 'b', date: '2026-03-02', amount: -5.5, description: 'x', category: { name: 'B' } },
        { id: 'c', date: '2025-03-02', amount: -100, description: 'x', category: { name: 'B' } },
      ],
      new Date(2026, 5, 1)
    );
    expect(s).toMatchObject({ count: 3, totalThisYear: -15.5, commonCategory: 'B' });
  });
});
