import type { ReactNode } from 'react';

type Tone = 'info' | 'warn' | 'error' | 'success';
const TONE: Record<Tone, string> = {
  info: 'border-line bg-sunk text-ink-2',
  warn: 'border-warn/40 bg-warn-soft text-warn',
  error: 'border-bad/40 bg-bad-soft text-bad',
  success: 'border-accent/40 bg-accent-soft text-accent',
};

/** Inline message. Errors say what went wrong and what to do next. */
export function Notice({ tone = 'info', children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${TONE[tone]}`}>
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  );
}

/** Empty state: what will appear here, and how to make it appear. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {children && <div className="max-w-[52ch] text-sm text-ink-3">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Loading placeholder rows. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 animate-pulse rounded bg-line-2" style={{ width: `${90 - ((i * 13) % 30)}%` }} />
      ))}
    </div>
  );
}
