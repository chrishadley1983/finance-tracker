'use client';

import { useEffect, useId, useState } from 'react';
import { SidePanel } from '@/components/ui/SidePanel';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { formatGBP, MONTH_SHORT } from '@/lib/format';
import { parseAmount } from './BudgetAmount';

export interface MonthlyBudget {
  month: number;
  amount: number;
}

interface BudgetBulkEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Rejects with an Error to keep the panel open and show the message. */
  onSave: (budgets: MonthlyBudget[]) => Promise<void>;
  categoryName: string;
  groupName: string;
  year: number;
  currentBudgets: MonthlyBudget[];
}

const fmtDraft = (n: number) => (n ? String(n) : '');

/** Year view: edit a category's twelve monthly budgets at once. */
export function BudgetBulkEditDialog({ isOpen, onClose, onSave, categoryName, groupName, year, currentBudgets }: BudgetBulkEditDialogProps) {
  const id = useId();
  const [drafts, setDrafts] = useState<string[]>(Array(12).fill(''));
  const [yearly, setYearly] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const next = Array.from({ length: 12 }, (_, i) => fmtDraft(currentBudgets.find((b) => b.month === i + 1)?.amount ?? 0));
    setDrafts(next);
    setYearly('');
    setError(null);
  }, [currentBudgets, isOpen]);

  const parsed = drafts.map(parseAmount);
  const invalid = parsed.some((v) => v === null);
  const total = parsed.reduce<number>((s, v) => s + (v ?? 0), 0);

  const spread = () => {
    const value = parseAmount(yearly);
    if (value === null) {
      setError('Enter the yearly total as an amount, e.g. 4800.');
      return;
    }
    setError(null);
    const monthly = Math.round((value / 12) * 100) / 100;
    setDrafts(Array(12).fill(fmtDraft(monthly)));
  };

  const save = async () => {
    if (invalid) {
      setError('Some months are not valid amounts. Use numbers like 250 or 250.50.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(parsed.map((v, i) => ({ month: i + 1, amount: v ?? 0 })));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these budgets. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SidePanel
      open={isOpen}
      onClose={onClose}
      title={`${categoryName} budgets for ${year}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink-2">
            Year total <span className="fig font-medium text-ink">{formatGBP(total)}</span>
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={isSubmitting}>
              Save 12 months
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5">
        <p className="text-sm text-ink-2">
          {groupName}. Set each month, or spread a yearly total evenly.
        </p>
        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Yearly total" htmlFor={`${id}-yearly`}>
              <Input
                id={`${id}-yearly`}
                inputMode="decimal"
                placeholder={String(Math.round(total))}
                value={yearly}
                onChange={(e) => setYearly(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    spread();
                  }
                }}
                className="fig"
              />
            </Field>
          </div>
          <Button onClick={spread}>Spread evenly</Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {drafts.map((d, i) => (
            <Field key={i} label={MONTH_SHORT[i]} htmlFor={`${id}-m${i}`}>
              <Input
                id={`${id}-m${i}`}
                inputMode="decimal"
                value={d}
                placeholder="0"
                aria-invalid={parsed[i] === null || undefined}
                onChange={(e) => setDrafts((all) => all.map((v, j) => (j === i ? e.target.value : v)))}
                className={`fig text-right ${parsed[i] === null ? 'border-bad' : ''}`}
              />
            </Field>
          ))}
        </div>
      </div>
    </SidePanel>
  );
}
