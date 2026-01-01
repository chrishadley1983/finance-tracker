import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { TransactionPagination } from '@/components/transactions/TransactionPagination';

describe('TransactionPagination', () => {
  const defaultProps = {
    page: 1,
    pageSize: 25,
    total: 100,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders page info text', () => {
      const { container } = render(<TransactionPagination {...defaultProps} />);

      expect(container.textContent).toContain('Showing');
    });

    it('renders Previous button', () => {
      const { container } = render(<TransactionPagination {...defaultProps} />);

      const prevBtn = container.querySelector('button[aria-label="Previous page"]');
      expect(prevBtn).toBeInTheDocument();
    });

    it('renders Next button', () => {
      const { container } = render(<TransactionPagination {...defaultProps} />);

      const nextBtn = container.querySelector('button[aria-label="Next page"]');
      expect(nextBtn).toBeInTheDocument();
    });

    it('renders page size dropdown', () => {
      const { container } = render(<TransactionPagination {...defaultProps} />);

      const select = container.querySelector('select');
      expect(select).toBeInTheDocument();
    });
  });

  describe('page info calculation', () => {
    it('shows "No transactions" when total is 0', () => {
      render(<TransactionPagination {...defaultProps} total={0} />);

      expect(screen.getByText('No transactions')).toBeInTheDocument();
    });
  });

  describe('Previous button', () => {
    it('is disabled on first page', () => {
      const { container } = render(<TransactionPagination {...defaultProps} page={1} />);

      const prevBtn = container.querySelector('button[aria-label="Previous page"]');
      expect(prevBtn).toBeDisabled();
    });

    it('is enabled on page 2 or higher', () => {
      const { container } = render(<TransactionPagination {...defaultProps} page={2} />);

      const prevBtn = container.querySelector('button[aria-label="Previous page"]');
      expect(prevBtn).not.toBeDisabled();
    });

    it('calls onPageChange with previous page when clicked', () => {
      const onPageChange = vi.fn();
      const { container } = render(<TransactionPagination {...defaultProps} page={3} onPageChange={onPageChange} />);

      const prevBtn = container.querySelector('button[aria-label="Previous page"]');
      fireEvent.click(prevBtn!);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Next button', () => {
    it('is disabled on last page', () => {
      const { container } = render(<TransactionPagination {...defaultProps} page={4} pageSize={25} total={100} />);

      const nextBtn = container.querySelector('button[aria-label="Next page"]');
      expect(nextBtn).toBeDisabled();
    });

    it('is enabled when not on last page', () => {
      const { container } = render(<TransactionPagination {...defaultProps} page={1} />);

      const nextBtn = container.querySelector('button[aria-label="Next page"]');
      expect(nextBtn).not.toBeDisabled();
    });

    it('calls onPageChange with next page when clicked', () => {
      const onPageChange = vi.fn();
      const { container } = render(<TransactionPagination {...defaultProps} page={2} onPageChange={onPageChange} />);

      const nextBtn = container.querySelector('button[aria-label="Next page"]');
      fireEvent.click(nextBtn!);

      expect(onPageChange).toHaveBeenCalledWith(3);
    });
  });

  describe('page size dropdown', () => {
    it('displays all page size options', () => {
      const { container } = render(<TransactionPagination {...defaultProps} />);

      const select = container.querySelector('select');
      expect(select).toBeInTheDocument();
      const options = select?.querySelectorAll('option');
      expect(options?.length).toBe(4);
    });

    it('shows current page size as selected', () => {
      const { container } = render(<TransactionPagination {...defaultProps} pageSize={50} />);

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('50');
    });

    it('calls onPageSizeChange when selection changes', () => {
      const onPageSizeChange = vi.fn();
      const { container } = render(<TransactionPagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

      const select = container.querySelector('select');
      fireEvent.change(select!, { target: { value: '50' } });

      expect(onPageSizeChange).toHaveBeenCalledWith(50);
    });
  });

  describe('edge cases', () => {
    it('handles single page of results', () => {
      const { container } = render(<TransactionPagination {...defaultProps} page={1} pageSize={25} total={10} />);

      const prevBtn = container.querySelector('button[aria-label="Previous page"]');
      const nextBtn = container.querySelector('button[aria-label="Next page"]');
      expect(prevBtn).toBeDisabled();
      expect(nextBtn).toBeDisabled();
    });
  });
});
