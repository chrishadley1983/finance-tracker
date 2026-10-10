import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ToastProvider, useToast, type ToastOptions } from '@/components/ui/Toast';

function Trigger({ options }: { options: ToastOptions }) {
  const { toast } = useToast();
  return <button onClick={() => toast(options)}>show</button>;
}

function renderWith(options: ToastOptions) {
  render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>
  );
  fireEvent.click(screen.getByText('show'));
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the message in a polite live region', () => {
    renderWith({ message: 'Saved 3 transactions' });
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Saved 3 transactions');
  });

  it('auto-dismisses after 5s by default', () => {
    renderWith({ message: 'Hello' });
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.getByText('Hello')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('honours a custom duration', () => {
    renderWith({ message: 'Quick', durationMs: 1000 });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Quick')).not.toBeInTheDocument();
  });

  it('keeps error toasts until dismissed', () => {
    renderWith({ message: 'Failed to delete', tone: 'error' });
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Failed to delete')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Failed to delete')).not.toBeInTheDocument();
  });

  it('fires the action and dismisses', () => {
    const onClick = vi.fn();
    renderWith({ message: 'Deleted', action: { label: 'Undo', onClick } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Deleted')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    renderWith({ message: 'One' });
    fireEvent.click(screen.getByText('show'));
    expect(screen.getAllByText('One')).toHaveLength(2);
  });

  it('is a no-op outside a provider', () => {
    render(<Trigger options={{ message: 'nowhere' }} />);
    expect(() => fireEvent.click(screen.getByText('show'))).not.toThrow();
    expect(screen.queryByText('nowhere')).not.toBeInTheDocument();
  });
});
