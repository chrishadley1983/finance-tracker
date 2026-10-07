'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';

interface TlAccountOption {
  uid: string;
  name: string;
  kind: 'account' | 'card';
  currency: string | null;
  detail: string | null;
}

interface FinanceAccountOption {
  id: string;
  name: string;
  type: string;
  truelayer_account_id: string | null;
}

interface AccountLinkPanelProps {
  connectionRowId: string;
  provider: string | null;
  tlAccounts: TlAccountOption[];
  financeAccounts: FinanceAccountOption[];
  /** Called after each successful link so the parent can refresh /status. */
  onLinked: () => void;
}

interface RowState {
  financeAccountId: string;
  isLinking: boolean;
  error: string | null;
  linked: boolean;
}

/**
 * Renders one row per TrueLayer account returned on the connection and lets
 * the user map it onto one of their Finance Tracker accounts.
 */
export function AccountLinkPanel({
  connectionRowId,
  provider,
  tlAccounts,
  financeAccounts,
  onLinked,
}: AccountLinkPanelProps) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      tlAccounts.map((tl) => [tl.uid, { financeAccountId: '', isLinking: false, error: null, linked: false }])
    )
  );

  const updateRow = (uid: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [uid]: { ...prev[uid], ...patch } }));
  };

  const handleLink = async (truelayerAccountId: string) => {
    const row = rows[truelayerAccountId];
    if (!row?.financeAccountId) {
      updateRow(truelayerAccountId, { error: 'Choose an account to link' });
      return;
    }

    updateRow(truelayerAccountId, { isLinking: true, error: null });
    try {
      const response = await fetch('/api/truelayer/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionRowId,
          financeAccountId: row.financeAccountId,
          truelayerAccountId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to link account');
      }
      updateRow(truelayerAccountId, { isLinking: false, linked: true });
      onLinked();
    } catch (err) {
      updateRow(truelayerAccountId, {
        isLinking: false,
        error: err instanceof Error ? err.message : 'Failed to link account',
      });
    }
  };

  if (tlAccounts.length === 0) {
    return (
      <Notice tone="warn">
        {provider || 'Your bank'} didn&apos;t return any accounts. Try connecting again and tick the accounts you want to share.
      </Notice>
    );
  }

  return (
    <Panel
      variant="boxed"
      title={`Link accounts from ${provider || 'your bank'}`}
    >
      <p className="-mt-1 mb-3 text-sm text-ink-2">Choose which of your accounts each one feeds into.</p>
      <ul className="-mx-4 -mb-4 border-t border-line-2">
        {tlAccounts.map((tl) => {
          const row = rows[tl.uid];
          // Hide accounts already linked to a *different* TrueLayer account.
          const availableFinanceAccounts = financeAccounts.filter(
            (fa) => !fa.truelayer_account_id || fa.truelayer_account_id === tl.uid
          );
          const selectId = `link-${tl.uid}`;

          return (
            <li key={tl.uid} className="grid gap-2 border-b border-line-2 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-center">
              <div className="min-w-0">
                <label htmlFor={selectId} className="block truncate text-sm font-medium text-ink">
                  {tl.name}
                </label>
                <p className="text-xs text-ink-3">
                  {[tl.kind === 'card' ? 'Card' : 'Account', tl.currency, tl.detail].filter(Boolean).join(' · ') || 'Bank account'}
                </p>
              </div>

              {row?.linked ? (
                <div className="flex items-center gap-2 sm:justify-end">
                  <Chip tone="in">Linked</Chip>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    id={selectId}
                    value={row?.financeAccountId ?? ''}
                    onChange={(e) => updateRow(tl.uid, { financeAccountId: e.target.value, error: null })}
                    className="min-w-0 flex-1"
                  >
                    <option value="">Choose an account</option>
                    {availableFinanceAccounts.map((fa) => (
                      <option key={fa.id} value={fa.id}>
                        {fa.name}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="primary" onClick={() => handleLink(tl.uid)} loading={row?.isLinking}>
                    {row?.isLinking ? 'Linking...' : 'Link'}
                  </Button>
                </div>
              )}
              {row?.error && <p className="text-xs text-bad sm:col-span-2">{row.error}</p>}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
