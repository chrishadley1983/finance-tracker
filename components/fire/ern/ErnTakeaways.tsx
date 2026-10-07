'use client';

import type { FireTakeaway } from '@/lib/fire/ern/types';
import { Button } from '@/components/ui/Button';
import { Notice, SkeletonRows } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';

export type TakeawaysState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: FireTakeaway[] }
  /** 503 from the API: not configured, or the AI service is down. */
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

interface ErnTakeawaysProps {
  state: TakeawaysState;
  onRetry?: () => void;
}

/** Drop a leading label such as "Example:" that the model sometimes adds. */
export function cleanTakeawayBody(body: string): string {
  return body.replace(/^\s*(?:for\s+)?(?:example|e\.g\.)\s*[:,\-–—]\s*/i, '').replace(/^./, (c) => c.toUpperCase());
}

/** AI-written takeaways from the simulation results, with loading, unavailable and retry states. */
export function ErnTakeaways({ state, onRetry }: ErnTakeawaysProps) {
  if (state.status === 'idle') return null;

  const retry = onRetry && (
    <Button size="sm" onClick={onRetry}>
      Try again
    </Button>
  );

  return (
    <Panel title="Takeaways" action={<span>AI-written, so check the numbers</span>}>
      {state.status === 'loading' && (
        <div className="grid gap-2 py-1" aria-live="polite">
          <p className="text-[12.5px] text-ink-3">Writing takeaways…</p>
          <SkeletonRows rows={4} />
        </div>
      )}

      {state.status === 'unavailable' && (
        <Notice tone="info" action={retry}>
          Takeaways aren&apos;t available: {state.message.replace(/\.$/, '')}. The rest of the analysis is unaffected.
        </Notice>
      )}

      {state.status === 'error' && (
        <Notice tone="error" action={retry}>
          {state.message}
        </Notice>
      )}

      {state.status === 'ready' &&
        (state.items.length === 0 ? (
          <p className="py-2 text-sm text-ink-3">No takeaways came back for this run.</p>
        ) : (
          <ul className="grid gap-x-10 md:grid-cols-2">
            {state.items.map((t, i) => (
              <li key={i} className="border-t border-line-2 py-3 first:border-t-0 md:[&:nth-child(2)]:border-t-0">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{cleanTakeawayBody(t.body)}</p>
              </li>
            ))}
          </ul>
        ))}
    </Panel>
  );
}
