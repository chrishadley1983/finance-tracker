'use client';

import { useState } from 'react';
import { CategoryWithStats } from '@/lib/types/category';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { formatGBP } from '@/lib/format';

interface DeleteCategoryDialogProps {
  category: CategoryWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (force: boolean) => Promise<void>;
  onReassign: () => void;
}

export function DeleteCategoryDialog({ category, isOpen, onClose, onDelete, onReassign }: DeleteCategoryDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = category?.transaction_count ?? 0;
  const hasTransactions = n > 0;

  const handleDelete = async (force: boolean) => {
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete(force);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the category');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      open={isOpen && !!category}
      onClose={onClose}
      title={`Delete ${category?.name ?? 'category'}`}
      footer={
        hasTransactions ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(true)} loading={isDeleting}>
              Delete and uncategorise
            </Button>
            <Button variant="primary" onClick={onReassign} disabled={isDeleting}>
              Move transactions first
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(false)} loading={isDeleting}>
              Delete category
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-3 text-sm text-ink-2">
        {error && <Notice tone="error">{error}</Notice>}
        {hasTransactions && category ? (
          <Notice tone="warn">
            <span className="fig">{n}</span> transaction{n === 1 ? '' : 's'} (<span className="fig">{formatGBP(category.total_amount)}</span>) use this
            category. Move them to another category first, or delete it and they become uncategorised.
          </Notice>
        ) : (
          <p>
            Delete <strong className="text-ink">{category?.name}</strong>? No transactions use it.
          </p>
        )}
      </div>
    </Modal>
  );
}
