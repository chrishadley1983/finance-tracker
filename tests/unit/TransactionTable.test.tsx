import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { TransactionTable, formatAmount } from '@/components/transactions/TransactionTable';
import { TransactionWithRelations } from '@/lib/hooks/useTransactions';
import { __resetCategoriesCache } from '@/lib/hooks/useCategories';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function txn(id: string, over: Partial<TransactionWithRelations> = {}): TransactionWithRelations {
  return {
    id,
    date: '2025-01-15',
    amount: -50,
    description: `Desc ${id}`,
    account_id: 'acc-1',
    category_id: 'cat-1',
    categorisation_source: 'manual',
    hsbc_transaction_id: null,
    created_at: '2025-01-15T10:00:00Z',
    is_validated: false,
    needs_review: false,
    account: { name: 'HSBC Current' },
    category: { name: 'Groceries', group_name: 'Food' },
    ...over,
  };
}

const mockTransactions: TransactionWithRelations[] = [
  txn('txn-1', { description: 'Tesco Groceries', amount: -50 }),
  txn('txn-2', { description: 'Salary Payment', amount: 1500, is_validated: true, category_id: 'cat-2', category: { name: 'Salary', group_name: 'Income' } }),
  txn('txn-3', { date: '2025-01-13', description: 'Coffee Shop', amount: -25.5, needs_review: true, category_id: null, category: null, account: null }),
];

const rows = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('[data-row-index]'));

function Harness(props: Partial<React.ComponentProps<typeof TransactionTable>> & { initial?: Set<string> }) {
  const [selected, setSelected] = useState<Set<string>>(props.initial ?? new Set());
  return (
    <>
      <output data-testid="selected">{Array.from(selected).sort().join(',')}</output>
      <TransactionTable
        transactions={mockTransactions}
        isLoading={false}
        onSort={vi.fn()}
        sortColumn="date"
        sortDirection="desc"
        selectedIds={selected}
        onSelectionChange={setSelected}
        {...props}
      />
    </>
  );
}

describe('TransactionTable', () => {
  const defaultProps = {
    transactions: mockTransactions,
    isLoading: false,
    onSort: vi.fn(),
    sortColumn: 'date',
    sortDirection: 'desc' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    __resetCategoriesCache();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the sortable column headers', () => {
      render(<TransactionTable {...defaultProps} />);
      for (const label of ['Date', 'Description', 'Account', 'Category', 'Amount']) {
        expect(screen.getByRole('button', { name: `Sort by ${label}` })).toBeInTheDocument();
      }
    });

    it('renders one row per transaction', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);
      expect(rows(container)).toHaveLength(3);
    });

    it('groups rows under day headings with the day net', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);
      const headings = container.querySelectorAll('[data-day-heading]');
      expect(headings).toHaveLength(2);
      expect(headings[0].textContent).toContain('Wed 15 January 2025');
      expect(headings[0].textContent).toContain('+£1,450.00');
      expect(headings[1].textContent).toContain('Mon 13 January 2025');
      expect(headings[1].textContent).toContain('-£25.50');
    });

    it('does not group when sorted by another column', () => {
      const { container } = render(<TransactionTable {...defaultProps} sortColumn="amount" />);
      expect(container.querySelectorAll('[data-day-heading]')).toHaveLength(0);
    });

    it('shows income with text-in and a leading +, spending in ink', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);
      const [spend, income] = rows(container);
      const spendCell = within(spend).getByText('-£50.00');
      const incomeCell = within(income).getByText('+£1,500.00');
      expect(spendCell).toHaveClass('fig', 'text-ink');
      expect(incomeCell).toHaveClass('fig', 'text-in');
      expect(formatAmount(0)).toBe('£0.00');
    });

    it('marks rows needing review', () => {
      const { container } = render(<TransactionTable {...defaultProps} />);
      expect(within(rows(container)[2]).getByText('Review')).toBeInTheDocument();
    });

    it('hides the account column and shows balances in running-balance mode', () => {
      const withBalance = mockTransactions.map((t, i) => ({ ...t, running_balance: 100 + i }));
      render(<TransactionTable {...defaultProps} transactions={withBalance} showRunningBalance hideAccountColumn />);
      expect(screen.queryByRole('button', { name: 'Sort by Account' })).not.toBeInTheDocument();
      expect(screen.getByText('Balance')).toBeInTheDocument();
      expect(screen.getByText('£101.00')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('calls onSort when a header is clicked', () => {
      const onSort = vi.fn();
      render(<TransactionTable {...defaultProps} onSort={onSort} />);
      fireEvent.click(screen.getByRole('button', { name: 'Sort by Date' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sort by Amount' }));
      expect(onSort).toHaveBeenNthCalledWith(1, 'date');
      expect(onSort).toHaveBeenNthCalledWith(2, 'amount');
    });
  });

  describe('loading and empty states', () => {
    it('shows skeleton rows when loading', () => {
      const { container } = render(<TransactionTable {...defaultProps} transactions={[]} isLoading />);
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(5);
    });

    it('shows an empty message when there are no transactions', () => {
      render(<TransactionTable {...defaultProps} transactions={[]} />);
      expect(screen.getByText('No transactions found')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('toggles a single row', () => {
      render(<Harness />);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coffee Shop' }));
      expect(screen.getByTestId('selected').textContent).toBe('txn-3');
    });

    it('shift-click selects the range from the last clicked row', () => {
      render(<Harness />);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Tesco Groceries' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coffee Shop' }), { shiftKey: true });
      expect(screen.getByTestId('selected').textContent).toBe('txn-1,txn-2,txn-3');
    });

    it('shift-click on a selected row deselects the range', () => {
      render(<Harness initial={new Set(['txn-1', 'txn-2', 'txn-3'])} />);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coffee Shop' }));
      // Rows 2..3 are deselected; row 1 stays.
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Salary Payment' }), { shiftKey: true });
      expect(screen.getByTestId('selected').textContent).toBe('txn-1');
    });

    it('header checkbox selects and clears the page', () => {
      render(<Harness />);
      const header = screen.getByRole('checkbox', { name: 'Select all on this page' });
      fireEvent.click(header);
      expect(screen.getByTestId('selected').textContent).toBe('txn-1,txn-2,txn-3');
      fireEvent.click(header);
      expect(screen.getByTestId('selected').textContent).toBe('');
    });

    it('marks selected rows with bg-sel', () => {
      const { container } = render(<Harness initial={new Set(['txn-2'])} />);
      expect(rows(container)[1]).toHaveClass('bg-sel');
      expect(rows(container)[0]).not.toHaveClass('bg-sel');
    });
  });

  describe('opening a row', () => {
    it('row click opens the panel, but clicks on controls do not', () => {
      const onOpen = vi.fn();
      const onValidate = vi.fn();
      const { container } = render(<Harness onOpen={onOpen} onValidate={onValidate} />);
      fireEvent.click(within(rows(container)[0]).getByText('Tesco Groceries'));
      expect(onOpen).toHaveBeenCalledWith(mockTransactions[0]);

      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Salary Payment' }));
      fireEvent.click(within(rows(container)[1]).getByRole('button', { name: 'Mark as unvalidated' }));
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onValidate).toHaveBeenCalledWith(mockTransactions[1]);
    });
  });

  describe('keyboard', () => {
    it('J/K move focus, X toggles, Enter opens, Escape clears', () => {
      const onOpen = vi.fn();
      const { container } = render(<Harness onOpen={onOpen} />);
      const r = rows(container);

      fireEvent.keyDown(document.body, { key: 'j' });
      expect(r[0]).toHaveFocus();
      fireEvent.keyDown(r[0], { key: 'j' });
      expect(r[1]).toHaveFocus();
      fireEvent.keyDown(r[1], { key: 'j' });
      fireEvent.keyDown(r[2], { key: 'j' }); // clamps at the end
      expect(r[2]).toHaveFocus();
      fireEvent.keyDown(r[2], { key: 'k' });
      expect(r[1]).toHaveFocus();

      fireEvent.keyDown(r[1], { key: 'x' });
      expect(screen.getByTestId('selected').textContent).toBe('txn-2');

      fireEvent.keyDown(r[1], { key: 'Enter' });
      expect(onOpen).toHaveBeenCalledWith(mockTransactions[1]);

      fireEvent.keyDown(r[1], { key: 'Escape' });
      expect(screen.getByTestId('selected').textContent).toBe('');
    });

    it('ignores keys while typing in an input', () => {
      const { container } = render(
        <>
          <input aria-label="elsewhere" />
          <Harness />
        </>
      );
      fireEvent.keyDown(screen.getByLabelText('elsewhere'), { key: 'j' });
      expect(rows(container)[0]).not.toHaveFocus();
    });

    it('ignores keys when disabled (panel or dialog open)', () => {
      const { container } = render(<Harness keyboardEnabled={false} />);
      fireEvent.keyDown(document.body, { key: 'j' });
      expect(rows(container)[0]).not.toHaveFocus();
    });
  });

  describe('inline description edit', () => {
    it('edits the description from the pencil button', async () => {
      const onInlineUpdate = vi.fn().mockResolvedValue(undefined);
      render(<Harness onInlineUpdate={onInlineUpdate} />);
      fireEvent.click(screen.getByRole('button', { name: 'Edit description of Coffee Shop' }));
      const input = screen.getByRole('textbox', { name: 'Description' });
      fireEvent.change(input, { target: { value: 'Coffee' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onInlineUpdate).toHaveBeenCalledWith('txn-3', 'description', 'Coffee');
    });
  });
});
