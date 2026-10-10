'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export interface CachedResourceState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export interface CachedResourceResult<T> extends CachedResourceState<T> {
  /** Force a re-fetch, bypassing the cache. Resolves once the new data is in. */
  refresh: () => Promise<void>;
}

/**
 * A module-level cached GET resource.
 *
 * - The first consumer to mount triggers the fetch; later consumers reuse the
 *   cached result for the rest of the page load.
 * - Concurrent loads share one in-flight request.
 * - `refresh()` re-fetches and pushes the new value to every subscriber.
 * - A failed load is not cached as data: the next consumer to mount retries.
 */
export function createCachedResource<T>(url: string, parse: (json: unknown) => T) {
  const initial: CachedResourceState<T> = { data: null, isLoading: false, error: null };
  let state: CachedResourceState<T> = initial;
  let inFlight: Promise<void> | null = null;
  let generation = 0; // bumped by reset() so stale responses are ignored
  const listeners = new Set<() => void>();

  const setState = (next: CachedResourceState<T>) => {
    state = next;
    listeners.forEach((l) => l());
  };

  const load = (force = false): Promise<void> => {
    if (inFlight) return inFlight;
    if (!force && state.data !== null) return Promise.resolve();

    setState({ ...state, isLoading: true, error: null });
    const gen = generation;
    const request = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load ${url} (${response.status})`);
        }
        const json: unknown = await response.json();
        if (gen !== generation) return; // reset() while in flight
        setState({ data: parse(json), isLoading: false, error: null });
      } catch (err) {
        if (gen !== generation) return;
        setState({
          data: state.data,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Request failed',
        });
      } finally {
        if (gen === generation) inFlight = null;
      }
    })();
    inFlight = request;
    return request;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const getSnapshot = () => state;
  const getServerSnapshot = () => initial;

  /** `enabled: false` subscribes to the cache without triggering a fetch. */
  function useResource({ enabled = true }: { enabled?: boolean } = {}): CachedResourceResult<T> {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    useEffect(() => {
      if (enabled) void load();
    }, [enabled]);

    const refresh = useCallback(() => load(true), []);

    // Before the first load starts there is no data and no error yet: report
    // loading so consumers do not flash an empty state.
    const isLoading =
      snapshot.isLoading || (enabled && snapshot.data === null && snapshot.error === null);

    return { data: snapshot.data, isLoading, error: snapshot.error, refresh };
  }

  /** Test helper: drop the cache and any in-flight request. */
  function reset() {
    generation += 1;
    inFlight = null;
    state = initial;
    listeners.forEach((l) => l());
  }

  return { useResource, load, reset };
}
