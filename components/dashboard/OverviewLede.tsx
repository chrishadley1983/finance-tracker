'use client';

import Link from 'next/link';
import type { LedePart } from '@/lib/dashboard/overview';

/** Renders the opening sentence built by buildLede(). */
export function OverviewLede({ parts }: { parts: LedePart[] }) {
  return (
    <p className="text-[15px] leading-relaxed">
      {parts.map((p, i) => {
        if (p.href) {
          return (
            <Link key={i} href={p.href} className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
              {p.text}
            </Link>
          );
        }
        if (p.strong) {
          return (
            <strong key={i} className={p.fig ? 'fig' : undefined}>
              {p.text}
            </strong>
          );
        }
        return <span key={i}>{p.text}</span>;
      })}
    </p>
  );
}
