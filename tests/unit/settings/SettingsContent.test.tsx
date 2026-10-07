import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { summarise, syncedAgo, syncedWhen, linkState, type StatusAccount } from '@/components/bank-sync/status';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsContent } from '@/components/settings/SettingsContent';

const stats = {
  counts: { transactions: 6848, accounts: 18, categories: 55, rules: 214, budgets: 372, snapshots: 732, subscriptions: 23 },
  transactions: { first: '2015-01-02', last: '2026-10-06' },
  about: { version: '1.0.0', commit: 'a1b2c3d', environment: 'production' },
};
const acct = (over: Partial<StatusAccount>): StatusAccount => ({
  id: 'a',
  name: 'Joint',
  type: 'current',
  linked: true,
  syncEnabled: true,
  lastSyncAt: '2026-10-07T09:00:00Z',
  provider: 'HSBC',
  connectionActive: true,
  needsReconsent: false,
  ...over,
});
const status = {
  configured: true,
  accounts: [acct({ id: 'a' }), acct({ id: 'b', needsReconsent: true, connectionActive: false }), acct({ id: 'c', linked: false, lastSyncAt: null })],
};

const mockFetch = vi.fn();
global.fetch = mockFetch;

function serve(over: Record<string, { ok: boolean; body: unknown }> = {}) {
  mockFetch.mockImplementation(async (url: string) => {
    const hit = over[url];
    if (hit) return { ok: hit.ok, json: async () => hit.body };
    if (url === '/api/settings/stats') return { ok: true, json: async () => stats };
    if (url === '/api/truelayer/status') return { ok: true, json: async () => status };
    return { ok: false, json: async () => ({}) };
  });
}

describe('SettingsContent', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows real counts from /api/settings/stats, not hard-coded numbers', async () => {
    serve();
    render(<SettingsContent />);
    expect(await screen.findByText('Category rules')).toBeInTheDocument();
    expect(screen.getByText('214')).toBeInTheDocument();
    expect(screen.getByText('732')).toBeInTheDocument();
    expect(screen.getByText(/Your data covers/)).toHaveTextContent('6,848 transactions across 18 accounts, Jan 2015 to Oct 2026');
    expect(mockFetch).toHaveBeenCalledWith('/api/settings/stats');
  });

  it('builds the CSV download link from the chosen dates', async () => {
    serve();
    render(<SettingsContent />);
    const link = await screen.findByRole('link', { name: /download transactions csv/i });
    expect(link).toHaveAttribute('href', '/api/export/transactions.csv');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-03-31' } });
    expect(screen.getByRole('link', { name: /download transactions csv/i })).toHaveAttribute(
      'href',
      '/api/export/transactions.csv?from=2026-01-01&to=2026-03-31'
    );
    expect(screen.getByRole('link', { name: /download all data/i })).toHaveAttribute('href', '/api/export/all.json');
  });

  it('blocks a reversed date range', async () => {
    serve();
    render(<SettingsContent />);
    fireEvent.change(await screen.findByLabelText('From'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-04-01' } });
    expect(screen.getByText('The start date is after the end date.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download transactions csv/i })).toBeDisabled();
  });

  it('summarises bank connections with status chips and a reconnect prompt', async () => {
    serve();
    render(<SettingsContent />);
    expect(await screen.findByText('1 connected')).toBeInTheDocument();
    expect(screen.getByText('1 needs reconnecting')).toBeInTheDocument();
    expect(screen.getByText('1 not linked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage bank sync' })).toHaveAttribute('href', '/settings/bank-sync');
    expect(screen.getByRole('link', { name: 'Reconnect' })).toHaveAttribute('href', '/settings/bank-sync');
  });

  it('shows an error with a retry when the counts fail', async () => {
    serve({ '/api/settings/stats': { ok: false, body: { error: 'Failed to load data counts' } } });
    render(<SettingsContent />);
    expect(await screen.findByText(/Failed to load data counts/)).toBeInTheDocument();
    serve();
    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]);
    await waitFor(() => expect(screen.getByText('214')).toBeInTheDocument());
  });
});

describe('bank status helpers', () => {
  const now = new Date('2026-10-07T12:00:00Z');

  it('labels each account', () => {
    expect(linkState(acct({}))).toBe('connected');
    expect(linkState(acct({ needsReconsent: true }))).toBe('reconnect');
    expect(linkState(acct({ linked: false }))).toBe('unlinked');
  });

  it('describes sync times for sentences', () => {
    expect(syncedAgo('2026-10-07T09:00:00Z', now)).toBe('3 hours ago');
    expect(syncedWhen('2026-10-06T09:00:00Z', now)).toBe('yesterday');
    expect(syncedWhen('2026-09-28T09:00:00Z', now)).toMatch(/^on 28 Sep/);
    expect(syncedWhen(null, now)).toBe('never');
  });

  it('summarises linked, reconnect and most recent sync', () => {
    expect(summarise(status.accounts)).toEqual({ linked: 2, reconnect: 1, unlinked: 1, lastSyncAt: '2026-10-07T09:00:00Z' });
  });
});
