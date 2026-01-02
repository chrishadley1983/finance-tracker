import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BulkCategorise } from '@/components/import/BulkCategorise';

// Clean up after each test
afterEach(() => {
  cleanup();
});

describe('BulkCategorise', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Groceries', group_name: 'Essential' },
    { id: 'cat-2', name: 'Transport', group_name: 'Essential' },
    { id: 'cat-3', name: 'Entertainment', group_name: 'Discretionary' },
  ];

  const createProps = (overrides = {}) => ({
    selectedCount: 0,
    totalCount: 10,
    uncategorisedCount: 3,
    lowConfidenceCount: 2,
    categories: mockCategories,
    onBulkAssign: vi.fn(),
    onSelectAll: vi.fn(),
    onSelectNone: vi.fn(),
    onSelectUncategorised: vi.fn(),
    onSelectLowConfidence: vi.fn(),
    onRecategorise: vi.fn(),
    isRecategorising: false,
    ...overrides,
  });

  it('renders selection info', () => {
    render(<BulkCategorise {...createProps()} />);
    expect(screen.getByText('Select rows to bulk edit')).toBeInTheDocument();
  });

  it('shows selected count when rows are selected', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 5 })} />);
    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  it('shows Select all button', () => {
    render(<BulkCategorise {...createProps()} />);
    expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
  });

  it('shows Select none when all selected', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 10 })} />);
    expect(screen.getByRole('button', { name: /select none/i })).toBeInTheDocument();
  });

  it('shows uncategorised count button', () => {
    render(<BulkCategorise {...createProps()} />);
    expect(screen.getByRole('button', { name: /uncategorised \(3\)/i })).toBeInTheDocument();
  });

  it('shows low confidence count button', () => {
    render(<BulkCategorise {...createProps()} />);
    expect(screen.getByRole('button', { name: /low confidence \(2\)/i })).toBeInTheDocument();
  });

  it('calls onSelectAll when Select all clicked', () => {
    const onSelectAll = vi.fn();
    render(<BulkCategorise {...createProps({ onSelectAll })} />);
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    expect(onSelectAll).toHaveBeenCalled();
  });

  it('calls onSelectNone when Select none clicked', () => {
    const onSelectNone = vi.fn();
    render(<BulkCategorise {...createProps({ selectedCount: 10, onSelectNone })} />);
    fireEvent.click(screen.getByRole('button', { name: /select none/i }));
    expect(onSelectNone).toHaveBeenCalled();
  });

  it('calls onSelectUncategorised when clicked', () => {
    const onSelectUncategorised = vi.fn();
    render(<BulkCategorise {...createProps({ onSelectUncategorised })} />);
    fireEvent.click(screen.getByRole('button', { name: /uncategorised \(3\)/i }));
    expect(onSelectUncategorised).toHaveBeenCalled();
  });

  it('calls onSelectLowConfidence when clicked', () => {
    const onSelectLowConfidence = vi.fn();
    render(<BulkCategorise {...createProps({ onSelectLowConfidence })} />);
    fireEvent.click(screen.getByRole('button', { name: /low confidence \(2\)/i }));
    expect(onSelectLowConfidence).toHaveBeenCalled();
  });

  it('disables bulk assign when no rows selected', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 0 })} />);
    const button = screen.getByRole('button', { name: /set category to/i });
    expect(button).toBeDisabled();
  });

  it('enables bulk assign when rows are selected', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 3 })} />);
    const button = screen.getByRole('button', { name: /set category to/i });
    expect(button).not.toBeDisabled();
  });

  it('opens category dropdown when clicked', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 3 })} />);
    fireEvent.click(screen.getByRole('button', { name: /set category to/i }));

    // Should show categories
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Transport')).toBeInTheDocument();
    expect(screen.getByText('Entertainment')).toBeInTheDocument();
  });

  it('calls onBulkAssign when category selected', () => {
    const onBulkAssign = vi.fn();
    render(<BulkCategorise {...createProps({ selectedCount: 3, onBulkAssign })} />);

    fireEvent.click(screen.getByRole('button', { name: /set category to/i }));
    fireEvent.click(screen.getByText('Groceries'));

    expect(onBulkAssign).toHaveBeenCalledWith('cat-1', 'Groceries');
  });

  it('shows search input in dropdown', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 3 })} />);
    fireEvent.click(screen.getByRole('button', { name: /set category to/i }));

    expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
  });

  it('filters categories by search term', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 3 })} />);
    fireEvent.click(screen.getByRole('button', { name: /set category to/i }));

    const searchInput = screen.getByPlaceholderText('Search categories...');
    fireEvent.change(searchInput, { target: { value: 'Gro' } });

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText('Transport')).not.toBeInTheDocument();
    expect(screen.queryByText('Entertainment')).not.toBeInTheDocument();
  });

  it('shows AI re-categorise button', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 3 })} />);
    expect(screen.getByRole('button', { name: /re-categorise with ai/i })).toBeInTheDocument();
  });

  it('disables AI button when no rows selected', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 0 })} />);
    const button = screen.getByRole('button', { name: /re-categorise with ai/i });
    expect(button).toBeDisabled();
  });

  it('calls onRecategorise when AI button clicked', () => {
    const onRecategorise = vi.fn();
    render(<BulkCategorise {...createProps({ selectedCount: 3, onRecategorise })} />);

    fireEvent.click(screen.getByRole('button', { name: /re-categorise with ai/i }));
    expect(onRecategorise).toHaveBeenCalled();
  });

  it('shows loading state when recategorising', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 3, isRecategorising: true })} />);
    expect(screen.getByText('Re-categorising...')).toBeInTheDocument();
  });

  it('groups categories by group_name', () => {
    render(<BulkCategorise {...createProps({ selectedCount: 3 })} />);
    fireEvent.click(screen.getByRole('button', { name: /set category to/i }));

    expect(screen.getByText('Essential')).toBeInTheDocument();
    expect(screen.getByText('Discretionary')).toBeInTheDocument();
  });
});
