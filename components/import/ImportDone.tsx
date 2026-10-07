'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import type { ImportResult } from './ImportWizard';

interface ImportDoneProps {
  result: ImportResult;
  onReset: () => void;
}

const linkClass =
  'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border px-3.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

/** Final step: what happened, and where to go next (Review when anything needs a look). */
export function ImportDone({ result, onReset }: ImportDoneProps) {
  const [toReview, setToReview] = useState<number | null>(null);

  // The review count comes from the live queue, so it includes the rows just imported.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/nav-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body?.review) setToReview(Number(body.review.total) || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const parts = [`Imported ${plural(result.imported, 'transaction')}`];
  if (result.skipped > 0) parts.push(`skipped ${plural(result.skipped, 'duplicate')}`);
  const reviewFirst = toReview !== null && toReview > 0;

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold text-ink">{result.imported > 0 ? 'Import complete' : 'Nothing new to import'}</h2>
        <p className="text-sm text-ink-2" data-testid="import-summary">
          {parts.join(', ')}.
          {result.failed > 0 && ` ${plural(result.failed, 'row')} could not be saved.`}
        </p>
        {reviewFirst && (
          <p className="text-sm text-ink-2">
            {plural(toReview, 'transaction')} {toReview === 1 ? 'needs' : 'need'} a category check in Review, including any
            the categoriser was unsure about.
          </p>
        )}
      </div>

      {result.failed > 0 && result.errors.length > 0 && (
        <Notice tone="error">
          <p className="font-medium">These rows were not imported:</p>
          <ul className="mt-1 list-disc pl-5">
            {result.errors.slice(0, 5).map((e) => (
              <li key={e.row}>
                Row <span className="fig">{e.row}</span>: {e.error}
              </li>
            ))}
            {result.errors.length > 5 && <li>and {result.errors.length - 5} more</li>}
          </ul>
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        {reviewFirst ? (
          <Link href="/review" className={`${linkClass} border-accent bg-accent font-semibold text-accent-ink hover:opacity-90`}>
            Review {plural(toReview, 'transaction')}
          </Link>
        ) : (
          <Link href="/transactions" className={`${linkClass} border-accent bg-accent font-semibold text-accent-ink hover:opacity-90`}>
            View transactions
          </Link>
        )}
        {reviewFirst && (
          <Link href="/transactions" className={`${linkClass} border-line bg-surface text-ink hover:bg-sunk`}>
            View transactions
          </Link>
        )}
        <Button onClick={onReset}>Import another file</Button>
      </div>
    </div>
  );
}
