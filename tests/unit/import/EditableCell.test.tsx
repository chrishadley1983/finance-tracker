import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EditableCell } from '@/components/import/EditableCell';

afterEach(() => {
  cleanup();
});

describe('EditableCell', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Groceries', group_name: 'Essential' },
    { id: 'cat-2', name: 'Transport', group_name: 'Essential' },
    { id: 'cat-3', name: 'Entertainment', group_name: 'Discretionary' },
  ];

  const createProps = (overrides = {}) => ({
    value: 'Test value',
    type: 'text' as const,
    isEditing: false,
    isModified: false,
    onChange: vi.fn(),
    onStartEdit: vi.fn(),
    onEndEdit: vi.fn(),
    ...overrides,
  });

  describe('Display Mode', () => {
    it('renders text value in display mode', () => {
      render(<EditableCell {...createProps()} />);
      expect(screen.getByText('Test value')).toBeInTheDocument();
    });

    it('renders placeholder when value is null', () => {
      render(<EditableCell {...createProps({ value: null, placeholder: 'Enter text' })} />);
      expect(screen.getByText('Enter text')).toBeInTheDocument();
    });

    it('renders dash when value is empty and no placeholder', () => {
      render(<EditableCell {...createProps({ value: '' })} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('shows modified indicator when isModified is true', () => {
      const { container } = render(<EditableCell {...createProps({ isModified: true })} />);
      // Check for amber background and indicator dot
      expect(container.querySelector('.bg-amber-50')).toBeInTheDocument();
      expect(container.querySelector('.bg-amber-500')).toBeInTheDocument();
    });

    it('applies strikethrough when isSkipped is true', () => {
      const { container } = render(<EditableCell {...createProps({ isSkipped: true })} />);
      expect(container.querySelector('.line-through')).toBeInTheDocument();
    });

    it('calls onStartEdit when clicked', () => {
      const onStartEdit = vi.fn();
      render(<EditableCell {...createProps({ onStartEdit })} />);
      fireEvent.click(screen.getByText('Test value'));
      expect(onStartEdit).toHaveBeenCalled();
    });

    it('does not call onStartEdit when disabled', () => {
      const onStartEdit = vi.fn();
      render(<EditableCell {...createProps({ onStartEdit, disabled: true })} />);
      const cell = screen.getByText('Test value');
      fireEvent.click(cell);
      expect(onStartEdit).not.toHaveBeenCalled();
    });
  });

  describe('Text Input Editing', () => {
    it('renders input when editing text', () => {
      render(<EditableCell {...createProps({ isEditing: true })} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('focuses input when editing starts', () => {
      render(<EditableCell {...createProps({ isEditing: true })} />);
      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('calls onChange and onEndEdit on Enter', () => {
      const onChange = vi.fn();
      const onEndEdit = vi.fn();
      render(<EditableCell {...createProps({ isEditing: true, onChange, onEndEdit })} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New value' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith('New value');
      expect(onEndEdit).toHaveBeenCalled();
    });

    it('calls onEndEdit on Escape without saving', () => {
      const onChange = vi.fn();
      const onEndEdit = vi.fn();
      render(<EditableCell {...createProps({ isEditing: true, onChange, onEndEdit })} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New value' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onChange).not.toHaveBeenCalled();
      expect(onEndEdit).toHaveBeenCalled();
    });

    it('saves value on blur', () => {
      const onChange = vi.fn();
      const onEndEdit = vi.fn();
      render(<EditableCell {...createProps({ isEditing: true, onChange, onEndEdit })} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Blurred value' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith('Blurred value');
      expect(onEndEdit).toHaveBeenCalled();
    });
  });

  describe('Number Input', () => {
    it('formats number as currency in display mode', () => {
      render(<EditableCell {...createProps({ value: 123.45, type: 'number' })} />);
      expect(screen.getByText('£123.45')).toBeInTheDocument();
    });

    it('renders number input when editing', () => {
      render(<EditableCell {...createProps({ value: 50, type: 'number', isEditing: true })} />);
      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
    });

    it('parses number value on change', () => {
      const onChange = vi.fn();
      render(<EditableCell {...createProps({ value: 50, type: 'number', isEditing: true, onChange })} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '99.99' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(99.99);
    });
  });

  describe('Date Input', () => {
    it('formats date in display mode', () => {
      render(<EditableCell {...createProps({ value: '2024-01-15', type: 'date' })} />);
      expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
    });

    it('renders date input when editing', () => {
      render(<EditableCell {...createProps({ value: '2024-01-15', type: 'date', isEditing: true })} />);
      const input = screen.getByDisplayValue('2024-01-15');
      expect(input).toHaveAttribute('type', 'date');
    });
  });

  describe('Category Dropdown', () => {
    it('shows category name in display mode', () => {
      render(<EditableCell {...createProps({
        value: 'cat-1',
        type: 'category',
        categories: mockCategories
      })} />);
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    it('shows Uncategorised when no category', () => {
      render(<EditableCell {...createProps({
        value: null,
        type: 'category',
        categories: mockCategories,
        placeholder: 'Uncategorised'
      })} />);
      expect(screen.getByText('Uncategorised')).toBeInTheDocument();
    });

    it('shows search input when editing category', () => {
      render(<EditableCell {...createProps({
        value: null,
        type: 'category',
        isEditing: true,
        categories: mockCategories
      })} />);
      expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
    });

    it('shows grouped categories in dropdown', () => {
      render(<EditableCell {...createProps({
        value: null,
        type: 'category',
        isEditing: true,
        categories: mockCategories
      })} />);

      expect(screen.getByText('Essential')).toBeInTheDocument();
      expect(screen.getByText('Discretionary')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
    });

    it('filters categories by search term', () => {
      render(<EditableCell {...createProps({
        value: null,
        type: 'category',
        isEditing: true,
        categories: mockCategories
      })} />);

      const searchInput = screen.getByPlaceholderText('Search categories...');
      fireEvent.change(searchInput, { target: { value: 'Gro' } });

      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.queryByText('Transport')).not.toBeInTheDocument();
      expect(screen.queryByText('Entertainment')).not.toBeInTheDocument();
    });

    it('calls onChange when category selected', () => {
      const onChange = vi.fn();
      render(<EditableCell {...createProps({
        value: null,
        type: 'category',
        isEditing: true,
        categories: mockCategories,
        onChange
      })} />);

      fireEvent.click(screen.getByText('Groceries'));
      expect(onChange).toHaveBeenCalledWith('cat-1');
    });
  });

  describe('Error State', () => {
    it('shows error styling when hasError is true', () => {
      const { container } = render(<EditableCell {...createProps({ hasError: true, errorMessage: 'Invalid value' })} />);
      expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
    });

    it('shows error message in title', () => {
      render(<EditableCell {...createProps({ hasError: true, errorMessage: 'Invalid value' })} />);
      expect(screen.getByTitle('Invalid value')).toBeInTheDocument();
    });
  });
});
