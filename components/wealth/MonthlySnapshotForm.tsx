'use client';

import { useState, useEffect, useCallback } from 'react';
import { EyeOff } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { MonthSwitcher } from '@/components/ui/MonthSwitcher';
import { EmptyState, Notice, SkeletonRows } from '@/components/ui/Notice';
import { useToast } from '@/components/ui/Toast';
import { formatGBP } from '@/lib/format';
import { addMonths, describeChange, monthKey, monthLabel, parseMonthParam } from './net-worth-helpers';

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
  /** null = no value entered; such accounts are never saved */
  balance: number | null;
  existingSnapshotId?: string;
  /** Balance already saved for this month, to detect changes */
  savedBalance?: number;
  previousBalance?: number; // Balance from previous month
  /** Pre-filled from last month and not yet edited */
  carried?: boolean;
}

/** Entries that need writing: new values, or saved values that changed. */
export function entriesToSave(entries: SnapshotEntry[]): SnapshotEntry[] {
  return entries.filter(
    (e) => e.balance !== null && (e.savedBalance === undefined || e.balance !== e.savedBalance)
  );
}

/** Total for the month and for last month (same accounts), and the change. */
export function monthTotals(entries: SnapshotEntry[]): { total: number; previousTotal: number | null; change: number | null } {
  const total = entries.reduce((sum, e) => sum + (e.balance ?? 0), 0);
  const withPrevious = entries.filter((e) => e.previousBalance !== undefined);
  if (withPrevious.length === 0) return { total, previousTotal: null, change: null };
  const previousTotal = withPrevious.reduce((sum, e) => sum + (e.previousBalance ?? 0), 0);
  return { total, previousTotal, change: total - previousTotal };
}

const TYPE_LABELS: Record<string, string> = {
  pension: 'Pension',
  isa: 'ISA',
  investment: 'Investment',
  savings: 'Savings',
  property: 'Property',
  current: 'Current',
  other: 'Other',
};

const TYPE_ORDER: Record<string, number> = { pension: 1, isa: 2, investment: 3, savings: 4, property: 5, current: 6, other: 7 };

interface MonthlySnapshotFormProps {
  onSaveComplete?: () => void;
  /** Month being edited (YYYY-MM). When given with onMonthChange the parent owns it (e.g. in the URL). */
  month?: string;
  onMonthChange?: (month: string) => void;
  /** Change this to refetch (e.g. after balances were edited elsewhere). */
  refreshKey?: number;
}

export function MonthlySnapshotForm({ onSaveComplete, month: monthProp, onMonthChange, refreshKey = 0 }: MonthlySnapshotFormProps) {
  const { toast } = useToast();
  const [ownMonth, setOwnMonth] = useState(() => monthKey(new Date()));
  const month = monthProp ? parseMonthParam(monthProp) : ownMonth;
  const setMonth = (m: string) => (onMonthChange ? onMonthChange(m) : setOwnMonth(m));
  const prevMonth = addMonths(month, -1);
  const currentMonth = monthKey(new Date());

  const [entries, setEntries] = useState<SnapshotEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExcluding, setIsExcluding] = useState<string | null>(null);
  const [confirmExclude, setConfirmExclude] = useState<SnapshotEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts and existing snapshots for the selected month
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch accounts that should be included in net worth
      const accountsRes = await fetch('/api/accounts?includeInNetWorth=true');
      if (!accountsRes.ok) throw new Error('Couldn’t load your accounts.');
      const accountsData = await accountsRes.json();
      const accounts: Account[] = accountsData.accounts || [];

      // Fetch existing snapshots for this month
      const dateStr = `${month}-01`;
      const snapshotsRes = await fetch(`/api/wealth-snapshots?start_date=${dateStr}&end_date=${dateStr}`);
      if (!snapshotsRes.ok) throw new Error('Couldn’t load this month’s balances.');
      const snapshotsData = await snapshotsRes.json();
      // Keep only this month's rows (the API filters too; this guards against a wider range).
      const snapshots = ((snapshotsData.snapshots || []) as { date?: string; account_id: string; id: string; balance: number }[]).filter((s) => !s.date || s.date.startsWith(dateStr));

      // Fetch previous month's snapshots
      const prevDateStr = `${prevMonth}-01`;
      const prevSnapshotsRes = await fetch(`/api/wealth-snapshots?start_date=${prevDateStr}&end_date=${prevDateStr}`);
      let prevSnapshots: { account_id: string; balance: number }[] = [];
      if (prevSnapshotsRes.ok) {
        const prevData = await prevSnapshotsRes.json();
        prevSnapshots = ((prevData.snapshots || []) as { date?: string; account_id: string; balance: number }[]).filter(
          (s) => !s.date || s.date.startsWith(prevDateStr)
        );
      }

      const snapshotMap = new Map<string, { id: string; balance: number }>(
        snapshots.map((s: { account_id: string; id: string; balance: number }) => [s.account_id, { id: s.id, balance: s.balance }])
      );
      const prevSnapshotMap = new Map<string, number>(
        prevSnapshots.map((s: { account_id: string; balance: number }) => [s.account_id, s.balance])
      );

      const newEntries: SnapshotEntry[] = accounts
        .filter((a: Account) => a.type !== 'credit') // Exclude credit cards
        .filter((a: Account) => !a.exclude_from_snapshots) // Exclude accounts marked to skip snapshots
        .map((account: Account) => {
          const existing = snapshotMap.get(account.id);
          const prevBalance = prevSnapshotMap.get(account.id);
          const previousBalance = prevBalance !== undefined ? Number(prevBalance) : undefined;
          // Never default to 0: an account with no value this month starts
          // from last month's balance, or stays blank (and unsaved).
          return {
            accountId: account.id,
            accountName: account.name,
            accountType: account.type,
            balance: existing ? Number(existing.balance) : previousBalance ?? null,
            existingSnapshotId: existing?.id,
            savedBalance: existing ? Number(existing.balance) : undefined,
            previousBalance,
            carried: !existing && previousBalance !== undefined,
          };
        })
        .sort((a: SnapshotEntry, b: SnapshotEntry) => {
          const aOrder = TYPE_ORDER[a.accountType] || 99;
          const bOrder = TYPE_ORDER[b.accountType] || 99;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.accountName.localeCompare(b.accountName);
        });

      setEntries(newEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, [month, prevMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleBalanceChange = (accountId: string, value: number | null) => {
    setEntries((prev) => prev.map((entry) => (entry.accountId === accountId ? { ...entry, balance: value, carried: false } : entry)));
  };

  const handleCopyFromPrevious = (accountId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.accountId === accountId && entry.previousBalance !== undefined
          ? { ...entry, balance: entry.previousBalance, carried: false }
          : entry
      )
    );
  };

  const handleCopyAllFromPrevious = () => {
    setEntries((prev) =>
      prev.map((entry) => (entry.previousBalance !== undefined ? { ...entry, balance: entry.previousBalance, carried: false } : entry))
    );
  };

  const setExcluded = async (accountId: string, exclude: boolean) => {
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exclude_from_snapshots: exclude }),
    });
    if (!res.ok) throw new Error(exclude ? 'Couldn’t hide the account. Try again.' : 'Couldn’t bring the account back. Try again.');
  };

  const handleExcludeAccount = async (entry: SnapshotEntry) => {
    setIsExcluding(entry.accountId);
    try {
      await setExcluded(entry.accountId, true);
      setEntries((prev) => prev.filter((e) => e.accountId !== entry.accountId));
      toast({
        message: `${entry.accountName} won't appear in monthly balances any more`,
        tone: 'success',
        action: {
          label: 'Undo',
          onClick: () => {
            setExcluded(entry.accountId, false)
              .then(fetchData)
              .catch((err) => toast({ message: err instanceof Error ? err.message : 'Undo failed', tone: 'error' }));
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t hide the account.');
    } finally {
      setIsExcluding(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const toSave = entriesToSave(entries);
      if (toSave.length === 0) {
        toast({ message: 'Nothing to save: no balances have changed' });
        return;
      }

      // One request for the whole month, so a failure can't leave it half-saved.
      const res = await fetch('/api/wealth-snapshots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: `${month}-01`,
          entries: toSave.map((e) => ({ account_id: e.accountId, balance: e.balance })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Couldn’t save the balances. Nothing was changed; try again.');
      }

      const created = toSave.filter((e) => !e.existingSnapshotId).length;
      const updated = toSave.length - created;
      const parts = [created > 0 && `${created} added`, updated > 0 && `${updated} updated`].filter(Boolean).join(', ');
      toast({ message: `Saved ${monthLabel(month)}: ${parts}`, tone: 'success' });

      // Refresh to get new IDs
      await fetchData();
      onSaveComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save the balances.');
    } finally {
      setIsSaving(false);
    }
  };

  const { total, change } = monthTotals(entries);
  const pendingCount = entriesToSave(entries).length;
  const hasPreviousData = entries.some((e) => e.previousBalance !== undefined);
  const prevLabel = monthLabel(prevMonth).split(' ')[0];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-[62ch] text-[14.5px] text-ink-2">
          {isLoading ? (
            <>Loading {monthLabel(month)}…</>
          ) : entries.length === 0 ? null : (
            <>
              Month-end balances for <strong className="font-semibold text-ink">{monthLabel(month)}</strong> add up to{' '}
              <strong className="fig font-semibold text-ink">{formatGBP(total)}</strong>
              {change !== null && (
                <>
                  , {Math.round(change) === 0 ? `the same as ${prevLabel}` : `${describeChange(change, (n) => formatGBP(n))} on ${prevLabel}`}
                </>
              )}
              .
            </>
          )}
        </div>
        <MonthSwitcher value={month} max={currentMonth} min="2000-01" align="end" size="md" onChange={setMonth} maxReason="month-end balances come after the month" />
      </div>

      {error && (
        <Notice tone="error" action={<Button size="sm" onClick={() => setError(null)}>Dismiss</Button>}>
          {error}
        </Notice>
      )}

      <div className="rounded-[3px] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 px-4 py-2.5">
          <h2 className="text-[13.5px] font-semibold text-ink">Accounts</h2>
          {!isLoading && hasPreviousData && (
            <Button size="sm" variant="ghost" onClick={handleCopyAllFromPrevious}>
              Copy all from {prevLabel}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState title="No accounts to enter">
            Every account is either hidden from monthly balances or not counted in net worth. Change this on the Accounts page.
          </EmptyState>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_8rem_10rem_2rem] gap-3 border-b border-line-2 px-4 py-1.5 text-[11.5px] text-ink-3 sm:grid">
              <span>Account</span>
              <span className="text-right">{prevLabel}</span>
              <span className="text-right">{monthLabel(month).split(' ')[0]}</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y divide-line-2">
              {entries.map((entry) => {
                const dirty = entry.balance !== null && entry.savedBalance !== undefined && entry.balance !== entry.savedBalance;
                return (
                  <li
                    key={entry.accountId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_2rem]"
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                      <span className="truncate text-sm text-ink">{entry.accountName}</span>
                      <Chip>{TYPE_LABELS[entry.accountType] ?? entry.accountType}</Chip>
                      {dirty && <span className="text-[11.5px] text-warn">changed</span>}
                    </div>
                    <div className="text-left sm:text-right">
                      {entry.previousBalance !== undefined ? (
                        <button
                          type="button"
                          onClick={() => handleCopyFromPrevious(entry.accountId)}
                          className="fig whitespace-nowrap rounded-sm text-[12.5px] text-ink-3 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                          title={`Use ${prevLabel}'s balance`}
                          aria-label={`Use ${prevLabel}'s balance for ${entry.accountName}: ${formatGBP(entry.previousBalance, { pence: true })}`}
                        >
                          <span className="font-sans sm:hidden">{prevLabel.slice(0, 3)} </span>
                          {formatGBP(entry.previousBalance)}
                        </button>
                      ) : (
                        <span className="text-[12.5px] text-ink-3">
                          <span className="sm:hidden">{prevLabel.slice(0, 3)} </span>none
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2 sm:contents">
                      <MoneyInput
                        value={entry.balance}
                        onChange={(v) => handleBalanceChange(entry.accountId, v)}
                        size="sm"
                        align="right"
                        placeholder="–"
                        label={`${entry.accountName} balance`}
                        title={entry.carried ? `Carried over from ${prevLabel}` : undefined}
                        className="w-40 sm:w-auto"
                        inputClassName={entry.carried ? 'border-dashed text-ink-3' : ''}
                      />
                      <button
                        type="button"
                        onClick={() => setConfirmExclude(entry)}
                        disabled={isExcluding === entry.accountId}
                        className="grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                        title="Hide from monthly balances"
                        aria-label={`Hide ${entry.accountName} from monthly balances`}
                      >
                        <EyeOff className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
              <p className="text-[12.5px] text-ink-3">
                {entries.some((e) => e.carried)
                  ? `Dashed boxes are carried over from ${prevLabel}. They're saved with this month unless you clear them.`
                  : 'Only balances you change are saved.'}
              </p>
              <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={pendingCount === 0}>
                {isSaving ? 'Saving…' : pendingCount === 0 ? 'No changes' : `Save ${pendingCount} balance${pendingCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmExclude !== null}
        title="Hide this account from monthly balances?"
        message={`${confirmExclude?.accountName ?? 'This account'} will no longer appear here. Its saved balances are kept, and you can undo this straight away.`}
        confirmLabel="Hide account"
        variant="warning"
        onConfirm={() => {
          const target = confirmExclude;
          setConfirmExclude(null);
          if (target) handleExcludeAccount(target);
        }}
        onCancel={() => setConfirmExclude(null)}
      />
    </div>
  );
}
