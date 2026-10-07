'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatGBP, gbDate } from '@/lib/format';
import { applyThemePreference } from '@/lib/theme';
import { useToast } from '@/components/ui/Toast';
import { ALL_NAV_ITEMS } from './nav-config';
import { refreshNavSummary } from './useNavSummary';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface Entry {
  id: string;
  group: 'Pages' | 'Actions' | 'Transactions';
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

interface TxHit {
  id: string;
  date: string;
  amount: number;
  description: string;
  category?: { name: string } | null;
}

/** ⌘K: jump to a page, run an action, or search transactions. */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<TxHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setHits([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Transaction search once the query is specific enough.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 3) {
      setHits([]);
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/transactions?search=${encodeURIComponent(q)}&limit=5`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((d) => setHits(d.data ?? []))
        .catch(() => {});
    }, 200);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [query, open]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const actions: Entry[] = useMemo(
    () => [
      {
        id: 'sync',
        group: 'Actions',
        label: 'Sync bank accounts',
        hint: 'TrueLayer',
        run: async () => {
          onClose();
          toast({ message: 'Syncing bank accounts…' });
          try {
            const res = await fetch('/api/truelayer/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            });
            if (!res.ok) throw new Error();
            toast({ message: 'Bank sync finished', tone: 'success' });
            refreshNavSummary();
          } catch {
            toast({ message: 'Bank sync failed. Open Bank sync to see why.', tone: 'error', action: { label: 'Open', onClick: () => router.push('/settings/bank-sync') } });
          }
        },
      },
      { id: 'balances', group: 'Actions', label: 'Enter month-end balances', hint: 'Net worth', run: () => go('/wealth') },
      { id: 'import', group: 'Actions', label: 'Import a statement', hint: 'CSV or PDF', run: () => go('/import') },
      {
        id: 'theme',
        group: 'Actions',
        label: 'Switch light / dark theme',
        run: () => {
          const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
          applyThemePreference(next);
          onClose();
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onClose, toast, router]
  );

  const entries: Entry[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages: Entry[] = ALL_NAV_ITEMS.map((i) => ({
      id: `page:${i.href}`,
      group: 'Pages',
      label: i.label,
      hint: i.go ? `G ${i.go.toUpperCase()}` : i.section.label,
      run: () => go(i.href),
    }));
    const match = (e: Entry) => !q || e.label.toLowerCase().includes(q) || (e.hint ?? '').toLowerCase().includes(q);
    const tx: Entry[] = hits.map((h) => ({
      id: `tx:${h.id}`,
      group: 'Transactions',
      label: h.description,
      hint: `${formatGBP(h.amount, { pence: true })} · ${gbDate(new Date(`${h.date}T00:00:00`), { day: 'numeric', month: 'short' })}`,
      run: () => go(`/transactions?search=${encodeURIComponent(query.trim())}`),
    }));
    const searchAll: Entry[] =
      q.length >= 3
        ? [{ id: 'tx:all', group: 'Transactions', label: `All transactions matching “${query.trim()}”`, run: () => go(`/transactions?search=${encodeURIComponent(query.trim())}`) }]
        : [];
    return [...pages.filter(match), ...actions.filter(match), ...tx, ...searchAll];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, hits, actions]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, entries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      entries[active]?.run();
    }
  };

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search or jump"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={entries[active] ? `${listId}-${active}` : undefined}
          placeholder="Search pages, actions or transactions…"
          className="w-full border-b border-line bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {entries.length === 0 && <li className="px-3 py-4 text-sm text-ink-3">Nothing matches “{query}”.</li>}
          {entries.map((e, i) => {
            const header = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            return (
              <li key={e.id} role="presentation">
                {header && <div className="px-2.5 pb-1 pt-2 text-[11.5px] text-ink-3">{header}</div>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => e.run()}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[13.5px] text-ink ${i === active ? 'bg-sel' : ''}`}
                >
                  <span className="truncate">{e.label}</span>
                  {e.hint && <span className={`shrink-0 text-xs text-ink-3 ${e.group === 'Transactions' ? 'fig' : ''}`}>{e.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
