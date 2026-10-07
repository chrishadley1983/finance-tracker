'use client';

import { isTypingTarget } from '@/lib/keyboard';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_NAV_ITEMS } from './nav-config';

/**
 * Global keys: ⌘K / Ctrl+K or "/" opens search, "[" toggles the nav column,
 * and "G then a letter" jumps to a page (G O overview, G T transactions …).
 */
export function useShortcuts(opts: { onSearch: () => void; onToggleColumn: () => void }) {
  const router = useRouter();
  const pendingG = useRef<number | null>(null);
  const { onSearch, onToggleColumn } = opts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onSearch();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const item = ALL_NAV_ITEMS.find((i) => i.go === e.key.toLowerCase());
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        onSearch();
      } else if (e.key === '[') {
        e.preventDefault();
        onToggleColumn();
      } else if (e.key === 'g') {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, onSearch, onToggleColumn]);
}
