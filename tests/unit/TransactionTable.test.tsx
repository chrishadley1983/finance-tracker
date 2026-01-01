import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { TransactionWithRelations } from '@/lib/hooks/useTransactions';

const mockTransactions: TransactionWithRelations[] = [
  {
    id: 'txn-1',
    date: '2025-01-15',
    amount: -50.00,
    description: 'Tesco Groceries',
    account_id: 'acc-1',
    category_id: 'cat-1',
    categorisation_source: 'manual',
    hsbc_transaction_id: null,
    created_at: '2025-01-15T10:00:00Z',
    account: { name: 'HSBC Current' },
    category: { name: 'Groceries', group_name: 'Food' },
  },
  {
    id: 'txn-2',
    date: '2025-01-14',
    amount: 1500.00,
    description: 'Salary Payment',
    account_id: 'acc-1',
    category_id: 'cat-2',
    categorisation_source: 'manual',
    hsbc_transaction_id: null,
    created_at: '2025-01-14T09:00:00Z',
    account: { name: 'HSBC Current' },
    category: { name: 'Salary', group_name: 'Income' },
  },
  {
    id: 'txn-3',
    date: '2025-01-13',
    amount: -25.50,
    description: 'Coffee Shop',
    account_id: 'acc-1',
    category_id: null,
    categorisation_source: 'import',
    hsbc_transaction_id: 'hsbc-123',
    created_at: '2025-01-13T15:30:00Z',
    account: null,
    category: null,
  },
];

describe('TransactionTable', () => {
  const defaultProps = {
    transactions: mockTransactions,
    isLoading: false,
    onSort: vi.fn(),
    sortColumn: 'date',
    sortDirection: 'desc' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering headers', () => {
    it('renders all column headers', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);

      const thead = container.querySelector('thead');
      expect(thead).toBeInTheDocument();
      expect(thead?.textContent).toContain('Date');
      expect(thead?.textContent).toContain('Description');
      expect(thead?.textContent).toContain('Account');
      expect(thead?.textContent).toContain('Category');
      expect(thead?.textContent).toContain('Amount');
    });

    it('renders thead with 5 columns', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);

      const thead = container.querySelector('thead');
      expect(thead).toBeInTheDocument();
      expect(thead?.querySelectorAll('th')).toHaveLength(5);
    });
  });

  describe('rendering data', () => {
    it('renders transaction rows in tbody', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);

      const tbody = container.querySelector('tbody');
      expect(tbody).toBeInTheDocument();
      expect(tbody?.querySelectorAll('tr')).toHaveLength(3);
    });
  });

  describe('sorting', () => {
    it('calls onSort when header is clicked', () => {
      const onSort = vi.fn();
      const { container } = render(<TransactionTable {...defaultProps} onSort={onSort} />);

      // Get the first header (Date column) within this component
      const thead = container.querySelector('thead');
      const dateHeader = thead?.querySelector('th');
      expect(dateHeader).toBeInTheDocument();
      fireEvent.click(dateHeader!);

      expect(onSort).toHaveBeenCalledWith('date');
    });

    it('has cursor-pointer class on headers', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);

      const headers = container.querySelectorAll('th');
      expect(headers).toHaveLength(5);
      headers.forEach((header) => {
        expect(header).toHaveClass('cursor-pointer');
      });
    });
  });

  describe('loading state', () => {
    it('shows skeleton rows when loading', () => {
      const { container } = render(<TransactionTable {...defaultProps} isLoading={true} />);

      const skeletonRows = container.querySelectorAll('.animate-pulse');
      expect(skeletonRows.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('empty state', () => {
    it('shows empty message when no transactions', () => {
      render(
        <TransactionTable
          {...defaultProps}
          transactions={[]}
          isLoading={false}
        />
      );

      expect(screen.getByText('No transactions found')).toBeInTheDocument();
    });
  });

  describe('row hover', () => {
    it('applies hover class to data rows', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);

      const tbody = container.querySelector('tbody');
      const rows = tbody?.querySelectorAll('tr');
      expect(rows?.length).toBe(3);
      rows?.forEach((row) => {
        expect(row).toHaveClass('hover:bg-slate-50');
      });
    });
  });
});
