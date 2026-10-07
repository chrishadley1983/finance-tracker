'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface DisclosureProps {
  title: ReactNode;
  /** One line under the title while closed (and open): what's inside. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** An open section (top rule, no box) whose body can be shown or hidden. */
export function Disclosure({ title, summary, defaultOpen = false, open: openProp, onOpenChange, children }: DisclosureProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = openProp ?? ownOpen;
  const id = useId();
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };
  return (
    <section className="min-w-0 border-t-[1.5px] border-ink">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className="flex w-full items-start justify-between gap-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
          {summary && <span className="mt-0.5 block text-[12.5px] text-ink-3">{summary}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-ink-3">
          {open ? 'Hide' : 'Show'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      <div id={id} hidden={!open} className="pb-2">
        {children}
      </div>
    </section>
  );
}
