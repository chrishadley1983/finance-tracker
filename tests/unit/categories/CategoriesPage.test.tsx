import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { __resetCategoriesCache } from '@/lib/hooks/useCategories';
import fixture from '../../../scripts/ui-harness/fixtures/categories.json';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/categories',
  useSearchParams: () => search,
}));

import { CategoriesPageContent } from '@/components/categories/CategoriesPageContent';
import { filterRules, type CategoryMapping } from '@/components/categories/RulesPanel';

const cats = fixture['/api/categories'];
const rules = fixture['/api/categories/rules'].rules as CategoryMapping[];
const groceries = cats.find((c) => c.name === 'Groceries')!;
const homeGroup = fixture['/api/category-groups'].find((g) => g.name === 'Home')!;
const tesco = rules.find((r) => r.pattern === 'TESCO STORES')!;

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let groupDeleteStatus = 204;
const mockFetch = vi.fn();
global.fetch = mockFetch;
const json = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  calls = [];
  groupDeleteStatus = 204;
  search = new URLSearchParams();
  vi.clearAllMocks();
  __resetCategoriesCache();
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith('/api/categories?') || url === '/api/categories') return json(cats);
    if (url === '/api/category-groups') return json(fixture['/api/category-groups']);
    if (url === '/api/categories/rules') return json({ rules });
    if (url.startsWith('/api/category-groups/') && init?.method === 'DELETE') {
      return groupDeleteStatus === 204
        ? json(null, true, 204)
        : json({ error: 'Cannot delete group with categories', message: 'This group contains 5 categories. Move or delete them first.' }, false, 409);
    }
    if (url === `/api/categories/rules/${tesco.id}/apply` && !init?.method) {
      return json({ eligible: 3, uncategorised: 2, inReview: 1, applicable: true, rule: { category_name: 'Groceries' }, sample: [{ id: 't1', date: '2026-10-01', description: 'TESCO STORES 2231', amount: -42.1 }] });
    }
    if (url === `/api/categories/rules/${tesco.id}/apply` && init?.method === 'POST') return json({ applied: 3, categoryName: 'Groceries' });
    return json({}, false, 500);
  });
});
afterEach(() => cleanup());

const renderPage = () =>
  render(
    <ToastProvider>
      <CategoriesPageContent />
    </ToastProvider>
  );

describe('filterRules', () => {
  it('filters by category and searches patterns and notes', () => {
    expect(filterRules(rules, null, '')).toHaveLength(rules.length);
    expect(filterRules(rules, groceries.id, '').map((r) => r.pattern)).toEqual(['TESCO STORES', 'SAINSBURYS', 'ALDI', 'OCADO', 'WAITROSE']);
    expect(filterRules(rules, groceries.id, 'tesco').map((r) => r.pattern)).toEqual(['TESCO STORES']);
    expect(filterRules(rules, null, 'weekly shop').map((r) => r.pattern)).toEqual(['OCADO']);
  });
});

describe('Categories page', () => {
  it('shows all rules, and only the selected category’s rules when one is chosen', async () => {
    const { rerender } = renderPage();
    const list = await screen.findByRole('list', { name: 'Rules' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(rules.length);

    fireEvent.click(screen.getByRole('button', { name: /^Groceries/ }));
    expect(replace).toHaveBeenCalledWith(`/categories?category=${groceries.id}`, { scroll: false });

    search = new URLSearchParams(`category=${groceries.id}`);
    rerender(
      <ToastProvider>
        <CategoriesPageContent />
      </ToastProvider>
    );
    expect(screen.getByRole('heading', { name: /Rules for Groceries/ })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Rules' })).getAllByRole('listitem')).toHaveLength(5);
  });

  it('searches rule patterns from the URL', async () => {
    search = new URLSearchParams('q=netflix');
    renderPage();
    const list = await screen.findByRole('list', { name: 'Rules' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('NETFLIX.COM')).toBeInTheDocument();
  });

  it('deletes a group after an in-app confirm, and shows a refusal as an error toast', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    groupDeleteStatus = 409;
    renderPage();
    await screen.findByRole('list', { name: 'Rules' });
    fireEvent.click(screen.getByLabelText('Actions for group Home'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete group' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    expect(await screen.findByText('This group contains 5 categories. Move or delete them first.')).toBeInTheDocument();
    expect(calls.some((c) => c.url === `/api/category-groups/${homeGroup.id}` && c.init?.method === 'DELETE')).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('applies a rule to existing transactions after showing how many would change', async () => {
    renderPage();
    await screen.findByRole('list', { name: 'Rules' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply TESCO STORES to existing transactions' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apply rule to existing transactions' });
    await within(dialog).findByText('TESCO STORES 2231');
    expect(dialog.textContent).toContain('3 transactions would move to Groceries (2 uncategorised, 1 waiting for review)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Categorise 3 transactions' }));
    expect(await screen.findByText('Categorised 3 transactions as Groceries')).toBeInTheDocument();
    expect(calls.some((c) => c.url === `/api/categories/rules/${tesco.id}/apply` && c.init?.method === 'POST')).toBe(true);
  });

  it('deletes a rule through an in-app confirm', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.startsWith('/api/categories?')) return json(cats);
      if (url === '/api/category-groups') return json(fixture['/api/category-groups']);
      if (url === '/api/categories/rules') return json({ rules });
      if (url === `/api/categories/rules/${tesco.id}` && init?.method === 'DELETE') return json({ success: true });
      return json({}, false, 500);
    });
    renderPage();
    await screen.findByRole('list', { name: 'Rules' });
    fireEvent.click(screen.getByLabelText('Actions for rule TESCO STORES'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete rule' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete rule' }));
    expect(await screen.findByText('Deleted rule TESCO STORES')).toBeInTheDocument();
  });
});
