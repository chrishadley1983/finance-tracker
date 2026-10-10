import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'warn' | 'bad' | 'in';
const TONE: Record<Tone, string> = {
  neutral: 'bg-line-2 text-ink-2',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  in: 'bg-accent-soft text-in',
};

/** Small status label. Tone encodes state; don't use it for decoration. */
export function Chip({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-px text-[11.5px] ${TONE[tone]} ${className}`}>{children}</span>;
}
