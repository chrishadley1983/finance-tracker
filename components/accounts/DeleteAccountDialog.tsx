'use client';

import { useState } from 'react';
import type { AccountWithStats } from '@/lib/types/account';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountWithStats;
  onConfirm: (force: boolean) => Promise<void>;
  onReallocate: () => void;
  isLoading?: boolean;
}

/** Deleting an account that has transactions: move them first, or type the name to delete everything. */
export function DeleteAccountDialog({ open, onOpenChange, account, onConfirm, onReallocate, isLoading = false }: DeleteAccountDialogProps) {
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasTransactions = account.transactionCount > 0;
  const canDelete = !hasTransactions || confirmName === account.name;
  const count = account.transactionCount.toLocaleString('en-GB');

  const handleClose = () => {
    setConfirmName('');
    setError(null);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    setError(null);
    if (!canDelete) {
      setError('Type the account name exactly to confirm.');
      return;
    }
    try {
      await onConfirm(hasTransactions);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account');
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Delete ${account.name}`}
      footer={
        <>
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={isLoading} disabled={!canDelete}>
            Delete account{hasTransactions ? ' and transactions' : ''}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 text-sm text-ink-2">
        {error && <Notice tone="error">{error}</Notice>}
        {hasTransactions ? (
          <>
            <Notice tone="warn">
              This account has <span className="fig">{count}</span> transaction{account.transactionCount === 1 ? '' : 's'}. Move them to
              another account first, or delete everything.
            </Notice>
            <button
              type="button"
              onClick={() => {
                handleClose();
                onReallocate();
              }}
              className="rounded-md border border-line px-4 py-3 text-left hover:bg-sunk focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="block font-medium text-ink">Move transactions first</span>
              <span className="block text-[13px] text-ink-3">Move them to another account, then delete this one.</span>
            </button>
            <Field
              label={`To delete all ${count} transactions too, type ${account.name}`}
              htmlFor="delete-account-confirm"
              hint="This can't be undone."
            >
              <Input id="delete-account-confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
            </Field>
          </>
        ) : (
          <p>
            Delete <strong className="text-ink">{account.name}</strong>? This can&apos;t be undone.
          </p>
        )}
      </div>
    </Modal>
  );
}
