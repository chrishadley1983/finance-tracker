import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TransactionFilters } from '@/components/transactions/TransactionFilters';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockAccounts = [
  { id: 'acc-1', name: 'HSBC Current' },
  { id: 'acc-2', name: 'Savings Account' },
];

const mockCategories = [
  { id: 'cat-1', name: 'Groceries', group_name: 'Food' },
  { id: 'cat-2', name: 'Restaurants', group_name: 'Food' },
];

describe('TransactionFilters', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/accounts') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ accounts: mockAccounts }),
        });
      }
      if (url === '/api/categories') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCategories),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders search input', () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);

      expect(screen.getByPlaceholderText('Search description...')).toBeInTheDocument();
    });

    it('renders dropdown selects', async () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);

      // Wait for loading to complete
      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('renders date inputs', () => {
      const { container } = render(<TransactionFilters filters={{}} onChange={mockOnChange} />);

      const dateInputs = container.querySelectorAll('input[type="date"]');
      expect(dateInputs).toHaveLength(2);
    });
  });

  describe('filter changes', () => {
    it('calls onChange when search input changes', () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);

      const searchInput = screen.getByPlaceholderText('Search description...');
      fireEvent.change(searchInput, { target: { value: 'groceries' } });

      expect(mockOnChange).toHaveBeenCalledWith({ search: 'groceries' });
    });

    it('calls onChange when account dropdown changes', async () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'HSBC Current' })).toBeInTheDocument();
      });

      const accountSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(accountSelect, { target: { value: 'acc-1' } });

      expect(mockOnChange).toHaveBeenCalledWith({ accountId: 'acc-1' });
    });
  });

  describe('clear filters button', () => {
    it('does not show when no filters applied', () => {
      render(<TransactionFilters filters={{}} onChange={mockOnChange} />);

      expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument();
    });

    it('shows when search filter is applied', () => {
      render(
        <TransactionFilters
          filters={{ search: 'test' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    it('clears filters when clicked', () => {
      render(
        <TransactionFilters
          filters={{ search: 'test' }}
          onChange={mockOnChange}
        />
      );

      const clearButton = screen.getByText('Clear Filters');
      fireEvent.click(clearButton);

      expect(mockOnChange).toHaveBeenCalledWith({});
    });
  });

  describe('controlled values', () => {
    it('displays search value from props', () => {
      render(
        <TransactionFilters
          filters={{ search: 'existing' }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByPlaceholderText('Search description...')).toHaveValue('existing');
    });

    it('displays date values from props', () => {
      const { container } = render(
        <TransactionFilters
          filters={{ dateFrom: '2025-01-01', dateTo: '2025-01-31' }}
          onChange={mockOnChange}
        />
      );

      const dateInputs = container.querySelectorAll('input[type="date"]');
      expect(dateInputs[0]).toHaveValue('2025-01-01');
      expect(dateInputs[1]).toHaveValue('2025-01-31');
    });
  });
});
