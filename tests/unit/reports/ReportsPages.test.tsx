import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import type { MonthReadiness } from '@/lib/reports/readiness';
import { readinessChecklist, readinessHeadline } from '@/lib/reports/readiness-items';

const push = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/reports',
  useSearchParams: () => search,
}));

import { ReportsView } from '@/components/reports/ReportsView';
import { ReportView } from '@/components/reports/ReportView';

const NOW = new Date(2026, 9, 7, 12);

const notReady = (): MonthReadiness => ({
  year: 2026,
  month: 9,
  monthLabel: 'September 2026',
  ready: false,
  checks: [
    { key: 'wealth', ok: false, detail: 'x', missing: ['Vanguard ISA'] },
    { key: 'synced', ok: false, detail: 'Amex not synced since 2 Oct', missing: ['Amex'] },
    { key: 'categorised', ok: false, detail: '3 uncategorised or flagged', count: 3 },
    { key: 'validated', ok: true, detail: 'all validated', count: 0, byAccount: {} },
  ],
  reportExists: false,
  reportGeneratedAt: null,
  dataChangedAt: null,
  changedSinceReport: false,
  lateTransactions: 0,
  action: 'wait',
});

const ready = (): MonthReadiness => ({ ...notReady(), ready: true, action: 'generate', checks: notReady().checks.map((c) => ({ ...c, ok: true })) });

const list = [
  { year: 2026, month: 8, generated_at: '2026-09-04T07:55:00Z', report_data: { net_worth_change: -1240, savings_rate: 12.8 } },
  { year: 2026, month: 7, generated_at: '2026-08-03T09:01:00Z', report_data: { net_worth_change: 6830, savings_rate: 36.2 } },
];

type Call = { url: string; init?: RequestInit };
let calls: Call[];
let readiness: MonthReadiness;
let reports: typeof list;
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function respond(url: string, init?: RequestInit) {
  calls.push({ url, init });
  if (url === '/api/monthly-reports/list') return json(reports);
  if (url.startsWith('/api/monthly-reports/readiness')) return json(readiness);
  if (url === '/api/monthly-reports/generate') return json({ ok: true });
  if (url === '/api/monthly-reports/2026-09') {
    return json({ year: 2026, month: 9, generatedAt: '2026-10-03T08:12:00Z', reportData: { net_worth_change: 4210, savings_rate: 31.4 }, html: '<html><body>Report body</body></html>' });
  }
  return json({ error: 'No saved report' }, 404);
}

beforeEach(() => {
  calls = [];
  readiness = notReady();
  reports = list;
  search = new URLSearchParams();
  push.mockClear();
  mockFetch.mockReset();
  mockFetch.mockImplementation(respond);
});
afterEach(cleanup);

const wrap = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe('readiness checklist copy', () => {
  it('turns checks into plain lines with links to fix them', () => {
    const items = readinessChecklist(notReady());
    expect(items.map((i) => [i.text, i.href ?? null])).toEqual([
      ['September balances not entered for Vanguard ISA', '/wealth'],
      ['Amex not synced since 2 Oct', '/settings/bank-sync'],
      ['3 transactions uncategorised or flagged', '/review'],
      ['Every September transaction validated', null],
    ]);
    expect(readinessHeadline(notReady())).toBe('September 2026 has 3 of 4 checks still to do before its report is complete.');
  });
  it('counts the same lines it lists, including a late change to a saved report', () => {
    const r = { ...notReady(), reportExists: true, changedSinceReport: true, lateTransactions: 2 };
    const items = readinessChecklist(r);
    expect(items).toHaveLength(5);
    expect(items.filter((i) => !i.ok)).toHaveLength(4);
    expect(readinessHeadline(r)).toBe('September 2026 has 4 of 5 checks still to do before its report is complete.');
  });
  it('says "all" when nothing is done yet', () => {
    const r = notReady();
    r.checks[3] = { key: 'validated', ok: false, detail: '1 unvalidated', count: 1, byAccount: { HSBC: 1 } };
    expect(readinessHeadline(r)).toBe('September 2026 has all 4 checks still to do before its report is complete.');
  });
  it('links unvalidated transactions to the month on the Transactions page', () => {
    const r = notReady();
    r.checks[3] = { key: 'validated', ok: false, detail: '12 unvalidated', count: 12, byAccount: { HSBC: 8, Amex: 4 } };
    const v = readinessChecklist(r).find((i) => i.key === 'validated')!;
    expect(v.text).toBe('12 transactions not validated (HSBC 8, Amex 4)');
    expect(v.href).toBe('/transactions?dateFrom=2026-09-01&dateTo=2026-09-30');
  });
  it('mentions late changes to a saved report', () => {
    const r = { ...ready(), reportExists: true, changedSinceReport: true, lateTransactions: 2, action: 'regenerate' as const };
    expect(readinessChecklist(r).at(-1)!.text).toBe('2 transactions arrived after the saved report');
  });
});

describe('ReportsView', () => {
  it('lists saved reports as links to their own pages', async () => {
    wrap(<ReportsView now={NOW} />);
    const link = await screen.findByRole('link', { name: /August 2026/ });
    expect(link.getAttribute('href')).toBe('/reports/2026-08');
    expect(within(link).getByText('-£1,240')).toBeTruthy();
    expect(within(link).getByText('13%')).toBeTruthy();
    expect(screen.getByText(/2 saved reports/)).toBeTruthy();
  });

  it('checks the last complete month and offers "Generate anyway" when it is not ready', async () => {
    wrap(<ReportsView now={NOW} />);
    await screen.findByText('September 2026 has 3 of 4 checks still to do before its report is complete.');
    expect(screen.getByRole('list', { name: 'September 2026 checklist' }).querySelectorAll('li')).toHaveLength(4);
    expect(calls.some((c) => c.url === '/api/monthly-reports/readiness?year=2026&month=9')).toBe(true);
    expect(screen.getByRole('link', { name: 'Enter balances' }).getAttribute('href')).toBe('/wealth');
    expect(screen.getByRole('link', { name: 'Review them' }).getAttribute('href')).toBe('/review');
    fireEvent.click(screen.getByRole('button', { name: 'Generate anyway' }));
    await screen.findByText('September 2026 report saved.');
    expect(JSON.parse(String(calls.find((c) => c.url === '/api/monthly-reports/generate')!.init?.body))).toEqual({ year: 2026, month: 9, save: true });
  });

  it('uses ?month= from the URL and confirms before replacing a saved report', async () => {
    search = new URLSearchParams('month=2026-08');
    readiness = { ...ready(), month: 8, monthLabel: 'August 2026', reportExists: true, changedSinceReport: true, action: 'regenerate' };
    wrap(<ReportsView now={NOW} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate August report' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(calls.some((c) => c.url === '/api/monthly-reports/generate')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace report' }));
    await screen.findByText('August 2026 report saved.');
  });

  it('shows an empty state when there are no reports', async () => {
    reports = [];
    wrap(<ReportsView now={NOW} />);
    await screen.findByText('No saved reports');
  });
});

describe('ReportView', () => {
  it('renders the stored HTML with print and regenerate', async () => {
    wrap(<ReportView month="2026-09" />);
    const frame = (await screen.findByTitle('September 2026 report')) as HTMLIFrameElement;
    expect(frame.getAttribute('srcdoc')).toContain('Report body');
    expect(screen.getByText(/report, saved 3 Oct 2026/)).toBeTruthy();
    expect(screen.getByText(/Net worth up £4,210, 31% of income saved\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: /All reports/ }).getAttribute('href')).toBe('/reports');
    expect(screen.getByRole('button', { name: 'Print' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Replace report' }));
    await screen.findByText("September 2026 report regenerated with today's figures.");
  });

  it('says when no report is saved for the month', async () => {
    wrap(<ReportView month="2026-05" />);
    await screen.findByText('No saved report for May 2026');
    expect(screen.getByRole('button', { name: 'Generate May report' })).toBeTruthy();
  });

  it('rejects a malformed month', () => {
    wrap(<ReportView month="sept" />);
    expect(screen.getByText("That isn't a month we can show")).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
