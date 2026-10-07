'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice, SkeletonRows } from '@/components/ui/Notice';
import type { Resource } from '@/lib/hooks/useDashboardData';

interface SectionStateProps<T> {
  resource: Resource<T>;
  /** What failed to load, e.g. "budgets". */
  what: string;
  rows?: number;
  children: (data: T) => ReactNode;
}

/** Loading, error (with retry) and loaded states for one Overview section. */
export function SectionState<T>({ resource, what, rows = 4, children }: SectionStateProps<T>) {
  if (resource.isLoading) return <SkeletonRows rows={rows} />;
  if (resource.error || resource.data === null) {
    return <SectionError what={what} error={resource.error} onRetry={resource.retry} />;
  }
  return <>{children(resource.data)}</>;
}

export function SectionError({ what, error, onRetry }: { what: string; error: string | null; onRetry: () => void }) {
  return (
    <Notice
      tone="error"
      action={
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      Couldn&apos;t load {what}. {error ?? 'No data came back.'}
    </Notice>
  );
}
