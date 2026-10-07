import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Header } from '@/components/layout/Header';

describe('Header', () => {
  afterEach(cleanup);

  it('shows the page title as the heading', () => {
    render(<Header title="Budgets" onSearch={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Budgets' })).toBeInTheDocument();
  });

  it('opens search from the search button', () => {
    const onSearch = vi.fn();
    render(<Header title="Budgets" onSearch={onSearch} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search or jump' }));
    expect(onSearch).toHaveBeenCalledOnce();
  });
});
