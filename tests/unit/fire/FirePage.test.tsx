import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import fixtures from '../../../scripts/ui-harness/fixtures/fire.json';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/fire',
  useSearchParams: () => search,
}));

import { FirePageContent } from '@/components/fire/FirePageContent';
import { ErnTakeaways } from '@/components/fire/ern/ErnTakeaways';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let takeawaysStatus = 200;
const fx = fixtures as Record<string, unknown>;

function respond(url: string, init?: RequestInit) {
  calls.push({ url, init });
  const path = url.split('?')[0];
  if (path === '/api/fire/takeaways' && takeawaysStatus !== 200) {
    return Promise.resolve({ ok: false, status: takeawaysStatus, json: () => Promise.resolve({ error: 'AI takeaways are not configured (ANTHROPIC_API_KEY missing)' }) });
  }
  if (path === '/api/fire/inputs' && init?.method === 'PUT') {
    const body = JSON.parse(String(init.body));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ inputs: { ...body, id: 'fire-inputs-1', updatedAt: 'now' } }) });
  }
  const body = fx[path];
  return Promise.resolve({ ok: body !== undefined, status: body ? 200 : 404, json: () => Promise.resolve(body ?? {}) });
}

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function renderPage() {
  return render(
    <ToastProvider>
      <FirePageContent />
    </ToastProvider>
  );
}

describe('FIRE page', () => {
  beforeEach(() => {
    calls = [];
    takeawaysStatus = 200;
    search = new URLSearchParams();
    vi.clearAllMocks();
    localStorage.clear();
    mockFetch.mockImplementation(respond);
  });
  afterEach(() => cleanup());

  it('opens on ERN analysis and summarises the plan in a sentence', async () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'ERN analysis' })).toHaveAttribute('aria-selected', 'true');
    const lede = await screen.findByText(/withdrawal rate; historically that survived/);
    expect(lede.textContent).toMatch(/Retiring at 50 with a projected £1\.74m, spending £50k a year is a 2\.9% withdrawal rate/);
    expect(lede.textContent).toMatch(/100% of 40-year retirements/);
  });

  it('runs the simulation once, with the FIRE inputs and live balances', async () => {
    renderPage();
    await screen.findByText(/historically that survived/);
    const sims = calls.filter((c) => c.url === '/api/fire/simulate');
    expect(sims).toHaveLength(1);
    const cfg = JSON.parse(String(sims[0].init!.body)).config;
    expect(cfg).toMatchObject({ currentAge: 42, annualSpend: 50000, retirementAge: 50, annualSavings: 30000 });
    expect(cfg.portfolio).toBeCloseTo(1207702.18, 0);
  });

  it('writes the tab to the URL and reads it back', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(replace).toHaveBeenCalledWith('/fire?tab=settings', { scroll: false });
    cleanup();
    search = new URLSearchParams('tab=maths');
    renderPage();
    expect(screen.getByRole('tab', { name: 'Maths planning' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(/towards a/)).toBeInTheDocument();
  });

  it('edits FIRE inputs on the settings tab, including retirement spending', async () => {
    search = new URLSearchParams('tab=settings');
    renderPage();
    const spend = await screen.findByLabelText('Spending a year in retirement');
    await waitFor(() => expect(spend).toHaveValue('50,000'));
    fireEvent.change(spend, { target: { value: '45000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'PUT')).toBe(true));
    const body = JSON.parse(String(calls.find((c) => c.init?.method === 'PUT')!.init!.body));
    expect(body).toMatchObject({ annualSpend: 45000, excludePropertyFromFire: true, currentPortfolioValue: null });
  });

  it('says clearly when AI takeaways are not configured, and offers a retry', async () => {
    takeawaysStatus = 503;
    renderPage();
    expect(await screen.findByText(/Takeaways aren't available: AI takeaways are not configured/)).toBeInTheDocument();
    takeawaysStatus = 200;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Shares are expensive today')).toBeInTheDocument();
  });
});

describe('ErnTakeaways', () => {
  afterEach(() => cleanup());

  it('shows a loading state', () => {
    render(<ErnTakeaways state={{ status: 'loading' }} />);
    expect(screen.getByText('Writing takeaways…')).toBeInTheDocument();
  });

  it('shows errors with a retry', () => {
    const onRetry = vi.fn();
    render(<ErnTakeaways state={{ status: 'error', message: 'The takeaways couldn’t be generated.' }} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders nothing before a run', () => {
    const { container } = render(<ErnTakeaways state={{ status: 'idle' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
