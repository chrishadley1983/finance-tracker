'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  SubscriptionDialog,
  draftFrom,
  emptyDraft,
  type SubscriptionDraft,
} from '@/components/subscriptions';
import type {
  AssessedSubscription,
  Signal,
  SignalType,
  Summary,
  UntrackedCandidate,
} from '@/lib/subscriptions/analysis';
import { formatGBP } from '@/lib/format';

interface SubscriptionsResponse {
  as_of: string;
  subscriptions: AssessedSubscription[];
  summary: Summary;
  untracked: UntrackedCandidate[];
}

type ScopeFilter = 'all' | 'personal' | 'business';
type StatusFilter = 'active' | 'all' | 'paused' | 'cancelled' | 'trial';

const shortDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '–';

const PER: Record<string, string> = {
  weekly: '/wk',
  fortnightly: '/2wk',
  monthly: '/mo',
  quarterly: '/qtr',
  termly: '/term',
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
const SIGNAL_CLASS: Record<SignalType, string> = {
  still_charging: 'bg-red-50 text-red-700 border-red-200',
  missed_payment: 'bg-amber-50 text-amber-800 border-amber-200',
  price_change: 'bg-amber-50 text-amber-800 border-amber-200',
  cancel_window: 'bg-blue-50 text-blue-700 border-blue-200',
  no_charges_found: 'bg-slate-50 text-slate-700 border-slate-200',
  no_bank_pattern: 'bg-slate-50 text-slate-600 border-slate-200',
};

function attentionSignals(s: AssessedSubscription): Signal[] {
  return s.signals
    .filter((x) => x.type !== 'no_bank_pattern')
    .sort((a, b) => SIGNAL_ORDER.indexOf(a.type) - SIGNAL_ORDER.indexOf(b.type));
}

function SignalBadge({ type }: { type: SignalType }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium border rounded ${SIGNAL_CLASS[type]}`}>
      {SIGNAL_LABEL[type]}
    </span>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [scope, setScope] = useState<ScopeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialDraft, setInitialDraft] = useState<SubscriptionDraft>(emptyDraft);
  const [deleting, setDeleting] = useState<AssessedSubscription | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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

  const categories = useMemo(
    () =>
      Array.from(new Set((data?.subscriptions ?? []).map((s) => s.category).filter((c): c is string => !!c))).sort(),
    [data],
  );

  const attention = useMemo(
    () =>
      (data?.subscriptions ?? [])
        .filter((s) => attentionSignals(s).length > 0)
        .sort(
          (a, b) =>
            SIGNAL_ORDER.indexOf(attentionSignals(a)[0].type) - SIGNAL_ORDER.indexOf(attentionSignals(b)[0].type) ||
            b.monthly_cost - a.monthly_cost,
        ),
    [data],
  );

  const comingUp = useMemo(() => {
    if (!data) return [];
    const horizon = new Date(Date.parse(data.as_of) + 30 * 86_400_000).toISOString().slice(0, 10);
    return data.subscriptions
      .filter((s) => s.next_due && s.next_due <= horizon)
      .sort((a, b) => (a.next_due ?? '').localeCompare(b.next_due ?? ''));
  }, [data]);

  const listed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.subscriptions ?? [])
      .filter((s) => scope === 'all' || s.scope === scope)
      .filter((s) => status === 'all' || (s.status ?? 'active') === status)
      .filter(
        (s) =>
          !q ||
          [s.name, s.provider, s.category, s.bank_description_pattern].some((v) => v?.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.monthly_cost - a.monthly_cost);
  }, [data, scope, status, search]);

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

  const patch = async (id: string, body: Record<string, unknown>) => {
    setActionError(null);
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setActionError(b.error ?? 'Could not update the subscription');
      return;
    }
    await load();
  };

  const dismiss = async (c: UntrackedCandidate) => {
    setActionError(null);
    const res = await fetch('/api/subscriptions/exclusions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description_pattern: c.key, reason: 'Not a subscription (finance-tracker)' }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setActionError(b.error ?? 'Could not dismiss it');
      return;
    }
    await load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    setActionError(null);
    const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setActionError(b.error ?? 'Could not delete the subscription');
      return;
    }
    await load();
  };

  const summary = data?.summary;

  return (
    <AppLayout title="Subscriptions">
      <div className="space-y-6">
        {/* Totals and actions */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          {summary ? (
            <dl className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Per month</dt>
                <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{formatGBP(summary.monthly, { pence: true })}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Per year</dt>
                <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{formatGBP(summary.annual)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Personal / Business</dt>
                <dd className="text-lg font-medium text-slate-700 tabular-nums pt-1">
                  {formatGBP(summary.personal_monthly, { pence: true })} / {formatGBP(summary.business_monthly, { pence: true })}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Active</dt>
                <dd className="text-lg font-medium text-slate-700 tabular-nums pt-1">{summary.active_count}</dd>
              </div>
            </dl>
          ) : (
            <div className="h-12" />
          )}
          <div className="flex items-center gap-3">
            {data && <span className="text-xs text-slate-500">Checked against bank data to {shortDate(data.as_of)}</span>}
            <button
              onClick={() => openAdd()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add subscription
            </button>
          </div>
        </div>

        {(error || actionError) && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm flex items-center justify-between">
            <span>{error ? `Couldn’t load subscriptions: ${error}` : actionError}</span>
            {error && (
              <button onClick={load} className="text-sm font-medium underline">
                Try again
              </button>
            )}
          </div>
        )}

        {loading && !data && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500" aria-busy="true">
            Checking subscriptions against the bank data…
          </div>
        )}

        {data && (
          <>
            {/* Needs attention */}
            <Section
              title="Needs attention"
              aside={<span className="text-xs text-slate-500">{attention.length === 0 ? 'nothing' : `${attention.length}`}</span>}
            >
              {attention.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">
                  Every tracked subscription is charging as expected.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {attention.map((s) => {
                    const signals = attentionSignals(s);
                    const priceChange = signals.find((x) => x.type === 'price_change');
                    return (
                      <li key={s.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="min-w-[180px] flex-1">
                          <button onClick={() => openEdit(s)} className="font-medium text-slate-900 hover:underline text-left">
                            {s.name}
                          </button>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {signals.map((x) => (
                              <span key={x.type} className="flex items-center gap-2 text-sm text-slate-600">
                                <SignalBadge type={x.type} />
                                {x.message}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {priceChange && s.last_amount !== null && (
                            <button
                              onClick={() => patch(s.id, { amount: s.last_amount })}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                            >
                              Use {formatGBP(s.last_amount, { pence: true })}
                            </button>
                          )}
                          {signals.some((x) => x.type === 'missed_payment' || x.type === 'no_charges_found') && (
                            <button
                              onClick={() => patch(s.id, { status: 'cancelled' })}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                            >
                              Mark cancelled
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(s)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                          >
                            Edit
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {/* Coming up */}
            <Section
              title="Due in the next 30 days"
              aside={<span className="text-xs text-slate-500">projected from the last charge unless a renewal date is set</span>}
            >
              {comingUp.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">Nothing due in the next 30 days.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {comingUp.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-2 w-28 tabular-nums text-slate-600">{shortDate(s.next_due)}</td>
                        <td className="px-4 py-2 text-slate-900">
                          {s.name}
                          {s.next_due_source === 'renewal_date' && (
                            <span className="ml-2 text-xs text-slate-500">renewal</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                          {formatGBP(Math.abs(s.amount), { pence: true })}
                          <span className="text-slate-500">{PER[s.frequency] ?? ''}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {/* All subscriptions */}
            <Section
              title="All subscriptions"
              aside={
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    aria-label="Search subscriptions"
                    className="px-2 py-1 text-sm border border-slate-300 rounded-md w-40"
                  />
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as ScopeFilter)}
                    aria-label="Scope"
                    className="px-2 py-1 text-sm border border-slate-300 rounded-md"
                  >
                    <option value="all">All scopes</option>
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                  </select>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusFilter)}
                    aria-label="Status"
                    className="px-2 py-1 text-sm border border-slate-300 rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="all">All statuses</option>
                    <option value="trial">Trial</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              }
            >
              {listed.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">
                  {data.subscriptions.length === 0 ? 'No subscriptions yet.' : 'No subscriptions match these filters.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Category</th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600">Cost</th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600">Per month</th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600">Last charged</th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600">Next due</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {listed.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <div className="font-medium text-slate-900">{s.name}</div>
                            <div className="text-xs text-slate-500">
                              {s.scope === 'business' ? 'Business' : 'Personal'}
                              {s.status && s.status !== 'active' ? ` · ${s.status}` : ''}
                              {s.signals.some((x) => x.type === 'no_bank_pattern') ? ' · no bank pattern' : ''}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-slate-600">{s.category ?? '–'}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                            {formatGBP(Math.abs(s.amount), { pence: true })}
                            <span className="text-slate-500">{PER[s.frequency] ?? ''}</span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-900">{formatGBP(s.monthly_cost, { pence: true })}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                            {s.last_charged ? (
                              <>
                                {shortDate(s.last_charged)}
                                {s.last_amount !== null && Math.abs(s.last_amount - Math.abs(s.amount)) >= 0.01 && (
                                  <span className="block text-xs text-amber-700">{formatGBP(s.last_amount, { pence: true })}</span>
                                )}
                              </>
                            ) : (
                              '–'
                            )}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-600">{shortDate(s.next_due)}</td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <button onClick={() => openEdit(s)} className="text-xs font-medium text-blue-700 hover:underline">
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleting(s)}
                              className="ml-3 text-xs font-medium text-slate-500 hover:text-red-700 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* By category */}
            {summary && summary.by_category.length > 0 && (
              <Section title="Active, by category">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {summary.by_category.map((c) => (
                      <tr key={c.category}>
                        <td className="px-4 py-2 text-slate-900">{c.category}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-500 w-24">{c.count}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-900 w-32">{formatGBP(c.monthly, { pence: true })}/mo</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-500 w-32">{formatGBP(c.monthly * 12)}/yr</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Untracked */}
            <Section
              title="Possibly untracked"
              aside={<span className="text-xs text-slate-500">fixed amounts seen 3+ times in 6 months</span>}
            >
              {data.untracked.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">No repeating charges outside the list above.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.untracked.slice(0, 15).map((c) => (
                    <li key={c.key} className="px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="flex-1 min-w-[200px] text-slate-900">{c.description}</span>
                      <span className="tabular-nums text-slate-600">
                        {formatGBP(c.average_amount, { pence: true })} × {c.occurrences}
                      </span>
                      <span className="tabular-nums text-slate-500 w-40 text-right">
                        {shortDate(c.first_seen)} – {shortDate(c.last_seen)}
                      </span>
                      <span className="flex gap-2">
                        <button
                          onClick={() =>
                            openAdd({
                              ...emptyDraft,
                              name: c.description,
                              amount: c.average_amount.toFixed(2),
                              bank_description_pattern: c.key,
                            })
                          }
                          className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                        >
                          Track it
                        </button>
                        <button
                          onClick={() => dismiss(c)}
                          className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          Not a subscription
                        </button>
                      </span>
                    </li>
                  ))}
                  {data.untracked.length > 15 && (
                    <li className="px-4 py-2 text-xs text-slate-500">+{data.untracked.length - 15} more</li>
                  )}
                </ul>
              )}
            </Section>
          </>
        )}
      </div>

      <SubscriptionDialog
        open={dialogOpen}
        editingId={editingId}
        initial={initialDraft}
        categories={categories}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          load();
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
    </AppLayout>
  );
}
