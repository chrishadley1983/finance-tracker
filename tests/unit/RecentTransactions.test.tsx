import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { Transaction } from '@/lib/hooks/useDashboardData';

const mockTransactions: Transaction[] = [
  {
    id: 'txn-1',
    date: '2025-01-15',
    amount: -50.00,
    description: 'Tesco Groceries',
    category: { name: 'Groceries' },
  },
  {
    id: 'txn-2',
    date: '2025-01-14',
    amount: 1500.00,
    description: 'Salary Payment',
    category: { name: 'Salary' },
  },
  {
    id: 'txn-3',
    date: '2025-01-13',
    amount: -25.50,
    description: 'Coffee Shop',
    category: null,
  },
];

describe('RecentTransactions', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the title', () => {
      render(<RecentTransactions transactions={mockTransactions} isLoading={false} />);

      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    });

    it('renders transaction list', () => {
      render(<RecentTransactions transactions={mockTransactions} isLoading={false} />);

      expect(screen.getByText('Tesco Groceries')).toBeInTheDocument();
      expect(screen.getByText('Salary Payment')).toBeInTheDocument();
      expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
    });

    it('renders correct number of transactions', () => {
      const { container } = render(
        <RecentTransactions transactions={mockTransactions} isLoading={false} />
      );

      // Each transaction has a key, so there should be 3 transaction items
      const descriptions = screen.getAllByText(/Tesco|Salary|Coffee/);
      expect(descriptions.length).toBe(3);
    });
  });

  describe('date formatting', () => {
    it('formats dates as day month (e.g., 15 Jan)', () => {
      render(<RecentTransactions transactions={mockTransactions} isLoading={false} />);

      // Date should be formatted as "15 Jan"
      expect(screen.getByText('15 Jan')).toBeInTheDocument();
      expect(screen.getByText('14 Jan')).toBeInTheDocument();
      expect(screen.getByText('13 Jan')).toBeInTheDocument();
    });
  });

  describe('amount formatting', () => {
    it('formats amounts as GBP currency', () => {
      render(<RecentTransactions transactions={mockTransactions} isLoading={false} />);

      expect(screen.getByText('-£50.00')).toBeInTheDocument();
      expect(screen.getByText('£1,500.00')).toBeInTheDocument();
      expect(screen.getByText('-£25.50')).toBeInTheDocument();
    });

    it('shows positive amounts in green', () => {
      const { container } = render(
        <RecentTransactions transactions={mockTransactions} isLoading={false} />
      );

      const greenAmounts = container.querySelectorAll('.text-green-400');
      expect(greenAmounts.length).toBeGreaterThan(0);
    });

    it('shows negative amounts in red', () => {
      const { container } = render(
        <RecentTransactions transactions={mockTransactions} isLoading={false} />
      );

      const redAmounts = container.querySelectorAll('.text-red-400');
      expect(redAmounts.length).toBeGreaterThan(0);
    });
  });

  describe('loading state', () => {
    it('shows skeleton rows when loading', () => {
      const { container } = render(
        <RecentTransactions transactions={[]} isLoading={true} />
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(5);
    });

    it('does not show transactions when loading', () => {
      render(<RecentTransactions transactions={mockTransactions} isLoading={true} />);

      expect(screen.queryByText('Tesco Groceries')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no transactions', () => {
      render(<RecentTransactions transactions={[]} isLoading={false} />);

      expect(screen.getByText('No transactions found')).toBeInTheDocument();
    });
  });

  describe('link to transactions page', () => {
    it('renders View all link', () => {
      render(<RecentTransactions transactions={mockTransactions} isLoading={false} />);

      const link = screen.getByRole('link', { name: /View all/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/transactions');
    });
  });

  describe('container styling', () => {
    it('has correct background class', () => {
      const { container } = render(
        <RecentTransactions transactions={mockTransactions} isLoading={false} />
      );

      const mainContainer = container.querySelector('.bg-slate-800');
      expect(mainContainer).toBeInTheDocument();
    });
  });
});
