import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { SummaryData } from '@/lib/hooks/useDashboardData';

const mockSummaryData: SummaryData = {
  totalBalance: 5000,
  periodIncome: 3000,
  periodExpenses: 1500,
  periodNet: 1500,
  period: 'this_month',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
};

describe('SummaryCards', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders 4 metric cards', () => {
      const { container } = render(
        <SummaryCards data={mockSummaryData} isLoading={false} />
      );

      const cards = container.querySelectorAll('.bg-slate-800');
      expect(cards.length).toBe(4);
    });

    it('renders Total Balance card', () => {
      render(<SummaryCards data={mockSummaryData} isLoading={false} />);

      expect(screen.getByText('Total Balance')).toBeInTheDocument();
    });

    it('renders Income card with period label', () => {
      render(<SummaryCards data={mockSummaryData} isLoading={false} />);

      // Period label is dynamic based on the period value
      expect(screen.getByText(/Income/)).toBeInTheDocument();
    });

    it('renders Expenses card with period label', () => {
      render(<SummaryCards data={mockSummaryData} isLoading={false} />);

      expect(screen.getByText(/Expenses/)).toBeInTheDocument();
    });

    it('renders Net card with period label', () => {
      render(<SummaryCards data={mockSummaryData} isLoading={false} />);

      expect(screen.getByText(/Net/)).toBeInTheDocument();
    });
  });

  describe('currency formatting', () => {
    it('formats total balance as GBP', () => {
      render(<SummaryCards data={mockSummaryData} isLoading={false} />);

      expect(screen.getByText('£5,000')).toBeInTheDocument();
    });

    it('formats income as GBP', () => {
      render(<SummaryCards data={mockSummaryData} isLoading={false} />);

      expect(screen.getByText('£3,000')).toBeInTheDocument();
    });

    it('formats expenses and net as GBP', () => {
      render(<SummaryCards data={mockSummaryData} isLoading={false} />);

      // Both expenses and net are £1,500 in this test data
      const values = screen.getAllByText('£1,500');
      expect(values.length).toBe(2);
    });
  });

  describe('loading state', () => {
    it('shows skeleton cards when loading', () => {
      const { container } = render(<SummaryCards data={null} isLoading={true} />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(4);
    });

    it('does not show data when loading', () => {
      render(<SummaryCards data={mockSummaryData} isLoading={true} />);

      expect(screen.queryByText('Total Balance')).not.toBeInTheDocument();
    });
  });

  describe('color coding', () => {
    it('shows income in green', () => {
      const { container } = render(
        <SummaryCards data={mockSummaryData} isLoading={false} />
      );

      const incomeCard = container.querySelectorAll('.text-green-400');
      expect(incomeCard.length).toBeGreaterThan(0);
    });

    it('shows expenses in red', () => {
      const { container } = render(
        <SummaryCards data={mockSummaryData} isLoading={false} />
      );

      const expenseCard = container.querySelectorAll('.text-red-400');
      expect(expenseCard.length).toBeGreaterThan(0);
    });

    it('shows positive net in green', () => {
      const { container } = render(
        <SummaryCards data={mockSummaryData} isLoading={false} />
      );

      // Net is positive (1500), should be green
      const greenValues = container.querySelectorAll('.text-green-400');
      expect(greenValues.length).toBeGreaterThanOrEqual(2); // Income + Net
    });

    it('shows negative net in red', () => {
      const negativeNetData: SummaryData = {
        ...mockSummaryData,
        periodNet: -500,
      };
      const { container } = render(
        <SummaryCards data={negativeNetData} isLoading={false} />
      );

      // Net is negative, should be red
      const redValues = container.querySelectorAll('.text-red-400');
      expect(redValues.length).toBeGreaterThanOrEqual(2); // Expenses + Net
    });
  });

  describe('null data handling', () => {
    it('shows zero values when data is null', () => {
      render(<SummaryCards data={null} isLoading={false} />);

      const zeroValues = screen.getAllByText('£0');
      expect(zeroValues.length).toBe(4);
    });
  });

  describe('grid layout', () => {
    it('uses grid layout with 2 columns on mobile', () => {
      const { container } = render(
        <SummaryCards data={mockSummaryData} isLoading={false} />
      );

      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-2');
    });

    it('uses grid layout with 4 columns on large screens', () => {
      const { container } = render(
        <SummaryCards data={mockSummaryData} isLoading={false} />
      );

      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('lg:grid-cols-4');
    });
  });
});
