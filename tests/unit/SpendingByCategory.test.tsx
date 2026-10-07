import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SpendingByCategory, categoryHref } from '@/components/dashboard/SpendingByCategory';
import type { CategorySpend } from '@/lib/hooks/useDashboardData';

const data: CategorySpend[] = [
  { categoryId: 'cat-2', categoryName: 'Transport', amount: 300, percentage: 30 },
  { categoryId: 'cat-1', categoryName: 'Groceries', amount: 500, percentage: 50 },
  { categoryId: 'cat-3', categoryName: 'Entertainment', amount: 200, percentage: 20 },
  { categoryId: 'cat-4', categoryName: 'Refunds only', amount: -20, percentage: 0 },
];

describe('SpendingByCategory', () => {
  afterEach(cleanup);

  it('ranks categories by amount and drops non-spending rows', () => {
    render(<SpendingByCategory data={data} dateFrom="2026-10-01" dateTo="2026-10-31" />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Groceries'),
      expect.stringContaining('Transport'),
      expect.stringContaining('Entertainment'),
    ]);
    expect(screen.queryByText('Refunds only')).not.toBeInTheDocument();
  });

  it('links each row to that category and month in Transactions', () => {
    render(<SpendingByCategory data={data} dateFrom="2026-10-01" dateTo="2026-10-31" />);
    expect(screen.getByText('Groceries').closest('a')).toHaveAttribute(
      'href',
      '/transactions?dateFrom=2026-10-01&dateTo=2026-10-31&categoryId=cat-1'
    );
    expect(categoryHref('x', '2026-09-01', '2026-09-30')).toBe('/transactions?dateFrom=2026-09-01&dateTo=2026-09-30&categoryId=x');
  });

  it('shows the amount and share', () => {
    render(<SpendingByCategory data={data} dateFrom="2026-10-01" dateTo="2026-10-31" />);
    expect(screen.getByText('£500')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('folds long lists behind "Show all"', () => {
    render(<SpendingByCategory data={data} dateFrom="2026-10-01" dateTo="2026-10-31" initialRows={2} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    fireEvent.click(screen.getByText('Show all 3 categories'));
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('has an empty state', () => {
    render(<SpendingByCategory data={[]} dateFrom="2026-10-01" dateTo="2026-10-31" />);
    expect(screen.getByText('No spending this month yet')).toBeInTheDocument();
  });
});
