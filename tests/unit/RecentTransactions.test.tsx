import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import type { Transaction } from '@/lib/hooks/useDashboardData';

const rows: Transaction[] = [
  { id: 't1', date: '2026-10-07', amount: -38.6, description: 'TESCO STORES', category: { name: 'Groceries' } },
  { id: 't2', date: '2026-10-05', amount: 120, description: 'VINTED REFUND', category: null },
];

describe('RecentTransactions', () => {
  afterEach(cleanup);

  it('lists transactions with date, category and pence amounts', () => {
    render(<RecentTransactions transactions={rows} />);
    expect(screen.getByText('TESCO STORES')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('7 Oct')).toBeInTheDocument();
    expect(screen.getByText('£38.60')).toBeInTheDocument();
  });

  it('shows money in with a plus and the in colour', () => {
    render(<RecentTransactions transactions={rows} />);
    const amount = screen.getByText('+£120.00');
    expect(amount).toHaveClass('text-in');
  });

  it('marks transactions that need a category', () => {
    render(<RecentTransactions transactions={rows} />);
    expect(screen.getAllByText('Needs a category')).toHaveLength(1);
  });

  it('has an empty state', () => {
    render(<RecentTransactions transactions={[]} />);
    expect(screen.getByText('No transactions this month yet')).toBeInTheDocument();
  });
});
