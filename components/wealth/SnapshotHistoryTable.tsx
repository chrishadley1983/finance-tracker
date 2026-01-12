'use client';

import { useState, useEffect, useCallback } from 'react';

interface Snapshot {
  id: string;
  date: string;
  balance: number;
  account: {
    id: string;
    name: string;
    type: string;
  };
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface MonthlyData {
  date: string;
  displayDate: string;
  accounts: Record<string, { snapshotId: string; balance: number } | null>;
  total: number;
  change: number | null;
  changePercent: number | null;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function SnapshotHistoryTable() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ date: string; accountId: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch accounts
      const accountsRes = await fetch('/api/accounts?includeInNetWorth=true');
      if (!accountsRes.ok) throw new Error('Failed to fetch accounts');
      const accountsData = await accountsRes.json();
      const fetchedAccounts: Account[] = (accountsData.accounts || [])
        .filter((a: Account) => a.type !== 'credit' && a.type !== 'current')
        .sort((a: Account, b: Account) => {
          const typeOrder: Record<string, number> = { pension: 1, isa: 2, investment: 3, savings: 4, property: 5, current: 6, other: 7 };
          const aOrder = typeOrder[a.type] || 99;
          const bOrder = typeOrder[b.type] || 99;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name);
        });
      setAccounts(fetchedAccounts);

      // Fetch all snapshots
      const snapshotsRes = await fetch('/api/wealth-snapshots');
      if (!snapshotsRes.ok) throw new Error('Failed to fetch snapshots');
      const snapshotsData = await snapshotsRes.json();
      const snapshots: Snapshot[] = snapshotsData.snapshots || [];

      // Group snapshots by month
      const monthMap = new Map<string, Map<string, { snapshotId: string; balance: number }>>();

      for (const snapshot of snapshots) {
        const monthKey = snapshot.date.substring(0, 7); // YYYY-MM
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, new Map());
        }
        monthMap.get(monthKey)!.set(snapshot.account.id, {
          snapshotId: snapshot.id,
          balance: Number(snapshot.balance),
        });
      }

      // Convert to sorted array
      const sortedMonths = Array.from(monthMap.keys()).sort().reverse();

      let previousTotal: number | null = null;
      const data: MonthlyData[] = sortedMonths.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const accountData = monthMap.get(monthKey)!;

        const accountsRecord: Record<string, { snapshotId: string; balance: number } | null> = {};
        let total = 0;

        for (const account of fetchedAccounts) {
          const snapshot = accountData.get(account.id);
          accountsRecord[account.id] = snapshot || null;
          if (snapshot) {
            total += snapshot.balance;
          }
        }

        const change = previousTotal !== null ? total - previousTotal : null;
        const changePercent = previousTotal !== null && previousTotal !== 0
          ? ((total - previousTotal) / previousTotal) * 100
          : null;

        previousTotal = total;

        return {
          date: `${monthKey}-01`,
          displayDate: `${MONTH_NAMES[parseInt(month) - 1]} ${year}`,
          accounts: accountsRecord,
          total,
          change,
          changePercent,
        };
      });

      // Reverse change calculation (we want change from previous month, not to previous)
      // The data is sorted newest first, so we need to flip the change signs
      for (let i = 0; i < data.length - 1; i++) {
        const currentTotal = data[i].total;
        const previousMonthTotal = data[i + 1].total;
        data[i].change = currentTotal - previousMonthTotal;
        data[i].changePercent = previousMonthTotal !== 0
          ? ((currentTotal - previousMonthTotal) / previousMonthTotal) * 100
          : null;
      }
      if (data.length > 0) {
        data[data.length - 1].change = null;
        data[data.length - 1].changePercent = null;
      }

      setMonthlyData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleCellClick = (date: string, accountId: string, currentBalance: number | null) => {
    setEditingCell({ date, accountId });
    setEditValue(currentBalance?.toString() || '');
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    const monthData = monthlyData.find(m => m.date === editingCell.date);
    if (!monthData) return;

    const existingSnapshot = monthData.accounts[editingCell.accountId];
    const newBalance = parseFloat(editValue) || 0;

    try {
      if (existingSnapshot) {
        // Update existing
        await fetch(`/api/wealth-snapshots/${existingSnapshot.snapshotId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balance: newBalance }),
        });
      } else {
        // Create new
        await fetch('/api/wealth-snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: editingCell.accountId,
            date: editingCell.date,
            balance: newBalance,
          }),
        });
      }

      setEditingCell(null);
      await fetchData();
    } catch {
      setError('Failed to save snapshot');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-48"></div>
          <div className="h-64 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Snapshot History</h2>
        <p className="text-sm text-slate-500 mt-1">Click any cell to edit. Press Enter to save, Escape to cancel.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="w-24 px-3 py-2 text-left font-medium text-slate-600 sticky left-0 bg-slate-50 z-10">Month</th>
              {accounts.map(account => (
                <th key={account.id} className="w-28 px-3 py-2 text-center font-medium text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">
                  {account.name}
                </th>
              ))}
              <th className="w-28 px-3 py-2 text-center font-medium text-slate-900 bg-slate-100">Total</th>
              <th className="w-24 px-3 py-2 text-center font-medium text-slate-600">Change</th>
              <th className="w-16 px-3 py-2 text-center font-medium text-slate-600">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {monthlyData.map(row => (
              <tr key={row.date} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                  {row.displayDate}
                </td>
                {accounts.map(account => {
                  const snapshot = row.accounts[account.id];
                  const isEditing = editingCell?.date === row.date && editingCell?.accountId === account.id;

                  return (
                    <td
                      key={account.id}
                      className="px-3 py-2 text-center cursor-pointer hover:bg-blue-50"
                      onClick={() => handleCellClick(row.date, account.id, snapshot?.balance || null)}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          className="w-24 px-2 py-1 text-right border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : snapshot ? (
                        <span className="text-slate-600">{formatCurrency(snapshot.balance)}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-semibold text-slate-900 bg-slate-50">
                  {formatCurrency(row.total)}
                </td>
                <td className={`px-3 py-2 text-center ${
                  row.change === null ? 'text-slate-300' :
                  row.change >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {row.change !== null ? (
                    <>
                      {row.change >= 0 ? '+' : ''}{formatCurrency(row.change)}
                    </>
                  ) : '-'}
                </td>
                <td className={`px-3 py-2 text-center ${
                  row.changePercent === null ? 'text-slate-300' :
                  row.changePercent >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {row.changePercent !== null ? (
                    <>
                      {row.changePercent >= 0 ? '+' : ''}{row.changePercent.toFixed(1)}%
                    </>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
