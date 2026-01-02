import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BulkEditToolbar } from '@/components/import/BulkEditToolbar';

afterEach(() => {
  cleanup();
});

describe('BulkEditToolbar', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Groceries', group_name: 'Essential' },
    { id: 'cat-2', name: 'Transport', group_name: 'Essential' },
  ];

  const createProps = (overrides = {}) => ({
    selectedCount: 0,
    totalCount: 10,
    modifiedCount: 0,
    skippedCount: 0,
    categories: mockCategories,
    onSelectAll: vi.fn(),
    onSelectNone: vi.fn(),
    onBulkSetDate: vi.fn(),
    onBulkSetCategory: vi.fn(),
    onBulkAdjustAmount: vi.fn(),
    onBulkSkip: vi.fn(),
    onBulkDelete: vi.fn(),
    onBulkReset: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onResetAll: vi.fn(),
    canUndo: false,
    canRedo: false,
    ...overrides,
  });

  describe('Selection Controls', () => {
    it('shows Select all button when not all selected', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });

    it('shows Select none button when all selected', () => {
      render(<BulkEditToolbar {...createProps({ selectedCount: 10 })} />);
      expect(screen.getByRole('button', { name: /select none/i })).toBeInTheDocument();
    });

    it('shows selection count', () => {
      render(<BulkEditToolbar {...createProps({ selectedCount: 5 })} />);
      expect(screen.getByText('5 selected')).toBeInTheDocument();
    });

    it('shows "No selection" when nothing selected', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.getByText('No selection')).toBeInTheDocument();
    });

    it('calls onSelectAll when Select all clicked', () => {
      const onSelectAll = vi.fn();
      render(<BulkEditToolbar {...createProps({ onSelectAll })} />);
      fireEvent.click(screen.getByRole('button', { name: /select all/i }));
      expect(onSelectAll).toHaveBeenCalled();
    });

    it('calls onSelectNone when Select none clicked', () => {
      const onSelectNone = vi.fn();
      render(<BulkEditToolbar {...createProps({ selectedCount: 10, onSelectNone })} />);
      fireEvent.click(screen.getByRole('button', { name: /select none/i }));
      expect(onSelectNone).toHaveBeenCalled();
    });
  });

  describe('Bulk Edit Dropdowns', () => {
    it('disables Set Date when no selection', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.getByRole('button', { name: /set date/i })).toBeDisabled();
    });

    it('enables Set Date when rows selected', () => {
      render(<BulkEditToolbar {...createProps({ selectedCount: 3 })} />);
      expect(screen.getByRole('button', { name: /set date/i })).not.toBeDisabled();
    });

    it('disables Set Category when no selection', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.getByRole('button', { name: /set category/i })).toBeDisabled();
    });

    it('opens date picker when Set Date clicked', () => {
      render(<BulkEditToolbar {...createProps({ selectedCount: 3 })} />);
      fireEvent.click(screen.getByRole('button', { name: /set date/i }));
      expect(screen.getByText(/apply date to 3 rows/i)).toBeInTheDocument();
    });

    it('calls onBulkSetDate when date applied', () => {
      const onBulkSetDate = vi.fn();
      render(<BulkEditToolbar {...createProps({ selectedCount: 3, onBulkSetDate })} />);

      fireEvent.click(screen.getByRole('button', { name: /set date/i }));
      const dateInput = screen.getByDisplayValue('');
      fireEvent.change(dateInput, { target: { value: '2024-01-15' } });
      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

      expect(onBulkSetDate).toHaveBeenCalledWith('2024-01-15');
    });

    it('opens category dropdown when Set Category clicked', () => {
      render(<BulkEditToolbar {...createProps({ selectedCount: 3 })} />);
      fireEvent.click(screen.getByRole('button', { name: /set category/i }));
      expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
    });

    it('shows categories in dropdown', () => {
      render(<BulkEditToolbar {...createProps({ selectedCount: 3 })} />);
      fireEvent.click(screen.getByRole('button', { name: /set category/i }));

      expect(screen.getByText('Essential')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
    });

    it('calls onBulkSetCategory when category selected', () => {
      const onBulkSetCategory = vi.fn();
      render(<BulkEditToolbar {...createProps({ selectedCount: 3, onBulkSetCategory })} />);

      fireEvent.click(screen.getByRole('button', { name: /set category/i }));
      fireEvent.click(screen.getByText('Groceries'));

      expect(onBulkSetCategory).toHaveBeenCalledWith('cat-1', 'Groceries');
    });

    it('opens amount adjustment when Adjust Amount clicked', () => {
      render(<BulkEditToolbar {...createProps({ selectedCount: 3 })} />);
      fireEvent.click(screen.getByRole('button', { name: /adjust amount/i }));
      expect(screen.getByText(/adjust amounts for 3 rows/i)).toBeInTheDocument();
    });

    it('calls onBulkAdjustAmount with add type', () => {
      const onBulkAdjustAmount = vi.fn();
      render(<BulkEditToolbar {...createProps({ selectedCount: 3, onBulkAdjustAmount })} />);

      fireEvent.click(screen.getByRole('button', { name: /adjust amount/i }));

      // The select should be visible
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'add' } });

      const numberInput = screen.getByRole('spinbutton');
      fireEvent.change(numberInput, { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

      expect(onBulkAdjustAmount).toHaveBeenCalledWith({ type: 'add', value: 10 });
    });
  });

  describe('Row Actions', () => {
    it('disables Skip when no selection', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.getByRole('button', { name: /^skip$/i })).toBeDisabled();
    });

    it('enables Skip when rows selected', () => {
      render(<BulkEditToolbar {...createProps({ selectedCount: 3 })} />);
      expect(screen.getByRole('button', { name: /^skip$/i })).not.toBeDisabled();
    });

    it('calls onBulkSkip when Skip clicked', () => {
      const onBulkSkip = vi.fn();
      render(<BulkEditToolbar {...createProps({ selectedCount: 3, onBulkSkip })} />);
      fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
      expect(onBulkSkip).toHaveBeenCalled();
    });

    it('calls onBulkDelete when Delete clicked', () => {
      const onBulkDelete = vi.fn();
      render(<BulkEditToolbar {...createProps({ selectedCount: 3, onBulkDelete })} />);
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
      expect(onBulkDelete).toHaveBeenCalled();
    });

    it('calls onBulkReset when Reset clicked', () => {
      const onBulkReset = vi.fn();
      render(<BulkEditToolbar {...createProps({ selectedCount: 3, onBulkReset })} />);
      fireEvent.click(screen.getByRole('button', { name: /^reset$/i }));
      expect(onBulkReset).toHaveBeenCalled();
    });
  });

  describe('Undo/Redo', () => {
    it('disables Undo when canUndo is false', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.getByTitle(/undo/i)).toBeDisabled();
    });

    it('enables Undo when canUndo is true', () => {
      render(<BulkEditToolbar {...createProps({ canUndo: true })} />);
      expect(screen.getByTitle(/undo/i)).not.toBeDisabled();
    });

    it('disables Redo when canRedo is false', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.getByTitle(/redo/i)).toBeDisabled();
    });

    it('enables Redo when canRedo is true', () => {
      render(<BulkEditToolbar {...createProps({ canRedo: true })} />);
      expect(screen.getByTitle(/redo/i)).not.toBeDisabled();
    });

    it('calls onUndo when Undo clicked', () => {
      const onUndo = vi.fn();
      render(<BulkEditToolbar {...createProps({ canUndo: true, onUndo })} />);
      fireEvent.click(screen.getByTitle(/undo/i));
      expect(onUndo).toHaveBeenCalled();
    });

    it('calls onRedo when Redo clicked', () => {
      const onRedo = vi.fn();
      render(<BulkEditToolbar {...createProps({ canRedo: true, onRedo })} />);
      fireEvent.click(screen.getByTitle(/redo/i));
      expect(onRedo).toHaveBeenCalled();
    });
  });

  describe('Reset All', () => {
    it('disables Reset All when nothing modified', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.getByRole('button', { name: /reset all/i })).toBeDisabled();
    });

    it('enables Reset All when rows modified', () => {
      render(<BulkEditToolbar {...createProps({ modifiedCount: 3 })} />);
      expect(screen.getByRole('button', { name: /reset all/i })).not.toBeDisabled();
    });

    it('enables Reset All when rows skipped', () => {
      render(<BulkEditToolbar {...createProps({ skippedCount: 2 })} />);
      expect(screen.getByRole('button', { name: /reset all/i })).not.toBeDisabled();
    });

    it('calls onResetAll when Reset All clicked', () => {
      const onResetAll = vi.fn();
      render(<BulkEditToolbar {...createProps({ modifiedCount: 3, onResetAll })} />);
      fireEvent.click(screen.getByRole('button', { name: /reset all/i }));
      expect(onResetAll).toHaveBeenCalled();
    });
  });

  describe('Status Indicators', () => {
    it('shows modified count when rows modified', () => {
      render(<BulkEditToolbar {...createProps({ modifiedCount: 5 })} />);
      expect(screen.getByText('5 modified')).toBeInTheDocument();
    });

    it('shows skipped count when rows skipped', () => {
      render(<BulkEditToolbar {...createProps({ skippedCount: 3 })} />);
      expect(screen.getByText('3 skipped')).toBeInTheDocument();
    });

    it('does not show indicators when nothing modified or skipped', () => {
      render(<BulkEditToolbar {...createProps()} />);
      expect(screen.queryByText(/modified/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument();
    });
  });
});
