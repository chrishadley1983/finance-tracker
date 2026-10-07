'use client';

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Heading; also the dialog's accessible name. */
  title: ReactNode;
  children: ReactNode;
  /** Buttons row (right-aligned). */
  footer?: ReactNode;
  /** When set, body and footer are wrapped in a <form> with this submit handler. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** Max width class, default `max-w-md`. */
  widthClassName?: string;
  /**
   * Scroll a tall body inside the dialog (default). Pass false for short
   * dialogs holding a popover (e.g. CategorySelect) so it isn't clipped.
   */
  scrollBody?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centred dialog using the design tokens. Esc and the backdrop close it; focus
 * moves in on open, is trapped while open, and returns to the trigger on close.
 * (Candidate for components/ui.)
 */
export function Modal({ open, onClose, title, children, footer, onSubmit, widthClassName = 'max-w-md', scrollBody = true }: ModalProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = ref.current?.querySelector<HTMLElement>(`[data-autofocus], ${FOCUSABLE}`);
    (first ?? ref.current)?.focus();
    return () => {
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
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

  if (!open) return null;

  const body = (
    <>
      <div className={`px-5 py-4 ${scrollBody ? 'max-h-[70vh] overflow-y-auto' : ''}`}>{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-2 px-5 py-3">{footer}</div>}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30" onClick={() => onCloseRef.current()} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${widthClassName} rounded-md border border-line bg-surface text-ink shadow-xl focus:outline-none`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line-2 px-5 py-3.5">
          <h2 id={titleId} className="text-[15px] font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close"
            className="rounded-md p-1 text-ink-3 hover:bg-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} noValidate={false}>
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>
  );
}

/** Checkbox row with a label, in tokens. */
export function CheckboxField({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {children}
    </label>
  );
}
