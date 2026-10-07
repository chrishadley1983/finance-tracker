'use client';

import { useState } from 'react';
import type { AccountWithStats, Account } from '@/lib/types/account';
import { getAccountTypeLabel } from '@/lib/types/account';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';

interface ReallocateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAccount: AccountWithStats;
  availableAccounts: Account[];
  onConfirm: (targetAccountId: string) => Promise<void>;
  isLoading?: boolean;
}

export function ReallocateDialog({ open, onOpenChange, sourceAccount, availableAccounts, onConfirm, isLoading = false }: ReallocateDialogProps) {
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const validTargets = availableAccounts.filter((a) => a.id !== sourceAccount.id && !a.is_archived);
  const count = sourceAccount.transactionCount.toLocaleString('en-GB');

  const handleClose = () => {
    setTargetAccountId('');
    setError(null);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    setError(null);
    if (!targetAccountId) {
      setError('Choose the account to move them to.');
      return;
    }
    try {
      await onConfirm(targetAccountId);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move the transactions');
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Move transactions"
      footer={
        <>
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={isLoading} disabled={!targetAccountId || validTargets.length === 0}>
            Move {count} transaction{sourceAccount.transactionCount === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 text-sm">
        {error && <Notice tone="error">{error}</Notice>}
        <p className="text-ink-2">
          From <strong className="text-ink">{sourceAccount.name}</strong> (<span className="fig">{count}</span> transaction
          {sourceAccount.transactionCount === 1 ? '' : 's'}).
        </p>
        {validTargets.length > 0 ? (
          <Field label="Move to" htmlFor="reallocate-target" hint={targetAccountId ? "Every transaction moves. This can't be undone." : undefined}>
            <Select id="reallocate-target" value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)}>
              <option value="">Choose an account</option>
              {validTargets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({getAccountTypeLabel(a.type)})
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Notice tone="warn">There are no other active accounts. Add one first.</Notice>
        )}
      </div>
    </Modal>
  );
}
