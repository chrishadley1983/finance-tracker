import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WealthSnapshotModal } from '@/components/wealth/WealthSnapshotModal';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const snapshots = [
  { id: 's2', date: '2026-09-01', balance: 1200, notes: null },
  { id: 's1', date: '2026-08-01', balance: 1100, notes: null },
];

describe('WealthSnapshotModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ snapshots }) });
    });
  });
  afterEach(() => cleanup());

  const open = (onClose = vi.fn(), onUpdate = vi.fn()) =>
    render(<WealthSnapshotModal isOpen accountId="acc-1" accountName="Fidelity SIPP" accountType="pension" onClose={onClose} onUpdate={onUpdate} />);

  it('confirms a delete in-app (never window.confirm) and deletes on confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const onUpdate = vi.fn();
    open(vi.fn(), onUpdate);
    fireEvent.click(await screen.findByRole('button', { name: /Delete valuation on 1 Sep/ }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete this valuation?');
    fireEvent.click(screen.getByRole('button', { name: 'Delete valuation' }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/accounts/acc-1/snapshots/s2', { method: 'DELETE' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Delete valuation on 1 Sep/ })).toBeNull();
  });

  it('cancelling the confirmation keeps the valuation, and Esc closes only the confirmation', async () => {
    const onClose = vi.fn();
    open(onClose);
    fireEvent.click(await screen.findByRole('button', { name: /Delete valuation on 1 Sep/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalledWith(expect.anything(), { method: 'DELETE' });
  });
});
