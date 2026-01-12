'use client';

import { useState, useEffect, useCallback } from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  exclude_from_snapshots: boolean | null;
}

interface SnapshotEntry {
  accountId: string;
  accountName: string;
  accountType: string;
  balance: number;
  existingSnapshotId?: string;
  previousBalance?: number; // Balance from previous month
}

interface MonthlySnapshotFormProps {
  onSaveComplete?: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MonthlySnapshotForm({ onSaveComplete }: MonthlySnapshotFormProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<SnapshotEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExcluding, setIsExcluding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate previous month/year
  const getPreviousMonth = useCallback(() => {
    if (month === 1) {
      return { month: 12, year: year - 1 };
    }
    return { month: month - 1, year };
  }, [month, year]);

  // Fetch accounts and existing snapshots for the selected month
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Fetch accounts that should be included in net worth
      const accountsRes = await fetch('/api/accounts?includeInNetWorth=true');
      if (!accountsRes.ok) throw new Error('Failed to fetch accounts');
      const accountsData = await accountsRes.json();
      const accounts: Account[] = accountsData.accounts || [];

      // Fetch existing snapshots for this month
      const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const snapshotsRes = await fetch(`/api/wealth-snapshots?start_date=${dateStr}&end_date=${dateStr}`);
      if (!snapshotsRes.ok) throw new Error('Failed to fetch snapshots');
      const snapshotsData = await snapshotsRes.json();
      const snapshots = snapshotsData.snapshots || [];

      // Fetch previous month's snapshots
      const prev = getPreviousMonth();
      const prevDateStr = `${prev.year}-${String(prev.month).padStart(2, '0')}-01`;
      const prevSnapshotsRes = await fetch(`/api/wealth-snapshots?start_date=${prevDateStr}&end_date=${prevDateStr}`);
      let prevSnapshots: { account_id: string; balance: number }[] = [];
      if (prevSnapshotsRes.ok) {
        const prevData = await prevSnapshotsRes.json();
        prevSnapshots = prevData.snapshots || [];
      }

      // Map accounts to entries with existing balances
      const snapshotMap = new Map<string, { id: string; balance: number }>(
        snapshots.map((s: { account_id: string; id: string; balance: number }) => [
          s.account_id,
          { id: s.id, balance: s.balance }
        ])
      );

      const prevSnapshotMap = new Map<string, number>(
        prevSnapshots.map((s: { account_id: string; balance: number }) => [
          s.account_id,
          s.balance
        ])
      );

      const newEntries: SnapshotEntry[] = accounts
        .filter((a: Account) => a.type !== 'credit') // Exclude credit cards
        .filter((a: Account) => !a.exclude_from_snapshots) // Exclude accounts marked to skip snapshots
        .map((account: Account) => {
          const existing = snapshotMap.get(account.id);
          const prevBalance = prevSnapshotMap.get(account.id);
          return {
            accountId: account.id,
            accountName: account.name,
            accountType: account.type,
            balance: existing ? Number(existing.balance) : 0,
            existingSnapshotId: existing?.id,
            previousBalance: prevBalance !== undefined ? Number(prevBalance) : undefined,
          };
        })
        .sort((a: SnapshotEntry, b: SnapshotEntry) => {
          // Sort by type, then name
          const typeOrder: Record<string, number> = { pension: 1, isa: 2, investment: 3, savings: 4, property: 5, current: 6, other: 7 };
          const aOrder = typeOrder[a.accountType] || 99;
          const bOrder = typeOrder[b.accountType] || 99;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.accountName.localeCompare(b.accountName);
        });

      setEntries(newEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [year, month, getPreviousMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBalanceChange = (accountId: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setEntries(prev =>
      prev.map(entry =>
        entry.accountId === accountId
          ? { ...entry, balance: isNaN(numValue) ? entry.balance : numValue }
          : entry
      )
    );
  };

  const handleCopyFromPrevious = (accountId: string) => {
    setEntries(prev =>
      prev.map(entry =>
        entry.accountId === accountId && entry.previousBalance !== undefined
          ? { ...entry, balance: entry.previousBalance }
          : entry
      )
    );
  };

  const handleCopyAllFromPrevious = () => {
    setEntries(prev =>
      prev.map(entry =>
        entry.previousBalance !== undefined
          ? { ...entry, balance: entry.previousBalance }
          : entry
      )
    );
  };

  const handleExcludeAccount = async (accountId: string) => {
    setIsExcluding(accountId);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exclude_from_snapshots: true }),
      });

      if (!res.ok) throw new Error('Failed to exclude account');

      // Remove from entries list
      setEntries(prev => prev.filter(e => e.accountId !== accountId));
      setSuccessMessage('Account excluded from snapshots');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to exclude account');
    } finally {
      setIsExcluding(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      let created = 0;
      let updated = 0;

      for (const entry of entries) {
        if (entry.existingSnapshotId) {
          // Update existing snapshot
          const res = await fetch(`/api/wealth-snapshots/${entry.existingSnapshotId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance: entry.balance }),
          });
          if (!res.ok) throw new Error(`Failed to update ${entry.accountName}`);
          updated++;
        } else {
          // Create new snapshot
          const res = await fetch('/api/wealth-snapshots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: entry.accountId,
              date: dateStr,
              balance: entry.balance,
            }),
          });
          if (!res.ok) throw new Error(`Failed to create snapshot for ${entry.accountName}`);
          created++;
        }
      }

      setSuccessMessage(`Saved ${MONTH_NAMES[month - 1]} ${year}: ${created} created, ${updated} updated`);

      // Refresh to get new IDs
      await fetchData();

      if (onSaveComplete) {
        onSaveComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const totalBalance = entries.reduce((sum, e) => sum + e.balance, 0);
  const hasPreviousData = entries.some(e => e.previousBalance !== undefined);
  const prev = getPreviousMonth();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pension: 'Pension',
      isa: 'ISA',
      investment: 'Investment',
      savings: 'Savings',
      property: 'Property',
      current: 'Current',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      pension: 'bg-indigo-100 text-indigo-700',
      isa: 'bg-purple-100 text-purple-700',
      investment: 'bg-emerald-100 text-emerald-700',
      savings: 'bg-blue-100 text-blue-700',
      property: 'bg-red-100 text-red-700',
      current: 'bg-amber-100 text-amber-700',
      other: 'bg-slate-100 text-slate-700',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  // Generate year options (current year and 10 years back)
  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Monthly Snapshot Entry</h2>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {/* Copy from previous month button */}
      {!isLoading && hasPreviousData && (
        <div className="mb-4">
          <button
            onClick={handleCopyAllFromPrevious}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
          >
            Copy all from {MONTH_NAMES[prev.month - 1]}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse flex items-center gap-4">
              <div className="h-4 bg-slate-200 rounded w-32"></div>
              <div className="h-8 bg-slate-200 rounded w-40 ml-auto"></div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p>No accounts to show.</p>
          <p className="text-sm mt-1">All accounts are either excluded from snapshots or not included in net worth.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {entries.map(entry => (
              <div
                key={entry.accountId}
                className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
              >
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(entry.accountType)}`}>
                  {getTypeLabel(entry.accountType)}
                </span>
                <span className="flex-1 text-sm text-slate-700">{entry.accountName}</span>

                {/* Previous month value indicator - clickable to copy */}
                {entry.previousBalance !== undefined && (
                  <button
                    onClick={() => handleCopyFromPrevious(entry.accountId)}
                    className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                    title={`Copy from ${MONTH_NAMES[prev.month - 1]}: ${formatCurrency(entry.previousBalance)}`}
                  >
                    {formatCurrency(entry.previousBalance)}
                  </button>
                )}

                <div className="flex items-center gap-1">
                  <span className="text-slate-500">£</span>
                  <input
                    type="number"
                    value={entry.balance || ''}
                    onChange={(e) => handleBalanceChange(entry.accountId, e.target.value)}
                    placeholder="0"
                    className="w-28 px-3 py-1.5 border border-slate-300 rounded-md text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Exclude button */}
                <button
                  onClick={() => handleExcludeAccount(entry.accountId)}
                  disabled={isExcluding === entry.accountId}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Exclude from snapshots"
                >
                  {isExcluding === entry.accountId ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-500">Total Net Worth</span>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalBalance)}</p>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Snapshots'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
