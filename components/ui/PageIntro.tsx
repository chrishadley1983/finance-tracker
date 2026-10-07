import type { ReactNode } from 'react';

/**
 * The sentence that opens a page ("You've spent £2,148 of …"), with the page's
 * actions on the right. Pages open with a sentence, not a row of tiles.
 */
export function PageIntro({ children, actions, aside }: { children?: ReactNode; actions?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-[78ch] text-[14.5px] text-ink-2 [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
      {aside}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
