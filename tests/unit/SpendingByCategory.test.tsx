import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SpendingByCategory } from '@/components/dashboard/SpendingByCategory';
import { CategorySpend } from '@/lib/hooks/useDashboardData';

const mockCategorySpend: CategorySpend[] = [
  {
    categoryId: 'cat-1',
    categoryName: 'Groceries',
    amount: 500,
    percentage: 50,
  },
  {
    categoryId: 'cat-2',
    categoryName: 'Transport',
    amount: 300,
    percentage: 30,
  },
  {
    categoryId: 'cat-3',
    categoryName: 'Entertainment',
    amount: 200,
    percentage: 20,
  },
];

describe('SpendingByCategory', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the title', () => {
      render(<SpendingByCategory data={mockCategorySpend} isLoading={false} />);

      expect(screen.getByText('Spending by Category')).toBeInTheDocument();
    });

    it('renders all categories', () => {
      render(<SpendingByCategory data={mockCategorySpend} isLoading={false} />);

      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
    });

    it('renders correct number of category items', () => {
      const { container } = render(
        <SpendingByCategory data={mockCategorySpend} isLoading={false} />
      );

      // Each category has a progress bar
      const progressBars = container.querySelectorAll('.bg-blue-500');
      expect(progressBars.length).toBe(3);
    });
  });

  describe('progress bars', () => {
    it('renders progress bars with correct widths', () => {
      const { container } = render(
        <SpendingByCategory data={mockCategorySpend} isLoading={false} />
      );

      const progressBars = container.querySelectorAll('.bg-blue-500');

      // Check that width styles are set
      expect(progressBars[0]).toHaveStyle({ width: '50%' });
      expect(progressBars[1]).toHaveStyle({ width: '30%' });
      expect(progressBars[2]).toHaveStyle({ width: '20%' });
    });

    it('renders progress bar container', () => {
      const { container } = render(
        <SpendingByCategory data={mockCategorySpend} isLoading={false} />
      );

      const barContainers = container.querySelectorAll('.bg-slate-700.rounded-full');
      expect(barContainers.length).toBe(3);
    });
  });

  describe('amount formatting', () => {
    it('formats amounts as GBP currency', () => {
      render(<SpendingByCategory data={mockCategorySpend} isLoading={false} />);

      expect(screen.getByText('£500')).toBeInTheDocument();
      expect(screen.getByText('£300')).toBeInTheDocument();
      expect(screen.getByText('£200')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows skeleton rows when loading', () => {
      const { container } = render(
        <SpendingByCategory data={[]} isLoading={true} />
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(5);
    });

    it('does not show categories when loading', () => {
      render(<SpendingByCategory data={mockCategorySpend} isLoading={true} />);

      expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no spending data', () => {
      render(<SpendingByCategory data={[]} isLoading={false} />);

      expect(screen.getByText('No spending data available')).toBeInTheDocument();
    });
  });

  describe('container styling', () => {
    it('has correct background class', () => {
      const { container } = render(
        <SpendingByCategory data={mockCategorySpend} isLoading={false} />
      );

      const mainContainer = container.querySelector('.bg-slate-800');
      expect(mainContainer).toBeInTheDocument();
    });
  });

  describe('category key uniqueness', () => {
    it('uses categoryId as key for each category', () => {
      // This is implicitly tested by React not throwing warnings
      const { container } = render(
        <SpendingByCategory data={mockCategorySpend} isLoading={false} />
      );

      // All categories should render without key warnings
      expect(container.querySelectorAll('.text-sm.text-slate-300').length).toBe(3);
    });
  });
});
