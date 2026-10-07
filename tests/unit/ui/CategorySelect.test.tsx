import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CategorySelect } from '@/components/ui/CategorySelect';
import type { CategoryWithGroup } from '@/lib/hooks/useCategories';
import { __resetCategoriesCache } from '@/lib/hooks/useCategories';

function cat(id: string, name: string, group: string): CategoryWithGroup {
  return {
    id,
    name,
    group_name: 'legacy',
    group_id: `g-${group}`,
    is_income: false,
    display_order: 0,
    exclude_from_totals: false,
    colour: null,
    created_at: '2025-01-01T00:00:00Z',
    category_groups: { id: `g-${group}`, name: group, colour: null },
  };
}

const categories = [
  cat('c1', 'Groceries', 'Food'),
  cat('c2', 'Restaurants', 'Food'),
  cat('c3', 'Fuel', 'Transport'),
  cat('c4', 'Train', 'Transport'),
];

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CategorySelect', () => {
  beforeEach(() => {
    __resetCategoriesCache();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(categories) });
  });

  afterEach(() => cleanup());

  function open() {
    fireEvent.click(screen.getByRole('button', { name: /category/i }));
    return screen.getByRole('combobox');
  }

  it('renders options grouped by category group', () => {
    render(<CategorySelect value={null} onChange={vi.fn()} categories={categories} />);
    open();

    const groups = screen.getAllByRole('group');
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveAccessibleName('Food');
    expect(groups[1]).toHaveAccessibleName('Transport');
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('filters by category name and by group name', () => {
    render(<CategorySelect value={null} onChange={vi.fn()} categories={categories} />);
    const input = open();

    fireEvent.change(input, { target: { value: 'gro' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Groceries']);

    fireEvent.change(input, { target: { value: 'transport' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Fuel', 'Train']);

    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No categories found')).toBeInTheDocument();
  });

  it('selects with ArrowDown and Enter, tracking aria-activedescendant', () => {
    const onChange = vi.fn();
    render(<CategorySelect value={null} onChange={onChange} categories={categories} />);
    const input = open();

    const options = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c2', categories[1]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('type-to-filter then Enter picks the first match', () => {
    const onChange = vi.fn();
    render(<CategorySelect value={null} onChange={onChange} categories={categories} />);
    const input = open();

    fireEvent.change(input, { target: { value: 'tra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // "tra" matches the Transport group -> Fuel is first
    expect(onChange).toHaveBeenCalledWith('c3', categories[2]);
  });

  it('typing on the closed trigger opens the list with that query', () => {
    render(<CategorySelect value={null} onChange={vi.fn()} categories={categories} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /category/i }), { key: 'f' });

    expect(screen.getByRole('combobox')).toHaveValue('f');
  });

  it('Escape closes and returns focus to the trigger', () => {
    render(<CategorySelect value={null} onChange={vi.fn()} categories={categories} />);
    const input = open();
    expect(input).toHaveFocus();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /category/i })).toHaveFocus();
  });

  it('closes on outside click without selecting', () => {
    const onChange = vi.fn();
    render(
      <div>
        <p>outside</p>
        <CategorySelect value={null} onChange={onChange} categories={categories} />
      </div>
    );
    open();
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects on click and shows the selected name in the field', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CategorySelect value={null} onChange={onChange} categories={categories} />);
    open();
    fireEvent.click(screen.getByRole('option', { name: 'Fuel' }));
    expect(onChange).toHaveBeenCalledWith('c3', categories[2]);

    rerender(<CategorySelect value="c3" onChange={onChange} categories={categories} />);
    expect(screen.getByRole('button', { name: 'Category: Fuel' })).toBeInTheDocument();
  });

  it('allowClear offers a "No category" option that clears', () => {
    const onChange = vi.fn();
    render(<CategorySelect value="c1" onChange={onChange} categories={categories} allowClear />);
    open();
    fireEvent.click(screen.getByRole('option', { name: /no category/i }));
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('loads categories from the shared hook when none are passed', async () => {
    render(<CategorySelect value={null} onChange={vi.fn()} />);
    open();
    expect(await screen.findByRole('option', { name: 'Train' })).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/categories');
  });

  it('button variant renders the label and opens the list', () => {
    render(
      <CategorySelect
        variant="button"
        buttonLabel="Categorise"
        ariaLabel="Categorise selected"
        value={null}
        onChange={vi.fn()}
        categories={categories}
      />
    );
    const trigger = screen.getByRole('button', { name: 'Categorise selected' });
    expect(trigger).toHaveTextContent('Categorise');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
