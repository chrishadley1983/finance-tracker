/**
 * New navigation shell (option D): labelled rail, live column with figures
 * from /api/nav-summary, pins, ⌘K palette and G-key shortcuts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

const push = vi.fn();
let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...rest }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

import { AppLayout } from '@/components/layout/AppLayout';
import { activeItem, activeSection } from '@/components/layout/nav-config';

const summary = {
  asOf: '2026-10-07',
  review: { total: 23, uncategorised: 14, withSuggestion: 17 },
  transactions: { thisMonth: 48 },
  budget: { spent: 2148, planned: 3400, usedPct: 63 },
  subscriptions: { monthly: 486, next: { name: 'Netflix', date: '2026-10-12', amount: 12.99 } },
  sync: { lastSyncAt: new Date(Date.now() - 2 * 3600_000).toISOString(), accounts: ['HSBC'] },
};

const fetchMock = vi.fn(async (url: string) => {
  if (url.startsWith('/api/nav-summary')) return new Response(JSON.stringify(summary));
  if (url.startsWith('/api/nav-pins')) return new Response(JSON.stringify({ pins: [{ id: 'p1', href: '/reports', label: 'September report' }] }));
  return new Response(JSON.stringify({ data: [] }));
});

describe('AppLayout', () => {
  beforeEach(() => {
    pathname = '/';
    push.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the page title and content', () => {
    render(
      <AppLayout title="Overview">
        <div data-testid="child">Hello</div>
      </AppLayout>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('shows live figures from the summary in the column', async () => {
    render(<AppLayout title="Overview">x</AppLayout>);
    const column = screen.getAllByRole('heading', { name: 'Day to day' })[0].parentElement!;
    await waitFor(() => expect(within(column).getByText('23')).toBeInTheDocument());
    expect(within(column).getByText('17 have a suggestion')).toBeInTheDocument();
    expect(within(column).getByText('48')).toBeInTheDocument();
    expect(screen.getByText('September report')).toBeInTheDocument();
    expect(screen.getByText('Synced 2h ago')).toBeInTheDocument();
  });

  it('switches the column when a rail section is chosen', async () => {
    render(<AppLayout title="Overview">x</AppLayout>);
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Planning' }).length).toBeGreaterThan(0));
    expect(screen.getAllByText('63%').length).toBeGreaterThan(0);
  });

  it('opens the command palette with Ctrl+K and jumps to a page', async () => {
    render(<AppLayout title="Overview">x</AppLayout>);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByPlaceholderText('Search pages, actions or transactions…');
    fireEvent.change(input, { target: { value: 'budg' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/budgets');
  });

  it('G then T goes to transactions', () => {
    render(<AppLayout title="Overview">x</AppLayout>);
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 't' });
    expect(push).toHaveBeenCalledWith('/transactions');
  });

  it('marks sub-pages against their parent item', () => {
    expect(activeItem('/settings/bank-sync')?.label).toBe('Bank sync');
    expect(activeItem('/settings')?.label).toBe('Settings');
    expect(activeSection('/fire')).toBe('wealth');
    expect(activeSection('/pets')).toBe('day');
  });
});
