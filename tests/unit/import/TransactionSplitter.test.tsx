import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TransactionSplitter } from '@/components/import/TransactionSplitter';
import type { ParsedTransaction } from '@/lib/types/import';

afterEach(() => {
  cleanup();
});

describe('TransactionSplitter', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Groceries', group_name: 'Essential' },
    { id: 'cat-2', name: 'Cashback', group_name: 'Income' },
    { id: 'cat-3', name: 'Transport', group_name: 'Essential' },
  ];

  const mockTransaction: ParsedTransaction = {
    rowNumber: 1,
    date: '2024-01-15',
    amount: -25.00,
    description: 'TESCO - CASHBACK',
    reference: 'ref-123',
    rawData: { original: 'data' },
  };

  const createProps = (overrides = {}) => ({
    transaction: mockTransaction,
    categories: mockCategories,
    onSplit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  });

  describe('Initial State', () => {
    it('renders the modal', () => {
      render(<TransactionSplitter {...createProps()} />);
      expect(screen.getByRole('heading', { name: 'Split Transaction' })).toBeInTheDocument();
    });

    it('shows original transaction details', () => {
      render(<TransactionSplitter {...createProps()} />);
      expect(screen.getByText('TESCO - CASHBACK')).toBeInTheDocument();
      // Multiple -£25.00 shown (original and splits total), just check one exists
      expect(screen.getAllByText('-£25.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
    });

    it('starts with one split row', () => {
      render(<TransactionSplitter {...createProps()} />);
      expect(screen.getByText('Split 1')).toBeInTheDocument();
      expect(screen.queryByText('Split 2')).not.toBeInTheDocument();
    });

    it('shows balanced status when split equals original', () => {
      render(<TransactionSplitter {...createProps()} />);
      expect(screen.getByText('Balanced')).toBeInTheDocument();
    });
  });

  describe('Adding and Removing Splits', () => {
    it('adds new split when Add another split clicked', () => {
      render(<TransactionSplitter {...createProps()} />);
      fireEvent.click(screen.getByText(/add another split/i));

      expect(screen.getByText('Split 1')).toBeInTheDocument();
      expect(screen.getByText('Split 2')).toBeInTheDocument();
    });

    it('shows Remove button on splits when more than one', () => {
      render(<TransactionSplitter {...createProps()} />);
      fireEvent.click(screen.getByText(/add another split/i));

      // Both splits should have Remove button when there are 2+
      const removeButtons = screen.getAllByText('Remove');
      expect(removeButtons.length).toBe(2);
    });

    it('removes split when Remove clicked', () => {
      render(<TransactionSplitter {...createProps()} />);
      fireEvent.click(screen.getByText(/add another split/i));

      expect(screen.getByText('Split 2')).toBeInTheDocument();

      // Get all Remove buttons and click the first one
      const removeButtons = screen.getAllByText('Remove');
      fireEvent.click(removeButtons[0]);

      expect(screen.queryByText('Split 2')).not.toBeInTheDocument();
    });

    it('does not show Remove on the only split', () => {
      render(<TransactionSplitter {...createProps()} />);
      expect(screen.queryByText('Remove')).not.toBeInTheDocument();
    });
  });

  describe('Split Editing', () => {
    it('allows editing split description', () => {
      render(<TransactionSplitter {...createProps()} />);

      const descInputs = screen.getAllByPlaceholderText('Description');
      fireEvent.change(descInputs[0], { target: { value: 'Groceries only' } });

      expect(descInputs[0]).toHaveValue('Groceries only');
    });

    it('allows editing split amount', () => {
      render(<TransactionSplitter {...createProps()} />);

      const amountInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(amountInputs[0], { target: { value: '-45' } });

      expect(amountInputs[0]).toHaveValue(-45);
    });

    it('allows selecting split category', () => {
      render(<TransactionSplitter {...createProps()} />);

      const categorySelects = screen.getAllByRole('combobox');
      fireEvent.change(categorySelects[0], { target: { value: 'cat-1' } });

      expect(categorySelects[0]).toHaveValue('cat-1');
    });
  });

  describe('Balance Validation', () => {
    it('shows unbalanced when splits do not equal original', () => {
      render(<TransactionSplitter {...createProps()} />);

      fireEvent.click(screen.getByText(/add another split/i));

      const amountInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(amountInputs[0], { target: { value: '-20' } });
      fireEvent.change(amountInputs[1], { target: { value: '-10' } });

      expect(screen.getByText(/difference/i)).toBeInTheDocument();
    });

    it('shows balanced when splits equal original', () => {
      render(<TransactionSplitter {...createProps()} />);

      fireEvent.click(screen.getByText(/add another split/i));

      const amountInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(amountInputs[0], { target: { value: '-45' } });
      fireEvent.change(amountInputs[1], { target: { value: '20' } });

      expect(screen.getByText('Balanced')).toBeInTheDocument();
    });

    it('disables Split button when unbalanced', () => {
      render(<TransactionSplitter {...createProps()} />);

      fireEvent.click(screen.getByText(/add another split/i));

      const amountInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(amountInputs[0], { target: { value: '-20' } });
      fireEvent.change(amountInputs[1], { target: { value: '-10' } });

      expect(screen.getByRole('button', { name: /split transaction/i })).toBeDisabled();
    });
  });

  describe('Distribute Evenly', () => {
    it('shows Distribute evenly button when 2+ splits', () => {
      render(<TransactionSplitter {...createProps()} />);
      fireEvent.click(screen.getByText(/add another split/i));

      expect(screen.getByText(/distribute evenly/i)).toBeInTheDocument();
    });

    it('does not show Distribute evenly with only one split', () => {
      render(<TransactionSplitter {...createProps()} />);
      expect(screen.queryByText(/distribute evenly/i)).not.toBeInTheDocument();
    });

    it('distributes amount evenly among splits', () => {
      render(<TransactionSplitter {...createProps()} />);
      fireEvent.click(screen.getByText(/add another split/i));

      fireEvent.click(screen.getByText(/distribute evenly/i));

      const amountInputs = screen.getAllByRole('spinbutton');
      // -25 split evenly is -12.5 each
      expect(parseFloat(amountInputs[0].getAttribute('value') || '0')).toBeCloseTo(-12.5, 0);
      expect(parseFloat(amountInputs[1].getAttribute('value') || '0')).toBeCloseTo(-12.5, 0);
    });
  });

  describe('Confirmation', () => {
    it('calls onCancel when Cancel clicked', () => {
      const onCancel = vi.fn();
      render(<TransactionSplitter {...createProps({ onCancel })} />);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalled();
    });

    it('calls onSplit with split transactions when confirmed', () => {
      const onSplit = vi.fn();
      render(<TransactionSplitter {...createProps({ onSplit })} />);

      fireEvent.click(screen.getByText(/add another split/i));

      // Set up balanced split: -45 + 20 = -25
      const descInputs = screen.getAllByPlaceholderText('Description');
      fireEvent.change(descInputs[0], { target: { value: 'Groceries' } });
      fireEvent.change(descInputs[1], { target: { value: 'Cashback' } });

      const amountInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(amountInputs[0], { target: { value: '-45' } });
      fireEvent.change(amountInputs[1], { target: { value: '20' } });

      fireEvent.click(screen.getByRole('button', { name: /split transaction/i }));

      expect(onSplit).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'Groceries',
            amount: -45,
            date: '2024-01-15',
          }),
          expect.objectContaining({
            description: 'Cashback',
            amount: 20,
            date: '2024-01-15',
          }),
        ])
      );
    });

    it('shows error when description is empty', () => {
      render(<TransactionSplitter {...createProps()} />);

      // Clear the description
      const descInputs = screen.getAllByPlaceholderText('Description');
      fireEvent.change(descInputs[0], { target: { value: '' } });

      fireEvent.click(screen.getByRole('button', { name: /split transaction/i }));

      expect(screen.getByText(/all splits must have a description/i)).toBeInTheDocument();
    });

    it('shows error when amount is zero', () => {
      render(<TransactionSplitter {...createProps()} />);

      fireEvent.click(screen.getByText(/add another split/i));

      const amountInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(amountInputs[0], { target: { value: '-25' } });
      fireEvent.change(amountInputs[1], { target: { value: '0' } });

      // Need to fill in description
      const descInputs = screen.getAllByPlaceholderText('Description');
      fireEvent.change(descInputs[1], { target: { value: 'Test' } });

      fireEvent.click(screen.getByRole('button', { name: /split transaction/i }));

      expect(screen.getByText(/all splits must have a non-zero amount/i)).toBeInTheDocument();
    });
  });

  describe('Reference Handling', () => {
    it('appends split index to reference', () => {
      const onSplit = vi.fn();
      render(<TransactionSplitter {...createProps({ onSplit })} />);

      fireEvent.click(screen.getByText(/add another split/i));

      const descInputs = screen.getAllByPlaceholderText('Description');
      fireEvent.change(descInputs[1], { target: { value: 'Second' } });

      const amountInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(amountInputs[0], { target: { value: '-35' } });
      fireEvent.change(amountInputs[1], { target: { value: '10' } });

      fireEvent.click(screen.getByRole('button', { name: /split transaction/i }));

      expect(onSplit).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ reference: 'ref-123-1' }),
          expect.objectContaining({ reference: 'ref-123-2' }),
        ])
      );
    });
  });
});
