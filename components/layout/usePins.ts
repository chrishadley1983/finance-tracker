'use client';

import { useCallback, useEffect, useState } from 'react';

export interface NavPin {
  id: string;
  href: string;
  label: string;
}

let cached: NavPin[] | null = null;

export function usePins() {
  const [pins, setPins] = useState<NavPin[]>(cached ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/nav-pins', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        cached = d.pins ?? [];
        if (alive) setPins(cached!);
      })
      .catch(() => alive && setError('Could not load pins'));
    return () => {
      alive = false;
    };
  }, []);

  const pin = useCallback(async (href: string, label: string) => {
    const res = await fetch('/api/nav-pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ href, label }),
    });
    if (!res.ok) throw new Error('Could not pin this page');
    const { pin: saved } = await res.json();
    cached = [...(cached ?? []).filter((p) => p.href !== href), saved];
    setPins(cached);
  }, []);

  const unpin = useCallback(async (href: string) => {
    const before = cached ?? [];
    cached = before.filter((p) => p.href !== href);
    setPins(cached);
    const res = await fetch(`/api/nav-pins?href=${encodeURIComponent(href)}`, { method: 'DELETE' });
    if (!res.ok) {
      cached = before;
      setPins(before);
      throw new Error('Could not unpin this page');
    }
  }, []);

  return { pins, pin, unpin, error };
}
