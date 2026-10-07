/**
 * The review queue as a user drives it: grouped by merchant, keyboard accept,
 * group selection, rule creation and undo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { ToastProvider } from '@/components/ui/Toast';
import { ReviewQueue } from '@/components/review/ReviewQueue';

const GROC = 'cat-groc';
const EAT = 'cat-eat';
const base = { accountId: 'a', accountName: 'HSBC current', needsReview: true, isValidated: false, categorisationSource: 'import', engineSource: null, confidence: null, categoryId: null, categoryName: null };
const queue = [
  { ...base, id: 't1', date: '2026-10-07', description: 'TESCO STORES 2041', amount: -64.18, merchant: 'tesco stores', suggestion: { categoryId: GROC, categoryName: 'Groceries', confidence: 0.96, source: 'similar' }, reason: 'Similar past transactions suggest a category' },
  { ...base, id: 't2', date: '2026-10-04', description: 'TESCO STORES 2041', amount: -71.02, merchant: 'tesco stores', suggestion: { categoryId: GROC, categoryName: 'Groceries', confidence: 0.96, source: 'similar' }, reason: 'Similar past transactions suggest a category' },
  { ...base, id: 't3', date: '2026-10-06', description: 'DISHOOM KINGS CROSS', amount: -88.5, merchant: 'dishoom kings cross', categoryId: EAT, categoryName: 'Eating out', categorisationSource: 'ai', engineSource: 'ai', confidence: 0.6, suggestion: { categoryId: EAT, categoryName: 'Eating out', confidence: 0.6, source: 'ai' }, reason: 'AI guess, not sure' },
  { ...base, id: 't4', date: '2026-10-03', description: 'AMAZON MKTPLACE', amount: -23.99, merchant: 'amazon mktplace', suggestion: null, reason: 'No rule or past match' },
];

let calls: { url: string; body: unknown }[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  if (url.startsWith('/api/transactions/review-queue?')) {
    return new Response(JSON.stringify({ transactions: queue, stats: { total: 4, uncategorised: 3, flagged: 1 } }));
  }
  if (url.startsWith('/api/categories')) return new Response(JSON.stringify({ categories: [{ id: GROC, name: 'Groceries', group_name: 'Food' }, { id: EAT, name: 'Eating out', group_name: 'Food' }] }));
  return new Response(JSON.stringify({ results: [], restored: 1 }));
});

const renderQueue = () =>
  render(
    <ToastProvider>
      <ReviewQueue />
    </ToastProvider>
  );

describe('ReviewQueue', () => {
  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('groups by merchant and says what needs doing', async () => {
    renderQueue();
    const lede = await screen.findByText(/transactions from/);
    expect(lede.textContent).toMatch(/4 transactions from 3 merchants\. 3 already have a suggestion; 1 need you to choose\./);
    const tesco = screen.getByRole('region', { name: 'Tesco Stores' });
    expect(within(tesco).getByText(/all suggested/)).toBeInTheDocument();
    expect(screen.getByText('unsure')).toBeInTheDocument();
    expect(screen.getAllByText('Choose…')).toHaveLength(1);
  });

  it('A accepts the focused row via the answers API', async () => {
    renderQueue();
    await screen.findByText(/transactions from/);
    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() => expect(calls.some((c) => c.url === '/api/categorisation/answers')).toBe(true));
    const post = calls.find((c) => c.url === '/api/categorisation/answers')!;
    expect(post.body).toEqual({ answers: [{ category_id: GROC, transaction_ids: ['t1'] }] });
  });

  it('selecting a group and accepting sends one answer for the group, and Undo restores it', async () => {
    renderQueue();
    await screen.findByText(/transactions from/);
    fireEvent.click(screen.getByLabelText('Select all Tesco Stores'));
    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Accept/ }));
    await screen.findByText('Accepted 2');
    expect(calls.find((c) => c.url === '/api/categorisation/answers')!.body).toEqual({
      answers: [{ category_id: GROC, transaction_ids: ['t1', 't2'] }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/transactions/review-queue/restore')).toBe(true));
    const restore = calls.find((c) => c.url === '/api/transactions/review-queue/restore')!.body as { rows: { id: string; category_id: null; needs_review: boolean }[] };
    expect(restore.rows.map((r) => [r.id, r.category_id, r.needs_review])).toEqual([
      ['t1', null, true],
      ['t2', null, true],
    ]);
  });

  it('R makes a merchant rule (always) for a one-merchant selection', async () => {
    renderQueue();
    await screen.findByText(/transactions from/);
    fireEvent.click(screen.getByLabelText('Select all Tesco Stores'));
    expect(screen.getByText('Rule from this group')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'r' });
    await waitFor(() => expect(calls.some((c) => c.url === '/api/categorisation/answers')).toBe(true));
    expect(calls.find((c) => c.url === '/api/categorisation/answers')!.body).toEqual({
      answers: [{ category_id: GROC, transaction_ids: ['t1', 't2'], always: true }],
    });
  });

  it('E skips rows for this session without saving anything', async () => {
    renderQueue();
    await screen.findByText(/transactions from/);
    fireEvent.click(screen.getByLabelText('Select all Tesco Stores'));
    fireEvent.keyDown(window, { key: 'e' });
    expect(screen.queryByRole('region', { name: 'Tesco Stores' })).not.toBeInTheDocument();
    expect(screen.getByText(/skipped/).textContent).toMatch(/0 cleared, 2 skipped/);
    expect(calls.some((c) => c.url === '/api/categorisation/answers')).toBe(false);
  });

  it('ignores the letter after G (that is the app-wide jump shortcut)', async () => {
    renderQueue();
    await screen.findByText(/transactions from/);
    fireEvent.click(screen.getByLabelText('Select all Tesco Stores'));
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'r' });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.some((c) => c.url === '/api/categorisation/answers')).toBe(false);
  });
});
