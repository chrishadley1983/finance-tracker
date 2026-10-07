'use client';

import { useEffect, useState } from 'react';
import { CategoryWithStats } from '@/lib/types/category';
import type { CategoryWithGroup } from '@/lib/hooks/useCategories';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { Field } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { formatGBP } from '@/lib/format';

interface ReassignCategoryDialogProps {
  category: CategoryWithStats | null;
  allCategories: CategoryWithStats[];
  isOpen: boolean;
  onClose: () => void;
  onReassign: (targetCategoryId: string) => Promise<void>;
}

export function ReassignCategoryDialog({ category, allCategories, isOpen, onClose, onReassign }: ReassignCategoryDialogProps) {
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetCategoryId(null);
      setError(null);
    }
  }, [isOpen]);

  const available = allCategories.filter((c) => c.id !== category?.id);
  const n = category?.transaction_count ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCategoryId) {
      setError('Choose the category to move them to.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onReassign(targetCategoryId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move the transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen && !!category}
      onClose={onClose}
      title="Move transactions"
      onSubmit={handleSubmit}
      scrollBody={false}
      footer={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={!targetCategoryId}>
            Move {n} transaction{n === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 text-sm">
        {error && <Notice tone="error">{error}</Notice>}
        {category && (
          <p className="text-ink-2">
            From <strong className="text-ink">{category.name}</strong>: <span className="fig">{n}</span> transaction{n === 1 ? '' : 's'},{' '}
            <span className="fig">{formatGBP(category.total_amount)}</span>.
          </p>
        )}
        <Field label="Move to">
          <CategorySelect
            value={targetCategoryId}
            onChange={(id) => setTargetCategoryId(id)}
            categories={available as unknown as CategoryWithGroup[]}
            placeholder="Choose a category"
          />
        </Field>
      </div>
    </Modal>
  );
}
