import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';

const replace = vi.fn();
const push = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/accounts',
  useSearchParams: () => search,
}));
vi.mock('@/components/wealth', () => ({ WealthSnapshotModal: () => null }));

import { AccountsPageContent } from '@/components/accounts/AccountsPageContent';

const base = { provider: 'HSBC', is_archived: false, include_in_net_worth: true, transactionCount: 10, balanceSource: 'transactions', snapshotDate: null, latestTransaction: '2026-10-05', earliestTransaction: '2020-01-01' };
const accounts = [
  { ...base, id: 'c1', name: 'Joint current', type: 'current', sort_order: 0, currentBalance: 1000 },
  { ...base, id: 'c2', name: 'Monzo', type: 'current', sort_order: 1, currentBalance: 250 },
  { ...base, id: 'p1', name: 'Pension', type: 'pension', sort_order: 2, currentBalance: 50000, transactionCount: 0, balanceSource: 'snapshot', snapshotDate: '2026-09-30' },
  { ...base, id: 'old', name: 'Old account', type: 'current', sort_order: 3, currentBalance: 0, is_archived: true },
];

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let reorderFails = false;
const mockFetch = vi.fn();
global.fetch = mockFetch;

function json(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  calls = [];
  reorderFails = false;
  search = new URLSearchParams();
  vi.clearAllMocks();
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith('/api/accounts?')) return json({ accounts });
    if (url === '/api/truelayer/status') return json({ accounts: [{ id: 'c1', linked: true, syncEnabled: true, lastSyncAt: new Date().toISOString(), connectionActive: true, needsReconsent: false }] });
    if (url === '/api/accounts/reorder') return reorderFails ? json({ error: 'nope' }, false) : json({ success: true });
    if (url.startsWith('/api/accounts/')) return json({ account: {} });
    return json({}, false);
  });
});
afterEach(() => cleanup());

const renderPage = () =>
  render(
    <ToastProvider>
      <AccountsPageContent />
    </ToastProvider>
  );

describe('Accounts page', () => {
  it('opens with totals by type and hides archived accounts', async () => {
    renderPage();
    expect(await screen.findByText('Joint current')).toBeInTheDocument();
    expect(screen.getByText(/in current accounts/)).toBeInTheDocument();
    expect(screen.getByText(/in pensions/)).toBeInTheDocument();
    expect(screen.queryByText('Old account')).not.toBeInTheDocument();
    expect(screen.getByText('Bank sync')).toBeInTheDocument();
  });

  it('moves an account down within its type and saves the order', async () => {
    renderPage();
    await screen.findByText('Joint current');
    expect(screen.getByLabelText('Move Joint current up')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Move Joint current down'));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/accounts/reorder')).toBe(true));
    const body = JSON.parse(String(calls.find((c) => c.url === '/api/accounts/reorder')!.init!.body));
    expect(body.accounts).toEqual([
      { id: 'c2', sort_order: 0 },
      { id: 'c1', sort_order: 1 },
    ]);
    const names = screen.getAllByRole('link').map((a) => a.textContent);
    expect(names.indexOf('Monzo')).toBeLessThan(names.indexOf('Joint current'));
  });

  it('puts the order back and says so when saving fails', async () => {
    reorderFails = true;
    renderPage();
    await screen.findByText('Joint current');
    fireEvent.click(screen.getByLabelText('Move Joint current down'));
    expect(await screen.findByText('Could not save the new order. Try again.')).toBeInTheDocument();
    const names = screen.getAllByRole('link').map((a) => a.textContent);
    expect(names.indexOf('Joint current')).toBeLessThan(names.indexOf('Monzo'));
  });

  it('archives from the row menu with Undo', async () => {
    renderPage();
    await screen.findByText('Monzo');
    fireEvent.click(screen.getByLabelText('Actions for Monzo'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    await screen.findByText('Archived Monzo');
    const patch = calls.find((c) => c.url === '/api/accounts/c2' && c.init?.method === 'PATCH')!;
    expect(JSON.parse(String(patch.init!.body))).toEqual({ is_archived: true });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(calls.filter((c) => c.url === '/api/accounts/c2' && c.init?.method === 'PATCH').map((c) => JSON.parse(String(c.init!.body)))).toEqual([
        { is_archived: true },
        { is_archived: false },
      ])
    );
  });

  it('keeps "show archived" in the URL', async () => {
    renderPage();
    await screen.findByText('Monzo');
    fireEvent.click(screen.getByRole('checkbox', { name: /show archived/i }));
    expect(replace).toHaveBeenCalledWith('/accounts?archived=1', { scroll: false });
  });

  it('confirms in-app before deleting an account with no transactions', async () => {
    renderPage();
    await screen.findByText('Pension');
    fireEvent.click(screen.getByLabelText('Actions for Pension'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/accounts/p1' && c.init?.method === 'DELETE')).toBe(true));
  });
});
