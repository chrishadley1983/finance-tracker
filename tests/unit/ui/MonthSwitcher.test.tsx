import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MonthSwitcher, inMonthRange, monthKeyLabel, shiftMonthKey } from '@/components/ui/MonthSwitcher';

afterEach(cleanup);

describe('month key helpers', () => {
  it('shifts across year ends and labels months in full', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthKey('2026-10', -13)).toBe('2025-09');
    expect(monthKeyLabel('2026-10')).toBe('October 2026');
  });
  it('checks optional limits', () => {
    expect(inMonthRange('2026-10', undefined, '2026-10')).toBe(true);
    expect(inMonthRange('2026-11', undefined, '2026-10')).toBe(false);
    expect(inMonthRange('2025-12', '2026-01')).toBe(false);
  });
});

describe('MonthSwitcher', () => {
  it('shows "October 2026" and steps a month either way', () => {
    const onChange = vi.fn();
    render(<MonthSwitcher value="2026-10" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'October 2026. Choose a month' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month, September 2026' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-09');
    fireEvent.click(screen.getByRole('button', { name: 'Next month, November 2026' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11');
  });

  it('disables next past the max and previous before the min', () => {
    render(<MonthSwitcher value="2026-10" min="2026-10" max="2026-10" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /^Next month/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Next month/ }).getAttribute('aria-label')).toContain('not started yet');
    expect(screen.getByRole('button', { name: /^Previous month/ })).toBeDisabled();
  });

  it('opens a month grid from the label, not a native input', () => {
    const onChange = vi.fn();
    const { container } = render(<MonthSwitcher value="2026-10" max="2026-10" onChange={onChange} />);
    expect(container.querySelector('input, select')).toBeNull();
    const trigger = screen.getByRole('button', { name: /Choose a month/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Choose a month' });
    // The current month is selected and focused; later months are out of range.
    expect(within(dialog).getByRole('button', { name: 'October 2026' })).toHaveAttribute('aria-current', 'date');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'October 2026' }));
    expect(within(dialog).getByRole('button', { name: 'November 2026' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Next year, 2027' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Previous year, 2025' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'March 2025' }));
    expect(onChange).toHaveBeenCalledWith('2025-03');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('works from the keyboard: arrows move, Enter picks, Escape closes', () => {
    const onChange = vi.fn();
    render(<MonthSwitcher value="2026-06" onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /Choose a month/ });
    fireEvent.click(trigger);
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'July 2026' }));
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'October 2026' }));
    fireEvent.keyDown(grid, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onChange).not.toHaveBeenCalled();
  });
});
