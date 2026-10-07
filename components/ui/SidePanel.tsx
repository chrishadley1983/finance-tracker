'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  /** Panel heading; also the dialog's accessible name. */
  title: ReactNode;
  children: ReactNode;
  /** Optional sticky footer (e.g. Save / Cancel). */
  footer?: ReactNode;
  /** Width from the `sm` breakpoint up. Below it the panel is full-width. */
  widthClassName?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Right-hand drawer. Escape or the backdrop closes it; focus moves into the
 * panel on open, is trapped while open, and returns to the trigger on close.
 */
export function SidePanel({
  open,
  onClose,
  title,
  children,
  footer,
  widthClassName = 'sm:max-w-md',
}: SidePanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => setMounted(true), []);

  // Focus management: into the panel on open, back to the trigger on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(`[data-autofocus], ${FOCUSABLE}`);
    (first ?? panel)?.focus();
    return () => {
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [open, mounted]);

  // Escape closes; Tab stays inside the panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return; // e.g. a nested popover handled it
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/30" onClick={() => onCloseRef.current()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface text-ink focus:outline-none ${widthClassName}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close panel"
            className="rounded-md p-1 text-ink-3 hover:bg-sunk hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-sunk px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
