'use client';

import { useState } from 'react';

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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          No accounts were returned by {provider || 'your bank'}. Try reconnecting.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-emerald-900">Connected to {provider || 'your bank'}</h3>
        <p className="text-sm text-emerald-700 mt-0.5">
          Choose which Finance Tracker account each bank account maps to.
        </p>
      </div>

      <div className="space-y-3">
        {tlAccounts.map((tl) => {
          const row = rows[tl.uid];
          // Hide accounts already linked to a *different* TrueLayer account.
          const availableFinanceAccounts = financeAccounts.filter(
            (fa) => !fa.truelayer_account_id || fa.truelayer_account_id === tl.uid
          );

          return (
            <div key={tl.uid} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[10rem]">
                  <p className="text-sm font-medium text-slate-900">{tl.name}</p>
                  <p className="text-xs text-slate-500">
                    {[tl.kind === 'card' ? 'Card' : 'Account', tl.currency, tl.detail].filter(Boolean).join(' • ') ||
                      'Bank account'}
                  </p>
                </div>

                {row?.linked ? (
                  <span className="text-sm text-emerald-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Linked
                  </span>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <select
                      value={row?.financeAccountId ?? ''}
                      onChange={(e) => updateRow(tl.uid, { financeAccountId: e.target.value, error: null })}
                      className="text-sm px-2 py-1.5 border border-slate-300 rounded flex-1 min-w-[10rem] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select account…</option>
                      {availableFinanceAccounts.map((fa) => (
                        <option key={fa.id} value={fa.id}>
                          {fa.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleLink(tl.uid)}
                      disabled={row?.isLinking}
                      className="text-sm px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {row?.isLinking ? 'Linking…' : 'Link'}
                    </button>
                  </div>
                )}
              </div>
              {row?.error && <p className="text-xs text-red-600 mt-2">{row.error}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
