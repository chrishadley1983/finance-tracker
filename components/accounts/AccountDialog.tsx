'use client';

import { useState, useEffect } from 'react';
import type { Account, AccountType, CreateAccountInput, UpdateAccountInput } from '@/lib/types/account';
import { accountTypeConfig } from '@/lib/types/account';
import { CheckboxField, Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  onSave: (data: CreateAccountInput | UpdateAccountInput) => Promise<void>;
  isLoading?: boolean;
}

const accountTypes: AccountType[] = ['current', 'savings', 'credit', 'investment', 'pension', 'isa', 'property', 'other'];

export function AccountDialog({ open, onOpenChange, account, onSave, isLoading = false }: AccountDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('current');
  const [provider, setProvider] = useState('');
  const [notes, setNotes] = useState('');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!account;

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setType(account?.type ?? 'current');
    setProvider(account?.provider || '');
    setNotes(account?.notes || '');
    setIncludeInNetWorth(account?.include_in_net_worth ?? true);
    setError(null);
  }, [open, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Give the account a name.');
      return;
    }
    try {
      await onSave({
        name: name.trim(),
        type,
        provider: provider.trim() || undefined,
        notes: notes.trim() || undefined,
        include_in_net_worth: includeInNetWorth,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the account');
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={isEditMode ? 'Edit account' : 'Add account'}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isLoading}>
            {isEditMode ? 'Save changes' : 'Add account'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Name" htmlFor="account-name">
          <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HSBC Joint Current Account" maxLength={100} required />
        </Field>
        <Field label="Type" htmlFor="account-type">
          <Select id="account-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {accountTypes.map((t) => (
              <option key={t} value={t}>
                {accountTypeConfig[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Institution" htmlFor="account-provider">
          <Input id="account-provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. HSBC, Vanguard" maxLength={100} />
        </Field>
        <Field label="Notes" htmlFor="account-notes">
          <Textarea id="account-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} />
        </Field>
        <CheckboxField id="account-networth" checked={includeInNetWorth} onChange={setIncludeInNetWorth}>
          Count towards net worth
        </CheckboxField>
      </div>
    </Modal>
  );
}
