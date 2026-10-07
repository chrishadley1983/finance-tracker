import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import fixtures from '../../../scripts/ui-harness/fixtures/wealth.json';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/wealth',
  useSearchParams: () => search,
}));

import { WealthPageContent } from '@/components/wealth/WealthPageContent';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
const fx = fixtures as Record<string, unknown>;

function respond(url: string, init?: RequestInit) {
  calls.push({ url, init });
  const path = url.split('?')[0];
  const body = fx[path];
  if (path === '/api/wealth-snapshots/bulk') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
  return Promise.resolve({ ok: body !== undefined, status: body ? 200 : 404, json: () => Promise.resolve(body ?? {}) });
}

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function renderPage() {
  return render(
    <ToastProvider>
      <WealthPageContent />
    </ToastProvider>
  );
}

describe('Net worth page', () => {
  beforeEach(() => {
    calls = [];
    search = new URLSearchParams();
    vi.clearAllMocks();
    mockFetch.mockImplementation(respond);
  });
  afterEach(() => cleanup());

  it('opens on the overview with net worth as the headline and its change in a sentence', async () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('£1,752,702')).toBeInTheDocument();
    expect(screen.getByText(/since last month/)).toBeInTheDocument();
    expect(screen.getByText(/since January/)).toBeInTheDocument();
  });

  it('ranks account types and shows Coast FIRE with a link to edit inputs on the FIRE page (no settings form)', async () => {
    renderPage();
    expect(await screen.findByText('Pensions')).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Edit on the FIRE page' });
    expect(link).toHaveAttribute('href', '/fire?tab=settings');
    expect(screen.queryByRole('button', { name: /save settings/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull();
  });

  it('writes the tab to the URL', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(replace).toHaveBeenCalledWith('/wealth?tab=history', { scroll: false });
  });

  it('reads the tab and month from the URL', async () => {
    search = new URLSearchParams('tab=balances&month=2026-09');
    renderPage();
    expect(screen.getByRole('tab', { name: 'Monthly balances' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(calls.some((c) => c.url.includes('start_date=2026-09-01'))).toBe(true));
    expect(calls.some((c) => c.url.includes('start_date=2026-08-01'))).toBe(true);
    expect(screen.getByRole('button', { name: /^September 2026\. Choose a month/ })).toBeInTheDocument();
  });

  it('puts a month change in the URL', async () => {
    search = new URLSearchParams('tab=balances&month=2026-09');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^Previous month/ }));
    expect(replace).toHaveBeenCalledWith('/wealth?tab=balances&month=2026-08', { scroll: false });
  });

  it('shows the month total and the change on last month, and saves only changed rows', async () => {
    search = new URLSearchParams('tab=balances&month=2026-10');
    renderPage();
    const panel = screen.getByRole('tabpanel', { name: 'Monthly balances' });
    await within(panel).findByText(/add up to/);
    expect(within(panel).getByText(/on September/)).toBeInTheDocument();
    // October has 3 saved balances; the other 5 are carried over from September and get saved too.
    const save = within(panel).getByRole('button', { name: 'Save 5 balances' });
    fireEvent.click(save);
    await waitFor(() => expect(calls.some((c) => c.url === '/api/wealth-snapshots/bulk')).toBe(true));
    const body = JSON.parse(String(calls.find((c) => c.url === '/api/wealth-snapshots/bulk')!.init!.body));
    expect(body.date).toBe('2026-10-01');
    expect(body.entries).toHaveLength(5);
  });

  it('keeps an opened tab mounted when switching away', async () => {
    search = new URLSearchParams('tab=history');
    const view = renderPage();
    await screen.findByText(/months recorded/);
    search = new URLSearchParams('');
    view.rerender(
      <ToastProvider>
        <WealthPageContent />
      </ToastProvider>
    );
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    const history = document.getElementById('wealth-panel-history')!;
    expect(history).not.toBeVisible();
    expect(within(history).getByText(/months recorded/)).toBeInTheDocument();
  });
});
