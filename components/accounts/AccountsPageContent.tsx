'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Account, AccountWithStats, CreateAccountInput, UpdateAccountInput } from '@/lib/types/account';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, Notice, SkeletonRows } from '@/components/ui/Notice';
import { PageIntro } from '@/components/ui/PageIntro';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/Toast';
import { RowMenu } from '@/components/dialogs/RowMenu';
import { WealthSnapshotModal } from '@/components/wealth';
import { formatDateGB, formatGBP } from '@/lib/format';
import { AccountDialog } from './AccountDialog';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ReallocateDialog } from './ReallocateDialog';
import { TRANSACTION_TYPES, daysSince, groupByType, ledeParts, moveWithinType, relativeTime } from './account-helpers';

export interface SyncStatus {
  id: string;
  linked: boolean;
  syncEnabled: boolean | null;
  lastSyncAt: string | null;
  connectionActive: boolean;
  needsReconsent: boolean;
}

const STALE_DAYS = 30;

function balanceNote(a: AccountWithStats, sync?: SyncStatus): string | null {
  // A working bank link is plain text, not a chip: only problems get a chip.
  if (sync?.linked && sync.syncEnabled !== false && !sync.needsReconsent) {
    return sync.lastSyncAt ? `Bank sync · synced ${relativeTime(sync.lastSyncAt)}` : 'Bank sync · not synced yet';
  }
  if (a.balanceSource === 'snapshot' || a.balanceSource === 'valuation') {
    return a.snapshotDate ? `as of ${formatDateGB(a.snapshotDate)}` : null;
  }
  if (a.latestTransaction) return `as of ${formatDateGB(a.latestTransaction)}`;
  return null;
}

function isStale(a: AccountWithStats): boolean {
  const ref = TRANSACTION_TYPES.includes(a.type) && a.latestTransaction ? a.latestTransaction : a.snapshotDate;
  const days = daysSince(ref);
  return days !== null && days > STALE_DAYS;
}

function StatusChips({ a, sync }: { a: AccountWithStats; sync?: SyncStatus }) {
  return (
    <span className="flex flex-wrap justify-end gap-1 md:justify-start">
      {a.is_archived && <Chip>Archived</Chip>}
      {sync?.needsReconsent && <Chip tone="bad">Reconnect bank</Chip>}
      {!a.is_archived && a.balanceSource !== 'none' && !sync?.linked && isStale(a) && <Chip tone="warn">Out of date</Chip>}
      {a.balanceSource === 'none' && <Chip>No balance yet</Chip>}
      {a.include_in_net_worth === false && <Chip>Not in net worth</Chip>}
    </span>
  );
}

export function AccountsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();
  const showArchived = params?.get('archived') === '1';

  const [accounts, setAccounts] = useState<AccountWithStats[]>([]);
  const [sync, setSync] = useState<Map<string, SyncStatus>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const focusAfterMove = useRef<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<AccountWithStats | null>(null);
  const [deleting, setDeleting] = useState<AccountWithStats | null>(null);
  const [reallocating, setReallocating] = useState<AccountWithStats | null>(null);
  const [snapshotFor, setSnapshotFor] = useState<AccountWithStats | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/accounts?includeArchived=true');
      if (!res.ok) throw new Error('Could not load accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load accounts');
    } finally {
      setLoaded(true);
    }
  }, []);

  const fetchSync = useCallback(async () => {
    try {
      const res = await fetch('/api/truelayer/status');
      if (!res.ok) return;
      const data = await res.json();
      setSync(new Map(((data.accounts ?? []) as SyncStatus[]).map((s) => [s.id, s])));
    } catch {
      // Sync status is extra detail; the list works without it.
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchSync();
  }, [fetchAccounts, fetchSync]);

  // Keep focus on the move button that was used, after the row changes place.
  useEffect(() => {
    const key = focusAfterMove.current;
    if (!key) return;
    focusAfterMove.current = null;
    const el = document.querySelector<HTMLButtonElement>(`[data-move="${key}"]`);
    if (el && !el.disabled) el.focus();
    else document.querySelector<HTMLButtonElement>(`[data-move="${key.replace(/:(up|down)$/, (_m, d) => (d === 'up' ? ':down' : ':up'))}"]`)?.focus();
  }, [accounts]);

  const setArchived = (on: boolean) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (on) next.set('archived', '1');
    else next.delete('archived');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const archivedCount = accounts.filter((a) => a.is_archived).length;
  const visible = useMemo(() => accounts.filter((a) => showArchived || !a.is_archived), [accounts, showArchived]);
  const groups = useMemo(() => groupByType(visible), [visible]);
  const lede = useMemo(() => ledeParts(accounts), [accounts]);

  const sendJson = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Request failed');
    }
    return res;
  };

  const handleCreate = async (data: CreateAccountInput | UpdateAccountInput) => {
    setIsSaving(true);
    try {
      await sendJson('/api/accounts', 'POST', data);
      await fetchAccounts();
      toast({ tone: 'success', message: `Added ${data.name}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: CreateAccountInput | UpdateAccountInput) => {
    if (!editing) return;
    setIsSaving(true);
    try {
      await sendJson(`/api/accounts/${editing.id}`, 'PATCH', data);
      await fetchAccounts();
      toast({ tone: 'success', message: 'Account saved' });
      setEditing(null);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAccount = async (account: AccountWithStats, force: boolean) => {
    setIsSaving(true);
    try {
      await sendJson(`/api/accounts/${account.id}${force ? '?force=true' : ''}`, 'DELETE');
      await fetchAccounts();
      toast({ message: `Deleted ${account.name}` });
      setDeleting(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReallocate = async (targetAccountId: string) => {
    if (!reallocating) return;
    setIsSaving(true);
    try {
      await sendJson(`/api/accounts/${reallocating.id}/reallocate`, 'POST', { targetAccountId });
      await fetchAccounts();
      const target = accounts.find((a) => a.id === targetAccountId);
      toast({ tone: 'success', message: `Moved transactions to ${target?.name ?? 'the other account'}` });
      setReallocating(null);
    } finally {
      setIsSaving(false);
    }
  };

  const setArchiveFlag = async (account: AccountWithStats, value: boolean) => {
    await sendJson(`/api/accounts/${account.id}`, 'PATCH', { is_archived: value });
    await fetchAccounts();
  };

  const toggleArchive = async (account: AccountWithStats) => {
    const next = !account.is_archived;
    try {
      await setArchiveFlag(account, next);
      toast({
        message: next ? `Archived ${account.name}` : `Restored ${account.name}`,
        action: {
          label: 'Undo',
          onClick: () => {
            setArchiveFlag(account, !next).catch((err) =>
              toast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not undo' })
            );
          },
        },
      });
    } catch (err) {
      toast({ tone: 'error', message: `${err instanceof Error ? err.message : 'Could not update the account'}. Try again.` });
    }
  };

  const move = async (account: AccountWithStats, dir: -1 | 1) => {
    const result = moveWithinType(accounts, account.id, dir, (a) => showArchived || !a.is_archived);
    if (!result) return;
    const before = accounts;
    focusAfterMove.current = `${account.id}:${dir === -1 ? 'up' : 'down'}`;
    setAccounts(result.order);
    const sameType = result.order.filter((a) => a.type === account.type && (showArchived || !a.is_archived));
    setAnnounce(`${account.name} moved to position ${sameType.findIndex((a) => a.id === account.id) + 1} of ${sameType.length}`);
    if (result.updates.length === 0) return;
    try {
      await sendJson('/api/accounts/reorder', 'POST', { accounts: result.updates });
    } catch {
      setAccounts(before);
      toast({ tone: 'error', message: 'Could not save the new order. Try again.' });
    }
  };

  const openRow = (a: AccountWithStats) => {
    if (a.transactionCount > 0) router.push(`/transactions?accountId=${a.id}`);
    else setSnapshotFor(a);
  };

  return (
    <div className="grid gap-6">
      <PageIntro
        actions={
          <Button variant="primary" onClick={() => setIsAddOpen(true)}>
            Add account
          </Button>
        }
      >
        {!loaded ? (
          <p>Adding up your accounts…</p>
        ) : lede.count === 0 ? (
          <p>No accounts yet. Add one to start tracking balances.</p>
        ) : (
          <p>
            <strong className="fig">{formatGBP(lede.total)}</strong> across <strong>{lede.count}</strong> account
            {lede.count === 1 ? '' : 's'}
            {lede.parts.length > 0 && ': '}
            {lede.parts.map((p, i) => (
              <span key={p.type}>
                {i > 0 && (i === lede.parts.length - 1 ? ' and ' : ', ')}
                {p.type === 'credit' && p.amount < 0 ? (
                  <>
                    <span className="fig">{formatGBP(-p.amount)}</span> owed on credit cards
                  </>
                ) : (
                  <>
                    <span className="fig">{formatGBP(p.amount)}</span> in {p.phrase}
                  </>
                )}
              </span>
            ))}
            .{lede.excluded > 0 && ` ${lede.excluded} account${lede.excluded === 1 ? ' is' : 's are'} left out of net worth.`}
          </p>
        )}
      </PageIntro>

      {error && (
        <Notice tone="error" action={<Button size="sm" onClick={fetchAccounts}>Try again</Button>}>
          {error}. Check your connection and try again.
        </Notice>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {/* A filter on the list, so it sits with the list rather than with the page actions. */}
      {loaded && archivedCount > 0 && (
        <label className="-mb-2 flex items-center gap-2 justify-self-end text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setArchived(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Show archived <span className="fig text-ink-3">{archivedCount}</span>
        </label>
      )}

      {!loaded ? (
        <SkeletonRows rows={8} />
      ) : visible.length === 0 && !error ? (
        <EmptyState title="No accounts yet" action={<Button onClick={() => setIsAddOpen(true)}>Add account</Button>}>
          Add your current accounts, cards, savings and pensions to see every balance in one place.
        </EmptyState>
      ) : (
        groups.map((g) => (
          <Panel
            key={g.type}
            title={
              <>
                {g.label} <span className="ml-1 font-normal text-ink-3">{g.accounts.length}</span>
              </>
            }
            action={<span className="fig text-[13px] text-ink">{formatGBP(g.total)}</span>}
          >
            <ul aria-label={g.label}>
              {g.accounts.map((a, i) => {
                const s = sync.get(a.id);
                const note = balanceNote(a, s);
                return (
                  <li
                    key={a.id}
                    onClick={() => openRow(a)}
                    className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line-2 py-2.5 text-[13px] first:border-t-0 hover:bg-sunk md:grid-cols-[56px_minmax(0,1fr)_minmax(0,220px)_170px_32px] ${
                      a.is_archived ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="order-3 flex gap-0.5 md:order-none" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        data-move={`${a.id}:up`}
                        aria-label={`Move ${a.name} up`}
                        disabled={i === 0}
                        onClick={() => move(a, -1)}
                        className="grid h-7 w-6 place-items-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        data-move={`${a.id}:down`}
                        aria-label={`Move ${a.name} down`}
                        disabled={i === g.accounts.length - 1}
                        onClick={() => move(a, 1)}
                        className="grid h-7 w-6 place-items-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </button>
                    </span>
                    <span className="order-1 col-span-2 min-w-0 md:order-none md:col-span-1">
                      {a.transactionCount > 0 ? (
                        <Link
                          href={`/transactions?accountId=${a.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate font-medium text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          {a.name}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSnapshotFor(a);
                          }}
                          className="block max-w-full truncate text-left font-medium text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          {a.name}
                        </button>
                      )}
                      <span className="block truncate text-xs text-ink-3">
                        {a.provider || '–'}
                        {a.transactionCount > 0 && ` · ${a.transactionCount.toLocaleString('en-GB')} transactions`}
                      </span>
                    </span>
                    <span className="order-4 flex min-w-0 justify-end md:order-none md:justify-start">
                      <StatusChips a={a} sync={s} />
                    </span>
                    <span className="order-2 text-right md:order-none">
                      <span className="fig block text-ink">{formatGBP(a.currentBalance, { pence: true })}</span>
                      {note && <span className="block text-xs text-ink-3">{note}</span>}
                    </span>
                    <span className="order-5 justify-self-end md:order-none">
                      <RowMenu
                        label={`Actions for ${a.name}`}
                        items={[
                          { label: 'Edit', onSelect: () => setEditing(a) },
                          { label: 'Enter balance', onSelect: () => setSnapshotFor(a) },
                          { label: 'Move transactions', onSelect: () => setReallocating(a), hidden: a.transactionCount === 0 },
                          { label: a.is_archived ? 'Unarchive' : 'Archive', onSelect: () => toggleArchive(a) },
                          { label: 'Delete', onSelect: () => setDeleting(a), danger: true },
                        ]}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))
      )}

      <AccountDialog open={isAddOpen} onOpenChange={setIsAddOpen} onSave={handleCreate} isLoading={isSaving} />
      <AccountDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        account={editing}
        onSave={handleUpdate}
        isLoading={isSaving}
      />

      {/* No transactions: a plain confirm. With transactions: offer to move them, or type the name. */}
      <ConfirmDialog
        isOpen={!!deleting && deleting.transactionCount === 0}
        title="Delete account"
        message={deleting ? `Delete ${deleting.name}? Its balance history goes too. This can't be undone.` : ''}
        confirmLabel="Delete account"
        variant="danger"
        onConfirm={() => {
          if (!deleting) return;
          deleteAccount(deleting, false).catch((err) =>
            toast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not delete the account' })
          );
        }}
        onCancel={() => setDeleting(null)}
      />
      {deleting && deleting.transactionCount > 0 && (
        <DeleteAccountDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          account={deleting}
          onConfirm={(force) => deleteAccount(deleting, force)}
          onReallocate={() => {
            setDeleting(null);
            setReallocating(deleting);
          }}
          isLoading={isSaving}
        />
      )}

      {reallocating && (
        <ReallocateDialog
          open
          onOpenChange={(open) => !open && setReallocating(null)}
          sourceAccount={reallocating}
          availableAccounts={accounts as Account[]}
          onConfirm={handleReallocate}
          isLoading={isSaving}
        />
      )}

      {snapshotFor && (
        <WealthSnapshotModal
          isOpen
          accountId={snapshotFor.id}
          accountName={snapshotFor.name}
          accountType={snapshotFor.type}
          onClose={() => setSnapshotFor(null)}
          onUpdate={fetchAccounts}
        />
      )}
    </div>
  );
}
