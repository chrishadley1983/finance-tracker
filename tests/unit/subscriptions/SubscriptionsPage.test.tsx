import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import fixture from '../../../scripts/ui-harness/fixtures/subscriptions.json';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/subscriptions',
  useSearchParams: () => search,
}));

import { SubscriptionsPageContent, UNTRACKED_PREVIEW } from '@/components/subscriptions/SubscriptionsPageContent';

type Data = (typeof fixture)['/api/subscriptions'];
let data: Data;
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
const mockFetch = vi.fn();
global.fetch = mockFetch;
const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

beforeEach(() => {
  calls = [];
  search = new URLSearchParams();
  vi.clearAllMocks();
  data = JSON.parse(JSON.stringify(fixture['/api/subscriptions']));
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === '/api/subscriptions') return json(data);
    if (url.startsWith('/api/subscriptions/')) return json({});
    return json({}, false);
  });
});
afterEach(() => cleanup());

const renderPage = () =>
  render(
    <ToastProvider>
      <SubscriptionsPageContent />
    </ToastProvider>
  );

const patches = (id: string) =>
  calls.filter((c) => c.url === `/api/subscriptions/${id}` && c.init?.method === 'PATCH').map((c) => JSON.parse(String(c.init!.body)));

describe('Subscriptions page', () => {
  it('opens with the monthly total, the price change and untracked count', async () => {
    renderPage();
    const lede = await screen.findByText((_, el) => el?.tagName === 'P' && /a month across/.test(el.textContent ?? ''));
    expect(lede.textContent).toBe('£486 a month across 23 active subscriptions. Netflix goes up £2 on 12 Oct; 2 look untracked.');
  });

  it('accepting a new price offers Undo that restores the old amount', async () => {
    renderPage();
    const netflix = data.subscriptions.find((s) => s.name === 'Netflix')!;
    fireEvent.click(await screen.findByRole('button', { name: /Use £14.99/ }));
    await screen.findByText('Netflix now recorded at £14.99');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(patches(netflix.id)).toEqual([{ amount: 14.99 }, { amount: 12.99 }]));
  });

  it('marking cancelled offers Undo that restores the previous status', async () => {
    renderPage();
    const headspace = data.subscriptions.find((s) => s.name === 'Headspace')!;
    fireEvent.click(await screen.findByRole('button', { name: 'Mark cancelled' }));
    await screen.findByText('Marked Headspace cancelled');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(patches(headspace.id)).toEqual([{ status: 'cancelled' }, { status: 'active' }]));
  });

  it('shows a failed update as an error toast', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === '/api/subscriptions') return json(data);
      return json({ error: 'Database unavailable' }, false);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark cancelled' }));
    expect(await screen.findByText('Database unavailable. Try again.')).toBeInTheDocument();
  });

  it('shows 15 untracked charges, then all of them on request', async () => {
    data.untracked = Array.from({ length: 20 }, (_, i) => ({
      key: `thing ${i}`,
      description: `REPEATING THING ${i}`,
      occurrences: 4,
      average_amount: 3 + i,
      first_seen: '2026-05-01',
      last_seen: '2026-09-01',
    }));
    renderPage();
    await screen.findByText('REPEATING THING 0');
    expect(screen.queryByText(`REPEATING THING ${UNTRACKED_PREVIEW}`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 20' }));
    expect(screen.getByText('REPEATING THING 19')).toBeInTheDocument();
  });

  it('keeps the status and scope filters in the URL', async () => {
    search = new URLSearchParams('status=cancelled');
    renderPage();
    const group = await screen.findByRole('group', { name: 'Status' });
    expect(within(group).getByRole('button', { name: /Cancelled/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Now TV')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Scope' })).getByRole('button', { name: 'Business' }));
    expect(replace).toHaveBeenCalledWith('/subscriptions?status=cancelled&scope=business', { scroll: false });
  });
});
