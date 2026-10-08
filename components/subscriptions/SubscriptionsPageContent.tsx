'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, Notice, SkeletonRows } from '@/components/ui/Notice';
import { PageIntro } from '@/components/ui/PageIntro';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/Toast';
import { SubscriptionDialog, draftFrom, emptyDraft, type SubscriptionDraft } from './SubscriptionDialog';
import type { AssessedSubscription, Signal, SignalType, Summary, UntrackedCandidate } from '@/lib/subscriptions/analysis';
import { formatGBP, MONTH_SHORT } from '@/lib/format';

export interface SubscriptionsResponse {
  as_of: string;
  subscriptions: AssessedSubscription[];
  summary: Summary;
  untracked: UntrackedCandidate[];
}

type ScopeFilter = 'all' | 'personal' | 'business';
type StatusFilter = 'active' | 'all' | 'seasonal' | 'paused' | 'cancelled' | 'trial';

const SCOPES: { id: ScopeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Business' },
];
const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'trial', label: 'Trial' },
  { id: 'paused', label: 'Paused' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'Any status' },
];

/** How many "possibly untracked" rows show before "Show all". */
export const UNTRACKED_PREVIEW = 15;

/**
 * "12 Oct", or "12 Oct 2025" outside the reference year. lib/format has no
 * day-month format, so this stays local.
 */
export function shortDate(iso: string | null, refYear?: number): string {
  if (!iso) return '–';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const base = `${d} ${MONTH_SHORT[m - 1]}`;
  return refYear !== undefined && y === refYear ? base : `${base} ${y}`;
}

const PER: Record<string, string> = {
  weekly: '/wk',
  fortnightly: '/2wk',
  monthly: '/mo',
  quarterly: '/qtr',
  termly: '/term',
  half_termly: '/half term',
  annual: '/yr',
};

/** Worst first. 'no_bank_pattern' is housekeeping, so it isn't shown under "Needs attention". */
const SIGNAL_ORDER: SignalType[] = ['still_charging', 'missed_payment', 'price_change', 'cancel_window', 'no_charges_found'];
const SIGNAL_LABEL: Record<SignalType, string> = {
  still_charging: 'Still charging',
  missed_payment: 'Missed payment',
  price_change: 'Price changed',
  cancel_window: 'Cancel window',
  no_charges_found: 'No charges found',
  no_bank_pattern: 'No bank pattern',
};
const SIGNAL_TONE: Record<SignalType, 'bad' | 'warn' | 'neutral'> = {
  still_charging: 'bad',
  missed_payment: 'warn',
  price_change: 'warn',
  cancel_window: 'warn',
  no_charges_found: 'neutral',
  no_bank_pattern: 'neutral',
};

function attentionSignals(s: AssessedSubscription): Signal[] {
  return s.signals
    .filter((x) => x.type !== 'no_bank_pattern')
    .sort((a, b) => SIGNAL_ORDER.indexOf(a.type) - SIGNAL_ORDER.indexOf(b.type));
}

/** Per charge, or for a variable-amount subscription the last 12 months against its expected annual cost. */
const priceDiff = (s: AssessedSubscription) =>
  s.variable_amount
    ? (s.twelve_month_total ?? s.annual_cost) - s.annual_cost
    : (s.last_amount ?? Math.abs(s.amount)) - Math.abs(s.amount);

/**
 * The opening sentence: monthly total, then the one or two things worth
 * knowing (a price change, something still charging, untracked charges).
 */
export function subscriptionsLede(data: SubscriptionsResponse): ReactNode {
  const { summary } = data;
  const refYear = Number(data.as_of.slice(0, 4));
  const n = summary.active_count;
  const notes: ReactNode[] = [];

  const changed = data.subscriptions
    .filter((s) => s.signals.some((x) => x.type === 'price_change'))
    .sort((a, b) => Math.abs(priceDiff(b)) - Math.abs(priceDiff(a)));
  if (changed.length > 0) {
    const s = changed[0];
    const diff = priceDiff(s);
    const dir = s.variable_amount ? 'ran' : diff >= 0 ? 'goes up' : 'goes down';
    notes.push(
      <span key="price">
        {s.name} {dir} <span className="fig">{formatGBP(Math.abs(diff))}</span>
        {s.variable_amount
          ? ` ${diff >= 0 ? 'over' : 'under'} expected in the last 12 months`
          : s.next_due ? ` on ${shortDate(s.next_due, refYear)}` : ''}
        {changed.length > 1 ? ` (${changed.length - 1} other price${changed.length > 2 ? 's have' : ' has'} changed)` : ''}
      </span>
    );
  }
  const still = data.subscriptions.filter((s) => s.signals.some((x) => x.type === 'still_charging'));
  if (still.length > 0) {
    notes.push(
      <span key="still">
        {still[0].name} is still charging after being {still[0].status ?? 'cancelled'}
        {still.length > 1 ? ` (and ${still.length - 1} more)` : ''}
      </span>
    );
  }
  if (data.untracked.length > 0) {
    notes.push(
      <span key="untracked">
        {data.untracked.length} look{data.untracked.length === 1 ? 's' : ''} untracked
      </span>
    );
  }

  return (
    <p>
      <strong className="fig">{formatGBP(summary.monthly)}</strong> a month across <strong>{n}</strong> active subscription
      {n === 1 ? '' : 's'}.{' '}
      {notes.length === 0
        ? 'Everything is charging as expected.'
        : notes.map((x, i) => (
            <span key={i}>
              {i > 0 ? '; ' : ''}
              {x}
            </span>
          ))}
      {notes.length > 0 ? '.' : ''}
    </p>
  );
}

/** Quiet text filter, kept in the URL by the caller. */
function TextFilter<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; n?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`pb-0.5 focus-visible:outline-2 focus-visible:outline-accent ${
            value === o.id ? 'border-b-[1.5px] border-ink text-ink' : 'text-ink-3 hover:text-ink-2'
          }`}
        >
          {o.label}
          {o.n !== undefined && <span className="fig ml-1 text-[12px]">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

export function SubscriptionsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();

  const [data, setData] = useState<SubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAllUntracked, setShowAllUntracked] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rawScope = params?.get('scope');
  const scope: ScopeFilter = SCOPES.some((s) => s.id === rawScope) ? (rawScope as ScopeFilter) : 'all';
  const rawStatus = params?.get('status');
  const status: StatusFilter = STATUSES.some((s) => s.id === rawStatus) ? (rawStatus as StatusFilter) : 'active';

  const setParam = useCallback(
    (key: string, value: string, fallback: string) => {
      const next = new URLSearchParams(params?.toString() ?? '');
      if (value === fallback) next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialDraft, setInitialDraft] = useState<SubscriptionDraft>(emptyDraft);
  const [deleting, setDeleting] = useState<AssessedSubscription | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/subscriptions');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refYear = data ? Number(data.as_of.slice(0, 4)) : new Date().getFullYear();

  const categories = useMemo(
    () => Array.from(new Set((data?.subscriptions ?? []).map((s) => s.category).filter((c): c is string => !!c))).sort(),
    [data]
  );

  const attention = useMemo(
    () =>
      (data?.subscriptions ?? [])
        .filter((s) => attentionSignals(s).length > 0)
        .sort(
          (a, b) =>
            SIGNAL_ORDER.indexOf(attentionSignals(a)[0].type) - SIGNAL_ORDER.indexOf(attentionSignals(b)[0].type) ||
            b.monthly_cost - a.monthly_cost
        ),
    [data]
  );

  const comingUp = useMemo(() => {
    if (!data) return [];
    const horizon = new Date(Date.parse(data.as_of) + 30 * 86_400_000).toISOString().slice(0, 10);
    return data.subscriptions
      .filter((s) => s.next_due && s.next_due <= horizon)
      .sort((a, b) => (a.next_due ?? '').localeCompare(b.next_due ?? ''));
  }, [data]);

  const comingUpTotal = comingUp.reduce((t, s) => t + Math.abs(s.amount), 0);

  const inScope = useMemo(
    () => (data?.subscriptions ?? []).filter((s) => scope === 'all' || s.scope === scope),
    [data, scope]
  );

  const listed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inScope
      .filter((s) => status === 'all' || (s.status ?? 'active') === status || (status === 'active' && s.status === 'seasonal'))
      .filter((s) => !q || [s.name, s.provider, s.category, s.bank_description_pattern].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => b.monthly_cost - a.monthly_cost);
  }, [inScope, status, search]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: inScope.length };
    for (const s of inScope) c[s.status ?? 'active'] = (c[s.status ?? 'active'] ?? 0) + 1;
    // Active includes seasonal, matching the header's total.
    c.active = (c.active ?? 0) + (c.seasonal ?? 0);
    return c;
  }, [inScope]);

  const openAdd = (draft: SubscriptionDraft = emptyDraft) => {
    setEditingId(null);
    setInitialDraft(draft);
    setDialogOpen(true);
  };

  const openEdit = (s: AssessedSubscription) => {
    setEditingId(s.id);
    setInitialDraft(draftFrom(s));
    setDialogOpen(true);
  };

  /** PATCH a subscription; resolves true on success, toasts the error otherwise. */
  const patch = async (id: string, body: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? 'Could not update the subscription');
      }
      return true;
    } catch (err) {
      toast({ tone: 'error', message: `${err instanceof Error ? err.message : 'Could not update the subscription'}. Try again.` });
      return false;
    }
  };

  /** Change fields, then offer Undo that restores the previous values. */
  const changeWithUndo = async (
    s: AssessedSubscription,
    next: Record<string, unknown>,
    previous: Record<string, unknown>,
    message: string
  ) => {
    setBusyId(s.id);
    const ok = await patch(s.id, next);
    setBusyId(null);
    if (!ok) return;
    await load(true);
    toast({
      tone: 'success',
      message,
      action: {
        label: 'Undo',
        onClick: async () => {
          if (await patch(s.id, previous)) {
            await load(true);
            toast({ message: `Restored ${s.name}` });
          }
        },
      },
    });
  };

  const markCancelled = (s: AssessedSubscription) =>
    changeWithUndo(s, { status: 'cancelled' }, { status: s.status ?? 'active' }, `Marked ${s.name} cancelled`);

  const acceptPrice = (s: AssessedSubscription) => {
    if (s.last_amount === null) return;
    return changeWithUndo(
      s,
      { amount: s.last_amount },
      { amount: Math.abs(s.amount) },
      `${s.name} now recorded at ${formatGBP(s.last_amount, { pence: true })}`
    );
  };

  const dismiss = async (c: UntrackedCandidate) => {
    try {
      const res = await fetch('/api/subscriptions/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description_pattern: c.key, reason: 'Not a subscription (finance-tracker)' }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? 'Could not dismiss it');
      }
      await load(true);
      toast({ message: `${c.description} won't be suggested again` });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not dismiss it' });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { id, name } = deleting;
    setDeleting(null);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? 'Could not delete the subscription');
      }
      await load(true);
      toast({ message: `Deleted ${name}` });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not delete the subscription' });
    }
  };

  const summary = data?.summary;
  const maxCat = summary?.by_category.reduce((m, c) => Math.max(m, c.monthly), 0) ?? 0;
  const untrackedShown = data ? (showAllUntracked ? data.untracked : data.untracked.slice(0, UNTRACKED_PREVIEW)) : [];

  return (
    <div className="grid gap-7">
      <PageIntro
        actions={
          <Button variant="primary" onClick={() => openAdd()}>
            Add subscription
          </Button>
        }
      >
        {data ? subscriptionsLede(data) : loading ? <p>Checking subscriptions against the bank data…</p> : null}
        {data && <p className="mt-1 text-[12.5px] text-ink-3">Checked against bank data to {shortDate(data.as_of, refYear)}.</p>}
      </PageIntro>

      {error && (
        <Notice tone="error" action={<Button size="sm" onClick={() => load()}>Try again</Button>}>
          Couldn&apos;t load subscriptions: {error}
        </Notice>
      )}

      {loading && !data && <SkeletonRows rows={6} />}

      {data && (
        <>
          <Panel title="Needs attention" action={attention.length === 0 ? 'nothing to do' : <span className="fig">{attention.length}</span>}>
            {attention.length === 0 ? (
              <p className="pb-2 text-sm text-ink-3">Every tracked subscription is charging as expected.</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {attention.map((s) => {
                  const signals = attentionSignals(s);
                  const priceChange = signals.some((x) => x.type === 'price_change');
                  const canCancel = signals.some((x) => x.type === 'missed_payment' || x.type === 'no_charges_found');
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                      <div className="min-w-0 flex-1 basis-64">
                        <button type="button" onClick={() => openEdit(s)} className="text-left text-sm font-medium text-ink hover:underline">
                          {s.name}
                        </button>
                        <ul className="mt-1 grid gap-1">
                          {signals.map((x) => (
                            <li key={x.type} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-ink-2">
                              <Chip tone={SIGNAL_TONE[x.type]}>{SIGNAL_LABEL[x.type]}</Chip>
                              <span className="min-w-0">{x.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {priceChange && !s.variable_amount && s.last_amount !== null && (
                          <Button size="sm" disabled={busyId === s.id} onClick={() => acceptPrice(s)}>
                            Use <span className="fig">{formatGBP(s.last_amount, { pence: true })}</span>
                          </Button>
                        )}
                        {canCancel && (
                          <Button size="sm" disabled={busyId === s.id} onClick={() => markCancelled(s)}>
                            Mark cancelled
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                          Edit
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Coming up (30 days)"
            action={
              comingUp.length > 0 ? (
                <span>
                  <span className="fig">{formatGBP(comingUpTotal)}</span> due
                </span>
              ) : undefined
            }
          >
            {comingUp.length === 0 ? (
              <p className="pb-2 text-sm text-ink-3">Nothing due in the next 30 days.</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {comingUp.map((s) => (
                  <li key={s.id} className="grid grid-cols-[64px_1fr_auto] items-baseline gap-x-3 py-2 text-sm">
                    <span className="text-ink-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {shortDate(s.next_due, refYear)}
                    </span>
                    <span className="min-w-0 truncate text-ink">
                      {s.name}
                      {s.next_due_source === 'renewal_date' && <span className="ml-2 text-xs text-ink-3">renewal</span>}
                    </span>
                    <span className="fig text-right text-ink">
                      {formatGBP(Math.abs(s.amount), { pence: true })}
                      <span className="text-ink-3">{PER[s.frequency] ?? ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-1 text-xs text-ink-3">Projected from the last charge unless a renewal date is set.</p>
          </Panel>

          <Panel title="All subscriptions" bodyClassName="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <TextFilter label="Scope" options={SCOPES} value={scope} onChange={(v) => setParam('scope', v, 'all')} />
                <TextFilter
                  label="Status"
                  options={STATUSES.map((s) => ({ ...s, n: statusCounts[s.id] ?? 0 }))}
                  value={status}
                  onChange={(v) => setParam('status', v, 'active')}
                />
              </div>
              <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-3">
                <Search className="h-3.5 w-3.5" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search subscriptions"
                  className="w-36 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none"
                />
              </label>
            </div>

            <div className="rounded-[3px] border border-line bg-surface">
              {listed.length === 0 ? (
                data.subscriptions.length === 0 ? (
                  <EmptyState title="No subscriptions yet" action={<Button onClick={() => openAdd()}>Add subscription</Button>}>
                    Add the ones you pay for and they&apos;ll be checked against your bank data.
                  </EmptyState>
                ) : (
                  <EmptyState title="No subscriptions match these filters">Try another status or clear the search.</EmptyState>
                )
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(0,1fr)_130px_110px_96px_96px_86px_96px] gap-x-3 border-b border-line px-3 py-2 text-[11.5px] font-semibold text-ink-3 md:grid">
                    <span>Name</span>
                    <span>Category</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Per month</span>
                    <span className="text-right">Last charged</span>
                    <span className="text-right">Next due</span>
                    <span />
                  </div>
                  <ul>
                    {listed.map((s) => {
                      const changed = !s.variable_amount && s.last_amount !== null && Math.abs(s.last_amount - Math.abs(s.amount)) >= 0.01;
                      return (
                        <li
                          key={s.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 border-b border-line-2 px-3 py-2 text-[13px] last:border-b-0 md:grid-cols-[minmax(0,1fr)_130px_110px_96px_96px_86px_96px]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{s.name}</span>
                            <span className="block truncate text-xs text-ink-3">
                              {s.scope === 'business' ? 'Business' : 'Personal'}
                              {s.status && s.status !== 'active' ? ` · ${s.status}` : ''}
                              {s.signals.some((x) => x.type === 'no_bank_pattern') ? ' · no bank pattern' : ''}
                              <span className="md:hidden">{s.category ? ` · ${s.category}` : ''}</span>
                            </span>
                          </span>
                          <span className="hidden truncate text-ink-2 md:block">{s.category ?? '–'}</span>
                          <span className="fig text-right text-ink">
                            {formatGBP(Math.abs(s.amount), { pence: true })}
                            <span className="text-ink-3">{PER[s.frequency] ?? ''}</span>
                          </span>
                          <span className="fig hidden text-right text-ink md:block">{formatGBP(s.monthly_cost, { pence: true })}</span>
                          <span className="hidden text-right text-ink-2 md:block">
                            {s.last_charged ? shortDate(s.last_charged, refYear) : '–'}
                            {changed && <span className="fig block text-xs text-warn">{formatGBP(s.last_amount!, { pence: true })}</span>}
                          </span>
                          <span className="hidden text-right text-ink-2 md:block">{shortDate(s.next_due, refYear)}</span>
                          <span className="col-span-2 flex justify-end gap-1 md:col-span-1">
                            <span className="mr-auto text-xs text-ink-3 md:hidden">
                              {s.next_due ? `Next ${shortDate(s.next_due, refYear)}` : ''}
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`}>
                              Delete
                            </Button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </Panel>

          {summary && summary.by_category.length > 0 && (
            <Panel title="By category" action="active, per month">
              <ol className="grid gap-2 pb-1">
                {summary.by_category.map((c) => (
                  <li key={c.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto_auto]">
                    <span className="min-w-0 truncate text-ink">
                      {c.category} <span className="text-xs text-ink-3">{c.count}</span>
                    </span>
                    <span className="order-last col-span-2 h-1.5 rounded-full bg-line-2 sm:order-none sm:col-span-1" aria-hidden>
                      <span className="block h-full rounded-full bg-ink-2" style={{ width: `${maxCat > 0 ? (c.monthly / maxCat) * 100 : 0}%` }} />
                    </span>
                    <span className="fig text-right text-ink">{formatGBP(c.monthly, { pence: true })}</span>
                    <span className="fig hidden w-20 text-right text-ink-3 sm:block">{formatGBP(c.monthly * 12)}/yr</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          <Panel title="Possibly untracked" action="fixed amounts seen 3+ times in 6 months">
            {data.untracked.length === 0 ? (
              <p className="pb-2 text-sm text-ink-3">No repeating charges outside the list above.</p>
            ) : (
              <>
                <ul className="divide-y divide-line-2">
                  {untrackedShown.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                      <span className="min-w-0 flex-1 basis-52 truncate text-ink">{c.description}</span>
                      <span className="fig text-ink-2">
                        {formatGBP(c.average_amount, { pence: true })} × {c.occurrences}
                      </span>
                      <span className="w-36 text-right text-xs text-ink-3">
                        {shortDate(c.first_seen, refYear)} – {shortDate(c.last_seen, refYear)}
                      </span>
                      <span className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() =>
                            openAdd({
                              ...emptyDraft,
                              name: c.description,
                              amount: c.average_amount.toFixed(2),
                              bank_description_pattern: c.key,
                            })
                          }
                        >
                          Track it
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => dismiss(c)}>
                          Not a subscription
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
                {data.untracked.length > UNTRACKED_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllUntracked((v) => !v)}
                    className="mt-2 text-[13px] text-accent underline underline-offset-2"
                  >
                    {showAllUntracked ? 'Show fewer' : `Show all ${data.untracked.length}`}
                  </button>
                )}
              </>
            )}
          </Panel>
        </>
      )}

      <SubscriptionDialog
        open={dialogOpen}
        editingId={editingId}
        initial={initialDraft}
        categories={categories}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          toast({ tone: 'success', message: editingId ? 'Subscription saved' : 'Subscription added' });
          load(true);
        }}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete subscription"
        message={deleting ? `Delete "${deleting.name}"? To keep its history, mark it cancelled instead.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
