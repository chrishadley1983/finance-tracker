'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { formatGBP, MONTH_SHORT } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { EmptyState, Notice, SkeletonRows } from '@/components/ui/Notice';
import { useToast } from '@/components/ui/Toast';

interface Snapshot {
  id: string;
  account_id?: string;
  date: string;
  balance: number;
  account: {
    id: string;
    name: string;
    type: string;
  } | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

export interface MonthlyData {
  date: string;
  displayDate: string;
  accounts: Record<string, { snapshotId: string; balance: number } | null>;
  total: number;
  change: number | null;
  changePercent: number | null;
}

const TYPE_ORDER: Record<string, number> = { pension: 1, isa: 2, investment: 3, savings: 4, property: 5, current: 6, other: 7 };

/**
 * Pivot snapshots into one row per month (newest first) with the change on the
 * month before, counting only accounts recorded in both months.
 */
export function buildMonthlyRows(snapshots: Snapshot[], accounts: Account[]): MonthlyData[] {
  const monthMap = new Map<string, Map<string, { snapshotId: string; balance: number }>>();
  for (const snapshot of snapshots) {
    const key = snapshot.date.substring(0, 7);
    if (!monthMap.has(key)) monthMap.set(key, new Map());
    const accountId = snapshot.account_id ?? snapshot.account?.id;
    if (!accountId) continue;
    monthMap.get(key)!.set(accountId, { snapshotId: snapshot.id, balance: Number(snapshot.balance) });
  }

  const rows: MonthlyData[] = Array.from(monthMap.keys())
    .sort()
    .reverse()
    .map((key) => {
      const [year, month] = key.split('-');
      const accountData = monthMap.get(key)!;
      const record: MonthlyData['accounts'] = {};
      let total = 0;
      for (const account of accounts) {
        const s = accountData.get(account.id);
        record[account.id] = s || null;
        if (s) total += s.balance;
      }
      return { date: `${key}-01`, displayDate: `${MONTH_SHORT[parseInt(month) - 1]} ${year}`, accounts: record, total, change: null, changePercent: null };
    });

  // Like for like: only accounts with a balance in both months count, so a
  // month still being filled in doesn't read as a huge drop.
  for (let i = 0; i < rows.length - 1; i++) {
    let now = 0;
    let before = 0;
    let shared = 0;
    for (const account of accounts) {
      const a = rows[i].accounts[account.id];
      const b = rows[i + 1].accounts[account.id];
      if (!a || !b) continue;
      now += a.balance;
      before += b.balance;
      shared++;
    }
    if (shared === 0) continue;
    rows[i].change = now - before;
    rows[i].changePercent = before !== 0 ? ((now - before) / before) * 100 : null;
  }
  return rows;
}

function ChangeText({ change, pct }: { change: number | null; pct: number | null }) {
  if (change === null) return <span className="text-ink-3">–</span>;
  const rounded = Math.round(change);
  return (
    <span className={rounded > 0 ? 'text-in' : 'text-ink-2'} title={pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : undefined}>
      {formatGBP(change, { signed: true })}
    </span>
  );
}

/** "3 of 8" when a month has fewer balances than there are accounts, so a low total isn't mistaken for a drop. */
function Partial({ row, count }: { row: MonthlyData; count: number }) {
  const filled = Object.values(row.accounts).filter(Boolean).length;
  if (filled >= count) return null;
  return (
    <span className="ml-1.5 text-[11.5px] font-normal text-warn" title={`${filled} of ${count} accounts have a balance for this month`}>
      {filled} of {count}
    </span>
  );
}

interface SnapshotHistoryTableProps {
  /** Change this to refetch (e.g. after balances are saved on another tab). */
  refreshKey?: number;
  /** Called after a cell edit is saved. */
  onChange?: () => void;
  /** Link for a month row, e.g. to the Monthly balances tab. */
  monthHref?: (month: string) => string;
}

export function SnapshotHistoryTable({ refreshKey = 0, onChange, monthHref }: SnapshotHistoryTableProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ date: string; accountId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const loaded = useRef(false);

  const fetchData = useCallback(async () => {
    if (!loaded.current) setIsLoading(true);
    setError(null);
    try {
      const accountsRes = await fetch('/api/accounts?includeInNetWorth=true');
      if (!accountsRes.ok) throw new Error('Couldn’t load your accounts.');
      const accountsData = await accountsRes.json();
      const fetchedAccounts: Account[] = (accountsData.accounts || [])
        .filter((a: Account) => a.type !== 'credit' && a.type !== 'current')
        .sort((a: Account, b: Account) => {
          const ao = TYPE_ORDER[a.type] || 99;
          const bo = TYPE_ORDER[b.type] || 99;
          return ao !== bo ? ao - bo : a.name.localeCompare(b.name);
        });

      const snapshotsRes = await fetch('/api/wealth-snapshots');
      if (!snapshotsRes.ok) throw new Error('Couldn’t load saved balances.');
      const snapshotsData = await snapshotsRes.json();
      setAccounts(fetchedAccounts);
      setMonthlyData(buildMonthlyRows(snapshotsData.snapshots || [], fetchedAccounts));
      loaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const startEdit = (date: string, accountId: string, current: number | null) => {
    setEditingCell({ date, accountId });
    setEditValue(current === null ? '' : String(current));
  };

  const handleCellSave = async () => {
    if (!editingCell || savingCell) return;
    const cell = editingCell;
    const row = monthlyData.find((m) => m.date === cell.date);
    if (!row) return;
    const existing = row.accounts[cell.accountId];
    // A blank or unreadable value cancels the edit; it never writes £0.
    const newBalance = editValue.trim() === '' ? NaN : Number(editValue);
    if (!Number.isFinite(newBalance) || (existing && existing.balance === newBalance)) {
      setEditingCell(null);
      return;
    }

    setSavingCell(true);
    try {
      const res = existing
        ? await fetch(`/api/wealth-snapshots/${existing.snapshotId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance: newBalance }),
          })
        : await fetch('/api/wealth-snapshots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_id: cell.accountId, date: cell.date, balance: newBalance }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'The balance wasn’t saved. Try again.');
      }
      setEditingCell(null);
      toast({ message: `Saved ${row.displayDate}`, tone: 'success' });
      await fetchData();
      onChange?.();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'The balance wasn’t saved.', tone: 'error' });
    } finally {
      setSavingCell(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellSave();
    else if (e.key === 'Escape') setEditingCell(null);
  };

  if (isLoading) return <SkeletonRows rows={8} />;

  if (error) {
    return (
      <Notice tone="error" action={<Button size="sm" onClick={fetchData}>Try again</Button>}>
        {error}
      </Notice>
    );
  }

  if (monthlyData.length === 0) {
    return (
      <EmptyState title="No month-end balances yet" action={monthHref && <Link href={monthHref('')} className="text-sm text-accent underline-offset-2 hover:underline">Enter this month&apos;s balances</Link>}>
        Each month you record appears here as a row, with the change on the month before.
      </EmptyState>
    );
  }

  const cell = (row: MonthlyData, account: Account) => {
    const snapshot = row.accounts[account.id];
    const isEditing = editingCell?.date === row.date && editingCell?.accountId === account.id;
    if (isEditing) {
      return (
        <input
          type="number"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCellSave}
          onKeyDown={handleKeyDown}
          disabled={savingCell}
          aria-label={`${account.name}, ${row.displayDate}`}
          className="fig w-full min-w-[6.5rem] rounded-md border border-accent bg-surface px-2 py-1 text-right text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          autoFocus
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => startEdit(row.date, account.id, snapshot ? snapshot.balance : null)}
        aria-label={`Edit ${account.name}, ${row.displayDate}: ${snapshot ? formatGBP(snapshot.balance, { pence: true }) : 'no balance'}`}
        className="fig w-full rounded-sm px-1 py-0.5 text-right text-ink-2 hover:bg-sel hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        {snapshot ? formatGBP(snapshot.balance) : <span className="text-ink-3">–</span>}
      </button>
    );
  };

  return (
    <div className="grid gap-3">
      <p className="text-[14.5px] text-ink-2">
        <strong className="font-semibold text-ink">{monthlyData.length}</strong> months recorded. Select any balance to correct it; Enter saves, Esc cancels. A count such as
        &ldquo;3 of 8&rdquo; next to a month means some balances are missing; its change compares only the accounts recorded in both months.
        <span className="text-ink-3"> Current accounts aren&apos;t shown here: their balances come from transactions.</span>
      </p>

      {/* Desktop: the full grid */}
      <div className="hidden overflow-x-auto rounded-[3px] border border-line bg-surface md:block">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line bg-sunk text-[11.5px] text-ink-3">
              <th scope="col" className="sticky left-0 z-10 bg-sunk px-3 py-2 text-left font-medium">Month</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">Total</th>
              <th scope="col" className="border-r border-line-2 px-3 py-2 text-right font-medium">Change</th>
              {accounts.map((a) => (
                <th key={a.id} scope="col" className="max-w-[9rem] truncate px-2 py-2 text-right font-medium" title={a.name}>
                  {a.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-2">
            {monthlyData.map((row) => (
              <tr key={row.date} className="hover:bg-sunk">
                <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 text-left font-medium text-ink">
                  {monthHref ? (
                    <Link href={monthHref(row.date.slice(0, 7))} className="hover:text-accent hover:underline underline-offset-2">
                      {row.displayDate}
                    </Link>
                  ) : (
                    row.displayDate
                  )}
                  <Partial row={row} count={accounts.length} />
                </th>
                <td className="fig whitespace-nowrap px-3 py-1.5 text-right font-medium text-ink">{formatGBP(row.total)}</td>
                <td className="fig whitespace-nowrap border-r border-line-2 px-3 py-1.5 text-right">
                  <ChangeText change={row.change} pct={row.changePercent} />
                </td>
                {accounts.map((a) => (
                  <td key={a.id} className="px-1 py-1">
                    {cell(row, a)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: one stacked row per month, opening to the accounts */}
      <ul className="divide-y divide-line-2 rounded-[3px] border border-line bg-surface md:hidden">
        {monthlyData.map((row) => (
          <li key={row.date}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-medium text-ink">
                  {row.displayDate}
                  <Partial row={row} count={accounts.length} />
                </span>
                <span className="text-right">
                  <span className="fig block text-sm text-ink">{formatGBP(row.total)}</span>
                  <span className="fig block text-[12px]">
                    <ChangeText change={row.change} pct={row.changePercent} />
                  </span>
                </span>
              </summary>
              <ul className="grid gap-1 border-t border-line-2 bg-sunk px-3 py-2">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate text-ink-2">{a.name}</span>
                    <span className="w-32 shrink-0">{cell(row, a)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
