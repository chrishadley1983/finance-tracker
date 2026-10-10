import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TransactionFilters } from '@/components/transactions/TransactionFilters';
import { __resetAccountsCache } from '@/lib/hooks/useAccounts';
import { __resetCategoriesCache } from '@/lib/hooks/useCategories';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockAccounts = [
  { id: 'acc-1', name: 'HSBC Current', type: 'current' },
  { id: 'acc-2', name: 'Savings Account', type: 'savings' },
  { id: 'acc-3', name: 'Pension', type: 'pension' },
];

const mockCategories = [
  { id: 'cat-1', name: 'Groceries', group_name: 'Food', group_id: null },
  { id: 'cat-2', name: 'Restaurants', group_name: 'Food', group_id: null },
];

describe('TransactionFilters', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    __resetAccountsCache();
    __resetCategoriesCache();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/accounts') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ accounts: mockAccounts }) });
      }
      if (url === '/api/categories') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCategories) });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the search box without binding "/"', () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      const search = screen.getByRole('searchbox', { name: 'Search transactions' });
      expect(search).toBeInTheDocument();
      fireEvent.keyDown(document.body, { key: '/' });
      expect(search).not.toHaveFocus();
    });

    it('renders Date, Account, Category and Status chips', async () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      expect(screen.getByRole('button', { name: /Date/ })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Account' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
      const status = screen.getByRole('group', { name: 'Status' });
      expect(status.textContent).toContain('All');
      expect(status.textContent).toContain('Needs category');
      expect(status.textContent).toContain('Needs review');
      expect(status.textContent).toContain('Validated');
    });

    it('only lists accounts that can hold transactions', async () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'HSBC Current' })).toBeInTheDocument());
      expect(screen.queryByRole('option', { name: 'Pension' })).not.toBeInTheDocument();
    });
  });

  describe('filter changes', () => {
    it('calls onChange when search input changes', () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search transactions' }), { target: { value: 'groceries' } });
      expect(mockOnChange).toHaveBeenCalledWith({ search: 'groceries' });
    });

    it('calls onChange when the account chip changes', async () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'HSBC Current' })).toBeInTheDocument());
      fireEvent.change(screen.getByRole('combobox', { name: 'Account' }), { target: { value: 'acc-1' } });
      expect(mockOnChange).toHaveBeenCalledWith({ accountId: 'acc-1' });
    });

    it('calls onChange when the category chip changes', async () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument());
      fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'cat-1' } });
      expect(mockOnChange).toHaveBeenCalledWith({ categoryId: 'cat-1' });
    });

    it('sets and clears the status filter', () => {
      const { rerender } = render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Needs category' }));
      expect(mockOnChange).toHaveBeenLastCalledWith({ status: 'uncategorised', validated: undefined });
      fireEvent.click(screen.getByRole('button', { name: 'Needs review' }));
      expect(mockOnChange).toHaveBeenLastCalledWith({ status: 'needs_review', validated: undefined });

      rerender(<TransactionFilters filters={{ status: 'validated' }} onChange={mockOnChange} />);
      expect(screen.getByRole('button', { name: 'Validated' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      expect(mockOnChange).toHaveBeenLastCalledWith({ status: undefined, validated: undefined });
    });

    it('applies a date preset and custom dates', () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      fireEvent.click(screen.getByRole('button', { name: /Date/ }));
      fireEvent.click(screen.getByRole('button', { name: 'This year' }));
      const year = new Date().getFullYear();
      expect(mockOnChange).toHaveBeenLastCalledWith({ dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` });

      fireEvent.click(screen.getByRole('button', { name: /Date/ }));
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-01-01' } });
      expect(mockOnChange).toHaveBeenLastCalledWith({ dateFrom: '2025-01-01', dateTo: undefined });
    });
  });

  describe('clear filters button', () => {
    it('does not show when no filters applied', () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    });

    it('shows for a status filter and clears everything', () => {
      render(<TransactionFilters filters={{ status: 'needs_review', search: 'x' }} onChange={mockOnChange} />);
      fireEvent.click(screen.getByText('Clear filters'));
      expect(mockOnChange).toHaveBeenCalledWith({});
    });
  });

  describe('controlled values', () => {
    it('displays search value from props', () => {
      render(<TransactionFilters filters={{ search: 'existing' }} onChange={mockOnChange} />);
      expect(screen.getByRole('searchbox', { name: 'Search transactions' })).toHaveValue('existing');
    });

    it('labels the date chip with the active range', () => {
      render(<TransactionFilters filters={{ dateFrom: '2025-01-01', dateTo: '2025-01-31' }} onChange={mockOnChange} />);
      expect(screen.getByRole('button', { name: /1 Jan 2025 – 31 Jan 2025/ })).toBeInTheDocument();
    });
  });
});
