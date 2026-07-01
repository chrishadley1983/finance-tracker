'use client';

import { useState } from 'react';

interface EbAccountOption {
  uid: string;
  name: string;
  product: string | null;
  currency: string | null;
  iban: string | null;
}

interface FinanceAccountOption {
  id: string;
  name: string;
  type: string;
  enable_banking_account_uid: string | null;
}

interface AccountLinkPanelProps {
  sessionRowId: string;
  aspsp: string | null;
  ebAccounts: EbAccountOption[];
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
 * Renders one row per Enable Banking account returned on the session and lets
 * the user map it onto one of their Finance Tracker accounts.
 */
export function AccountLinkPanel({
  sessionRowId,
  aspsp,
  ebAccounts,
  financeAccounts,
  onLinked,
}: AccountLinkPanelProps) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      ebAccounts.map((eb) => [eb.uid, { financeAccountId: '', isLinking: false, error: null, linked: false }])
    )
  );

  const updateRow = (uid: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [uid]: { ...prev[uid], ...patch } }));
  };

  const handleLink = async (ebAccountUid: string) => {
    const row = rows[ebAccountUid];
    if (!row?.financeAccountId) {
      updateRow(ebAccountUid, { error: 'Choose an account to link' });
      return;
    }

    updateRow(ebAccountUid, { isLinking: true, error: null });
    try {
      const response = await fetch('/api/enable-banking/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionRowId,
          financeAccountId: row.financeAccountId,
          ebAccountUid,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to link account');
      }
      updateRow(ebAccountUid, { isLinking: false, linked: true });
      onLinked();
    } catch (err) {
      updateRow(ebAccountUid, {
        isLinking: false,
        error: err instanceof Error ? err.message : 'Failed to link account',
      });
    }
  };

  if (ebAccounts.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          No accounts were returned by {aspsp || 'your bank'}. Try reconnecting.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-emerald-900">Connected to {aspsp || 'your bank'}</h3>
        <p className="text-sm text-emerald-700 mt-0.5">
          Choose which Finance Tracker account each bank account maps to.
        </p>
      </div>

      <div className="space-y-3">
        {ebAccounts.map((eb) => {
          const row = rows[eb.uid];
          // Hide accounts already linked to a *different* EB account.
          const availableFinanceAccounts = financeAccounts.filter(
            (fa) => !fa.enable_banking_account_uid || fa.enable_banking_account_uid === eb.uid
          );

          return (
            <div key={eb.uid} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[10rem]">
                  <p className="text-sm font-medium text-slate-900">{eb.name}</p>
                  <p className="text-xs text-slate-500">
                    {[eb.product, eb.currency, eb.iban].filter(Boolean).join(' • ') || 'Bank account'}
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
                      onChange={(e) => updateRow(eb.uid, { financeAccountId: e.target.value, error: null })}
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
                      onClick={() => handleLink(eb.uid)}
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
