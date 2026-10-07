'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { Notice, SkeletonRows } from '@/components/ui/Notice';
import { formatDateGB, formatGBP } from '@/lib/format';
import type { CategoryMapping } from './RulesPanel';

interface Preview {
  eligible: number;
  uncategorised: number;
  inReview: number;
  applicable: boolean;
  sample: { id: string; date: string; description: string; amount: number }[];
  rule: { category_name: string | null };
}

interface ApplyRuleDialogProps {
  rule: CategoryMapping | null;
  onClose: () => void;
  /** Called after a successful apply with the number of rows changed. */
  onApplied: (applied: number, categoryName: string) => void;
}

/**
 * "Apply rule to existing transactions": shows how many undecided
 * (uncategorised or in-review) transactions it would file, then applies.
 * Manually categorised and confirmed rows are never touched.
 */
export function ApplyRuleDialog({ rule, onClose, onApplied }: ApplyRuleDialogProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!rule) return;
    let cancelled = false;
    setPreview(null);
    setError(null);
    fetch(`/api/categories/rules/${rule.id}/apply`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? 'Could not check this rule');
        if (!cancelled) setPreview(body as Preview);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not check this rule'));
    return () => {
      cancelled = true;
    };
  }, [rule]);

  const categoryName = preview?.rule.category_name ?? rule?.category?.name ?? 'its category';

  const apply = async () => {
    if (!rule) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/rules/${rule.id}/apply`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not apply the rule');
      onApplied(Number(body.applied) || 0, body.categoryName ?? categoryName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply the rule');
    } finally {
      setApplying(false);
    }
  };

  const n = preview?.eligible ?? 0;

  return (
    <Modal
      open={rule !== null}
      onClose={onClose}
      title="Apply rule to existing transactions"
      widthClassName="max-w-lg"
      footer={
        preview && preview.applicable && n > 0 ? (
          <>
            <Button onClick={onClose} disabled={applying}>
              Cancel
            </Button>
            <Button variant="primary" onClick={apply} loading={applying}>
              Categorise {n} transaction{n === 1 ? '' : 's'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="grid gap-3 text-sm text-ink-2">
        {rule && (
          <p>
            <code className="fig rounded border border-line-2 bg-sunk px-1.5 py-px text-[12.5px] text-ink">{rule.pattern}</code> files transactions
            under <strong className="text-ink">{categoryName}</strong>.
          </p>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {!preview && !error && <SkeletonRows rows={3} />}
        {preview && !preview.applicable && (
          <Notice>This is an &ldquo;ask&rdquo; policy: it flags transactions for review rather than categorising them, so there is nothing to apply.</Notice>
        )}
        {preview && preview.applicable && n === 0 && (
          <p>No uncategorised or in-review transactions match it. Nothing to change.</p>
        )}
        {preview && preview.applicable && n > 0 && (
          <>
            <p>
              <strong className="fig text-ink">{n}</strong> transaction{n === 1 ? '' : 's'} would move to {categoryName}
              {preview.uncategorised > 0 && preview.inReview > 0
                ? ` (${preview.uncategorised} uncategorised, ${preview.inReview} waiting for review)`
                : preview.uncategorised > 0
                ? ' (all uncategorised)'
                : ' (all waiting for review)'}
              . Transactions you have categorised yourself are left alone.
            </p>
            <ul className="rounded-[3px] border border-line-2">
              {preview.sample.map((t) => (
                <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-line-2 px-3 py-1.5 text-[13px] last:border-b-0">
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{t.description}</span>
                    <span className="block text-xs text-ink-3">{formatDateGB(t.date)}</span>
                  </span>
                  <span className={`fig text-right ${t.amount > 0 ? 'text-in' : 'text-ink'}`}>
                    {formatGBP(t.amount, { pence: true, signed: t.amount > 0 })}
                  </span>
                </li>
              ))}
            </ul>
            {n > preview.sample.length && <p className="text-xs text-ink-3">and {n - preview.sample.length} more</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
