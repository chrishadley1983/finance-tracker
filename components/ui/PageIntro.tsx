import type { ReactNode } from 'react';

/**
 * The sentence that opens a page ("You've spent £2,148 of …"), with the page's
 * actions top-right, level with the sentence (stacked under it on a phone).
 * Pages open with a sentence, not a row of tiles.
 *
 * - `actions`: buttons for the whole page. At most one `primary`; put it last
 *   so it sits at the far right. Filters belong with the list they filter, not here.
 * - `aside`: one figure that matters most (e.g. net worth), aligned to the
 *   bottom of the sentence.
 */
export function PageIntro({ children, actions, aside }: { children?: ReactNode; actions?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-8">
      <div className="min-w-0 max-w-[78ch] text-[14.5px] text-ink-2 sm:flex-1 [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
      {aside && <div className="min-w-0 sm:self-end">{aside}</div>}
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
