'use client';

import { useEffect, useId, useState } from 'react';
import { SidePanel } from '@/components/ui/SidePanel';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';

interface CopyBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the server's message after a successful copy. */
  onSuccess: (message: string) => void;
  targetYear: number;
}

/** Copy every month's budgets from an earlier year into an empty year. */
export function CopyBudgetDialog({ isOpen, onClose, onSuccess, targetYear }: CopyBudgetDialogProps) {
  const id = useId();
  const [sourceYear, setSourceYear] = useState(targetYear - 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSourceYear(targetYear - 1);
      setError(null);
    }
  }, [isOpen, targetYear]);

  const yearOptions: number[] = [];
  for (let y = targetYear - 1; y >= targetYear - 5 && y >= 2020; y--) yearOptions.push(y);

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/budgets/copy-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceYear, targetYear }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not copy the budgets. Try again.');
      onSuccess(`Copied ${sourceYear}'s budgets into ${targetYear}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy the budgets. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SidePanel
      open={isOpen}
      onClose={onClose}
      title={`Copy budgets into ${targetYear}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={isSubmitting} disabled={yearOptions.length === 0}>
            Copy budgets
          </Button>
        </div>
      }
    >
      <div className="grid gap-5">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Copy from" htmlFor={`${id}-year`} hint={`Every month's budgets from ${sourceYear} are copied into the same month of ${targetYear}. This works while ${targetYear} has no budgets set.`}>
          <Select id={`${id}-year`} value={sourceYear} onChange={(e) => setSourceYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </SidePanel>
  );
}
