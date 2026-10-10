'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/**
 * Small "…" menu for a list row. Arrow keys move between items, Esc closes and
 * returns focus to the trigger. Clicks inside don't bubble to the row.
 * (Candidate for components/ui.)
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const visible = items.filter((i) => !i.hidden);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`block w-full px-3 py-1.5 text-left text-[13px] hover:bg-sunk focus:bg-sunk focus:outline-none ${
                item.danger ? 'text-bad' : 'text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
