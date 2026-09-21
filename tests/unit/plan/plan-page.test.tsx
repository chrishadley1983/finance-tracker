import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/plan',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// Recharts' ResponsiveContainer needs real layout; stub it in jsdom.
vi.mock('recharts', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 220 }}>{children as React.ReactElement}</div>
    ),
  };
});

import PlanPage from '@/app/plan/page';

const okJson = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));

function mockApis({ failData = false } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (failData) return Promise.reject(new Error('network down'));
    if (url.includes('/api/wealth-snapshots')) {
      return okJson({
        snapshots: [
          { date: '2026-07-01', balance: 440_000, account: { name: 'Chris II SIPP Pension', type: 'pension' } },
          { date: '2026-07-01', balance: 274_035, account: { name: 'Abby Accenture Pension', type: 'pension' } },
          { date: '2026-07-01', balance: 310_000, account: { name: 'Abby S&S ISA', type: 'isa' } },
        ],
      });
    }
    if (url.includes('/api/plan/run-rate')) {
      return okJson({ runRate: { trailing12moSpend: 71_000, vsPlanLine: 1_500, excludedTotal: 38_000 } });
    }
    if (url.includes('/api/plan/gilt-prices')) {
      return okJson({ asOf: '2026-07-30T09:00:00Z', stale: false, gilts: [] }); // page keeps fallback prices
    }
    if (url.includes('/api/plan/rungs')) {
      return url.includes('PUT') ? okJson({ rung: {} }) : okJson({ rungs: [] });
    }
    return okJson({});
  });
}

describe('/plan page (criteria U2, F2, F3, F12, P1, E2, F7)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders all four section headings (U2)', async () => {
    mockApis();
    render(<PlanPage />);
    for (const h of ['Where we are', 'The pivot', 'The ladder', 'The outlook']) {
      expect(await screen.findByRole('heading', { name: h })).toBeInTheDocument();
    }
  });

  it('shows live bucket totals and the run-rate vs plan line (F2, F3)', async () => {
    mockApis();
    render(<PlanPage />);
    await waitFor(() => expect(screen.getByText('£71,000')).toBeInTheDocument());
    expect(screen.getByText(/vs the £70,000 plan line/)).toBeInTheDocument(); // spend.planLine from plan/assumptions.json
    expect(screen.getAllByText('£274k').length).toBeGreaterThan(0); // Abby pension bucket card
  });

  it('still renders with baseline values when every data call fails (E2)', async () => {
    mockApis({ failData: true });
    render(<PlanPage />);
    expect(await screen.findByRole('heading', { name: 'Where we are' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/assumptions baseline/).length).toBeGreaterThan(0)); // pots from plan/assumptions.json when snapshots fail
    expect(screen.getByRole('heading', { name: 'The outlook' })).toBeInTheDocument();
  });

  it('pivot slider recomputes the 9-year total with no network calls (F4, F12, P1)', async () => {
    const spy = mockApis();
    render(<PlanPage />);
    await screen.findByRole('heading', { name: 'The pivot' });
    await waitFor(() => expect(screen.getByTestId('pivot-total-sacrifice')).toBeInTheDocument());
    const before = screen.getByTestId('pivot-total-sacrifice').textContent;
    const callsBefore = spy.mock.calls.length;

    fireEvent.change(screen.getByLabelText(/Target income/), { target: { value: '70000' } });
    const after = screen.getByTestId('pivot-total-sacrifice').textContent;
    expect(after).not.toBe(before);
    expect(spy.mock.calls.length).toBe(callsBefore); // pure client-side recompute
  });

  it('outlook retirement slider changes the surplus figure with no network calls (F10, F12, P1)', async () => {
    const spy = mockApis();
    render(<PlanPage />);
    await screen.findByRole('heading', { name: 'The outlook' });
    const before = screen.getByTestId('surplus-at-92').textContent;
    const callsBefore = spy.mock.calls.length;

    fireEvent.change(screen.getByLabelText(/Retire in/), { target: { value: '2032' } });
    await waitFor(() => expect(screen.getByTestId('surplus-at-92').textContent).not.toBe(before));
    expect(spy.mock.calls.length).toBe(callsBefore);
  });

  it('marking a rung bought PUTs to the rungs API (F7)', async () => {
    const spy = mockApis();
    render(<PlanPage />);
    await screen.findByRole('heading', { name: 'The ladder' });
    const btn = await screen.findByRole('button', { name: /Mark 2035 bought/ });
    fireEvent.click(btn);
    await waitFor(() => {
      const putCall = spy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
      expect(putCall).toBeTruthy();
      expect(String(putCall![0])).toContain('/api/plan/rungs');
    });
    expect(screen.getByRole('button', { name: /Mark 2035 pending/ })).toBeInTheDocument();
  });

  it('wide tables sit inside their own scroll containers (U1)', async () => {
    mockApis();
    const { container } = render(<PlanPage />);
    await screen.findByTestId('ladder-table');
    for (const id of ['pivot-table', 'ladder-table']) {
      const table = screen.getByTestId(id);
      expect(table.closest('.overflow-x-auto')).not.toBeNull();
    }
    expect(container.querySelector('[data-testid="early-retirement-chart"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="phase-funding-chart"]')).not.toBeNull();
  });
});
