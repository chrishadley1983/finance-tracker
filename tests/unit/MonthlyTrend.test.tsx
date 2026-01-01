import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MonthlyTrend } from '@/components/dashboard/MonthlyTrend';
import { MonthlyData } from '@/lib/hooks/useDashboardData';

const mockMonthlyData: MonthlyData[] = [
  { month: 'Oct', income: 3000, expenses: 2000 },
  { month: 'Nov', income: 3200, expenses: 2100 },
  { month: 'Dec', income: 3500, expenses: 2500 },
  { month: 'Jan', income: 3100, expenses: 1800 },
  { month: 'Feb', income: 2900, expenses: 2200 },
  { month: 'Mar', income: 3300, expenses: 1900 },
];

describe('MonthlyTrend', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the title', () => {
      render(<MonthlyTrend data={mockMonthlyData} isLoading={false} />);

      expect(screen.getByText('Monthly Trend')).toBeInTheDocument();
    });

    it('renders SVG chart', () => {
      const { container } = render(
        <MonthlyTrend data={mockMonthlyData} isLoading={false} />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders month labels in SVG', () => {
      render(<MonthlyTrend data={mockMonthlyData} isLoading={false} />);

      // Month labels are text elements in SVG
      expect(screen.getByText('Oct')).toBeInTheDocument();
      expect(screen.getByText('Nov')).toBeInTheDocument();
      expect(screen.getByText('Dec')).toBeInTheDocument();
    });
  });

  describe('income/expense bars', () => {
    it('renders income bars (green)', () => {
      const { container } = render(
        <MonthlyTrend data={mockMonthlyData} isLoading={false} />
      );

      // Income bars have fill="#4ade80" (green)
      const incomeBars = container.querySelectorAll('rect[fill="#4ade80"]');
      expect(incomeBars.length).toBe(6);
    });

    it('renders expense bars (red)', () => {
      const { container } = render(
        <MonthlyTrend data={mockMonthlyData} isLoading={false} />
      );

      // Expense bars have fill="#f87171" (red)
      const expenseBars = container.querySelectorAll('rect[fill="#f87171"]');
      expect(expenseBars.length).toBe(6);
    });
  });

  describe('legend', () => {
    it('renders income legend', () => {
      render(<MonthlyTrend data={mockMonthlyData} isLoading={false} />);

      expect(screen.getByText('Income')).toBeInTheDocument();
    });

    it('renders expenses legend', () => {
      render(<MonthlyTrend data={mockMonthlyData} isLoading={false} />);

      expect(screen.getByText('Expenses')).toBeInTheDocument();
    });

    it('renders legend color indicators', () => {
      const { container } = render(
        <MonthlyTrend data={mockMonthlyData} isLoading={false} />
      );

      const greenIndicator = container.querySelector('.bg-green-400');
      const redIndicator = container.querySelector('.bg-red-400');

      expect(greenIndicator).toBeInTheDocument();
      expect(redIndicator).toBeInTheDocument();
    });
  });

  describe('3-month totals', () => {
    it('shows totals for last 3 months', () => {
      render(<MonthlyTrend data={mockMonthlyData} isLoading={false} />);

      // Last 3 months are Jan, Feb, Mar
      // Check for formatted currency values
      expect(screen.getByText('£3,100')).toBeInTheDocument(); // Jan income
      expect(screen.getByText('£2,900')).toBeInTheDocument(); // Feb income
      expect(screen.getByText('£3,300')).toBeInTheDocument(); // Mar income
    });

    it('shows expense totals for last 3 months', () => {
      render(<MonthlyTrend data={mockMonthlyData} isLoading={false} />);

      expect(screen.getByText('£1,800')).toBeInTheDocument(); // Jan expenses
      expect(screen.getByText('£2,200')).toBeInTheDocument(); // Feb expenses
      expect(screen.getByText('£1,900')).toBeInTheDocument(); // Mar expenses
    });
  });

  describe('loading state', () => {
    it('shows skeleton chart when loading', () => {
      const { container } = render(
        <MonthlyTrend data={[]} isLoading={true} />
      );

      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });

    it('does not show SVG when loading', () => {
      const { container } = render(
        <MonthlyTrend data={mockMonthlyData} isLoading={true} />
      );

      const svg = container.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no trend data', () => {
      render(<MonthlyTrend data={[]} isLoading={false} />);

      expect(screen.getByText('No trend data available')).toBeInTheDocument();
    });
  });

  describe('container styling', () => {
    it('has correct background class', () => {
      const { container } = render(
        <MonthlyTrend data={mockMonthlyData} isLoading={false} />
      );

      const mainContainer = container.querySelector('.bg-slate-800');
      expect(mainContainer).toBeInTheDocument();
    });
  });

  describe('grid lines', () => {
    it('renders horizontal grid lines', () => {
      const { container } = render(
        <MonthlyTrend data={mockMonthlyData} isLoading={false} />
      );

      // Grid lines are dashed
      const gridLines = container.querySelectorAll('line[stroke-dasharray]');
      expect(gridLines.length).toBe(5); // 0%, 25%, 50%, 75%, 100%
    });
  });
});
