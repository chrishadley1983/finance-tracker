import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { useCategories, __resetCategoriesCache } from '@/lib/hooks/useCategories';
import { useAccounts, __resetAccountsCache } from '@/lib/hooks/useAccounts';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const categories = [{ id: 'c1', name: 'Groceries', group_name: 'Food' }];

function deferredResponse(body: unknown) {
  let resolve!: () => void;
  const promise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((r) => {
    resolve = () => r({ ok: true, json: () => Promise.resolve(body) });
  });
  return { promise, resolve };
}

describe('useCategories', () => {
  beforeEach(() => {
    __resetCategoriesCache();
    __resetAccountsCache();
    mockFetch.mockReset();
  });

  afterEach(() => cleanup());

  it('de-dupes concurrent fetches across consumers', async () => {
    const pending = deferredResponse(categories);
    mockFetch.mockReturnValue(pending.promise);

    const seen: unknown[] = [];
    function Consumer({ label }: { label: string }) {
      const { data, isLoading } = useCategories();
      seen.push([label, isLoading, data]);
      return <span>{data ? `${label}:${data.length}` : `${label}:loading`}</span>;
    }

    const { findByText } = render(
      <>
        <Consumer label="a" />
        <Consumer label="b" />
        <Consumer label="c" />
      </>
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/categories');

    await act(async () => pending.resolve());

    expect(await findByText('a:1')).toBeInTheDocument();
    expect(await findByText('c:1')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('serves later mounts from the cache', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(categories) });

    const first = renderHook(() => useCategories());
    await waitFor(() => expect(first.result.current.data).toEqual(categories));

    const second = renderHook(() => useCategories());
    expect(second.result.current.data).toEqual(categories);
    expect(second.result.current.isLoading).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('refresh() re-fetches and updates every consumer', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(categories) });
    const a = renderHook(() => useCategories());
    const b = renderHook(() => useCategories());
    await waitFor(() => expect(a.result.current.data).toHaveLength(1));

    const updated = [...categories, { id: 'c2', name: 'Fuel', group_name: 'Transport' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updated) });
    await act(async () => {
      await a.result.current.refresh();
    });

    expect(b.result.current.data).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('exposes an error and retries on the next mount', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });
    const first = renderHook(() => useCategories());
    await waitFor(() => expect(first.result.current.error).toMatch(/500/));
    expect(first.result.current.isLoading).toBe(false);
    expect(first.result.current.data).toBeNull();

    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(categories) });
    const second = renderHook(() => useCategories());
    await waitFor(() => expect(second.result.current.data).toEqual(categories));
  });
});

describe('useAccounts', () => {
  beforeEach(() => {
    __resetAccountsCache();
    mockFetch.mockReset();
  });

  afterEach(() => cleanup());

  it('unwraps { accounts } and de-dupes concurrent fetches', async () => {
    const accounts = [{ id: 'a1', name: 'Current', type: 'current' }];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ accounts }) });

    const a = renderHook(() => useAccounts());
    const b = renderHook(() => useAccounts());
    await waitFor(() => expect(b.result.current.data).toEqual(accounts));
    expect(a.result.current.data).toEqual(accounts);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/accounts');
  });
});
