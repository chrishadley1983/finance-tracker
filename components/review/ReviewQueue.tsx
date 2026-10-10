'use client';

import { isTypingTarget } from '@/lib/keyboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { useToast } from '@/components/ui/Toast';
import { refreshNavSummary } from '@/components/layout/useNavSummary';
import { formatGBP, gbDate } from '@/lib/format';
import { groupByMerchant, isUnsure, type ReviewRow } from '@/lib/review/queue';

type Filter = 'all' | 'uncategorised' | 'flagged';
type View = 'merchant' | 'date';

interface Stats {
  total: number;
  uncategorised: number;
  flagged: number;
}

interface Answer {
  transaction_ids: string[];
  category_id: string;
  always?: boolean;
}

const money = (n: number) => formatGBP(Math.abs(n), { pence: true });
const shortDate = (iso: string) =>
  gbDate(new Date(`${iso}T00:00:00`), { day: '2-digit', month: 'short' });

function Checkbox({ state, onChange, label }: { state: 'on' | 'off' | 'part'; onChange: (shift: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={state === 'on'}
      ref={(el) => {
        if (el) el.indeterminate = state === 'part';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onChange(e.shiftKey);
      }}
      onChange={() => {}}
      className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
    />
  );
}

export function ReviewQueue() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, uncategorised: 0, flagged: 0 });
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<View>('merchant');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [pickerNonce, setPickerNonce] = useState(0);
  const [cleared, setCleared] = useState(0);
  const anchor = useRef<number | null>(null);
  const lastKey = useRef({ key: '', at: 0 });
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ filter, limit: '300' });
      if (debounced) params.set('search', debounced);
      const res = await fetch(`/api/transactions/review-queue?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load the review queue');
      const data = await res.json();
      setRows(data.transactions ?? []);
      setStats(data.stats ?? { total: 0, uncategorised: 0, flagged: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the review queue');
    } finally {
      setIsLoading(false);
    }
  }, [filter, debounced]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  const visible = useMemo(() => rows.filter((r) => !skipped.has(r.id)), [rows, skipped]);
  const groups = useMemo(() => (view === 'merchant' ? groupByMerchant(visible) : null), [visible, view]);
  // Flat order of rows as displayed, for J/K, shift-ranges and focus.
  const order = useMemo(() => (groups ? groups.flatMap((g) => g.rows) : visible), [groups, visible]);
  const focusedRow = order[Math.min(focus, order.length - 1)];

  useEffect(() => {
    setSelected((sel) => new Set(Array.from(sel).filter((id) => order.some((r) => r.id === id))));
    if (focus >= order.length) setFocus(Math.max(order.length - 1, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const selectedRows = useMemo(() => order.filter((r) => selected.has(r.id)), [order, selected]);
  /** What actions apply to: the selection, or else the focused row. */
  const targets = selectedRows.length > 0 ? selectedRows : focusedRow ? [focusedRow] : [];
  const targetMerchants = new Set(targets.map((r) => r.merchant));
  const targetSuggestion = (() => {
    const first = targets[0]?.suggestion;
    return first && targets.every((r) => r.suggestion?.categoryId === first.categoryId) ? first : null;
  })();

  const toggle = (row: ReviewRow, shift: boolean) => {
    const idx = order.findIndex((r) => r.id === row.id);
    setSelected((sel) => {
      const next = new Set(sel);
      if (shift && anchor.current !== null) {
        const [a, b] = [Math.min(anchor.current, idx), Math.max(anchor.current, idx)];
        const on = !sel.has(row.id);
        order.slice(a, b + 1).forEach((r) => (on ? next.add(r.id) : next.delete(r.id)));
      } else if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
    anchor.current = idx;
    setFocus(idx);
  };

  const toggleMany = (ids: string[]) =>
    setSelected((sel) => {
      const next = new Set(sel);
      const allOn = ids.every((id) => next.has(id));
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  /** Send answers, then offer Undo (restores the rows exactly). */
  const submit = useCallback(
    async (answers: Answer[], affected: ReviewRow[], message: string, undoable = true) => {
      if (answers.length === 0 || busy) return;
      setBusy(true);
      const since = new Date(Date.now() - 1000).toISOString();
      try {
        const res = await fetch('/api/categorisation/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Could not save');
        }
        setCleared((c) => c + affected.length);
        setSelected(new Set());
        const snapshot = affected.map((r) => ({
          id: r.id,
          category_id: r.categoryId,
          categorisation_source: r.categorisationSource,
          engine_source: r.engineSource,
          categorisation_confidence: r.confidence,
          needs_review: r.needsReview,
          is_validated: r.isValidated,
        }));
        toast({
          message,
          tone: 'success',
          action: undoable
            ? {
                label: 'Undo',
                onClick: async () => {
                  const r = await fetch('/api/transactions/review-queue/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ since, rows: snapshot }),
                  });
                  if (!r.ok) toast({ message: 'Could not undo', tone: 'error' });
                  else setCleared((c) => Math.max(0, c - affected.length));
                  await load();
                  refreshNavSummary();
                },
              }
            : undefined,
        });
        await load();
        refreshNavSummary();
      } catch (e) {
        toast({ message: e instanceof Error ? e.message : 'Could not save', tone: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [busy, load, toast]
  );

  const accept = useCallback(() => {
    const withSuggestion = targets.filter((r) => r.suggestion);
    if (withSuggestion.length === 0) {
      toast({ message: 'Nothing to accept: choose a category instead (C)' });
      return;
    }
    const byCat = new Map<string, string[]>();
    withSuggestion.forEach((r) => byCat.set(r.suggestion!.categoryId, [...(byCat.get(r.suggestion!.categoryId) ?? []), r.id]));
    const skippedCount = targets.length - withSuggestion.length;
    submit(
      Array.from(byCat, ([category_id, transaction_ids]) => ({ category_id, transaction_ids })),
      withSuggestion,
      `Accepted ${withSuggestion.length}${skippedCount ? ` (${skippedCount} without a suggestion left)` : ''}`
    );
  }, [targets, submit, toast]);

  const setCategory = useCallback(
    (categoryId: string | null, name?: string, rowsFor: ReviewRow[] = targets) => {
      if (!categoryId || rowsFor.length === 0) return;
      submit(
        [{ category_id: categoryId, transaction_ids: rowsFor.map((r) => r.id) }],
        rowsFor,
        `${rowsFor.length} set to ${name ?? 'category'}`
      );
    },
    [targets, submit]
  );

  const makeRule = useCallback(() => {
    if (targetMerchants.size !== 1 || !targetSuggestion) {
      toast({ message: 'Pick rows from one merchant that share a category to make a rule' });
      return;
    }
    submit(
      [{ category_id: targetSuggestion.categoryId, transaction_ids: targets.map((r) => r.id), always: true }],
      targets,
      `Rule saved: ${targets[0].merchant} → ${targetSuggestion.categoryName}`,
      false
    );
  }, [targets, targetMerchants.size, targetSuggestion, submit, toast]);

  const skip = useCallback(() => {
    if (targets.length === 0) return;
    setSkipped((s) => new Set([...Array.from(s), ...targets.map((r) => r.id)]));
    setSelected(new Set());
  }, [targets]);

  // Keyboard: J/K move, X select, A accept, C category, R rule, E skip, Esc clear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      // "G then a letter" is the app-wide jump shortcut; don't also act on the letter.
      const afterG = lastKey.current.key === 'g' && Date.now() - lastKey.current.at < 1200;
      lastKey.current = { key: k, at: Date.now() };
      if (afterG) return;
      if (k === 'j' || k === 'arrowdown') setFocus((f) => Math.min(f + 1, order.length - 1));
      else if (k === 'k' || k === 'arrowup') setFocus((f) => Math.max(f - 1, 0));
      else if (k === 'x' && focusedRow) toggle(focusedRow, e.shiftKey);
      else if (k === 'a') accept();
      else if (k === 'c' && targets.length) setPickerNonce((n) => n + 1);
      else if (k === 'r') makeRule();
      else if (k === 'e') skip();
      else if (k === 'escape') setSelected(new Set());
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (focusedRow) rowRefs.current.get(focusedRow.id)?.scrollIntoView?.({ block: 'nearest' });
  }, [focusedRow]);

  const selectedTotal = selectedRows.reduce((t, r) => t + r.amount, 0);
  const suggestedCount = visible.filter((r) => r.suggestion).length;

  const rowView = (r: ReviewRow) => {
    const idx = order.indexOf(r);
    const isFocused = idx === focus;
    const isSel = selected.has(r.id);
    return (
      <div
        key={r.id}
        ref={(el) => {
          if (el) rowRefs.current.set(r.id, el);
          else rowRefs.current.delete(r.id);
        }}
        onClick={() => setFocus(idx)}
        className={`grid grid-cols-[28px_1fr_auto] items-center gap-x-3 border-b border-line-2 px-3 py-2 text-[13px] md:grid-cols-[28px_64px_1fr_minmax(150px,auto)_96px] ${
          isSel ? 'bg-sel' : ''
        } ${isFocused ? 'shadow-[inset_2px_0_0_var(--accent)]' : ''}`}
      >
        <Checkbox state={isSel ? 'on' : 'off'} onChange={(shift) => toggle(r, shift)} label={`Select ${r.description}`} />
        <span className="hidden text-ink-3 md:block" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {shortDate(r.date)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-ink">{r.description}</span>
          <span className="block truncate text-xs text-ink-3">
            <span className="md:hidden">{shortDate(r.date)} · </span>
            {r.reason}
            {r.accountName ? ` · ${r.accountName}` : ''}
          </span>
        </span>
        <span className="col-start-2 flex items-center gap-1.5 md:col-start-auto">
          <CategorySelect
            value={r.suggestion?.categoryId ?? null}
            onChange={(id, cat) => setCategory(id, cat?.name, [r])}
            variant="button"
            ariaLabel={`Category for ${r.description}`}
            triggerClassName={
              r.suggestion
                ? 'inline-flex items-center gap-1 rounded bg-accent-soft px-2 py-0.5 text-xs text-accent hover:ring-1 hover:ring-accent'
                : 'inline-flex items-center gap-1 rounded border border-dashed border-line px-2 py-0.5 text-xs text-ink-3 hover:text-ink'
            }
            buttonLabel={r.suggestion ? r.suggestion.categoryName : 'Choose…'}
          />
          {r.suggestion && isUnsure(r.suggestion.confidence) && <span className="fig text-[11px] text-ink-3">unsure</span>}
        </span>
        <span className={`fig row-span-2 text-right md:row-span-1 ${r.amount > 0 ? 'text-in' : 'text-ink'}`}>
          {r.amount > 0 ? '+' : ''}
          {money(r.amount)}
        </span>
      </div>
    );
  };

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: stats.total },
    { id: 'uncategorised', label: 'No category', n: stats.uncategorised },
    { id: 'flagged', label: 'Flagged', n: stats.flagged },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-[78ch] text-[14.5px] text-ink-2">
          {isLoading ? (
            'Loading…'
          ) : visible.length === 0 ? (
            'Nothing waiting for you.'
          ) : (
            <>
              <strong className="fig font-semibold text-ink">{visible.length}</strong> transactions from{' '}
              {new Set(visible.map((r) => r.merchant)).size} merchants.{' '}
              {suggestedCount > 0 && `${suggestedCount} already have a suggestion; `}
              {visible.length - suggestedCount > 0 && `${visible.length - suggestedCount} need you to choose.`}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex overflow-hidden rounded-md border border-line bg-surface text-[12.5px]" role="group" aria-label="Group by">
            {(['merchant', 'date'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 ${view === v ? 'bg-ink text-surface' : 'text-ink-2 hover:text-ink'}`}
              >
                By {v}
              </button>
            ))}
          </div>
          <div className="flex gap-3.5 text-[13px]" role="tablist" aria-label="Filter">
            {filters.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`pb-0.5 ${filter === f.id ? 'border-b-[1.5px] border-ink text-ink' : 'text-ink-3 hover:text-ink-2'}`}
              >
                {f.label} <span className="fig">{f.n}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-3">
            <Search className="h-3.5 w-3.5" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find merchant"
              aria-label="Find merchant"
              className="w-32 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </label>
        </div>
      </div>

      {error && <div className="rounded-md border border-bad bg-bad-soft px-4 py-3 text-sm text-bad">{error}</div>}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_250px]">
        <div className="min-w-0 rounded-[3px] border border-line bg-surface">
          {isLoading ? (
            <div className="grid gap-2 p-4" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-line-2" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="grid gap-2 px-6 py-12 text-center">
              <p className="text-[15px] font-medium text-ink">All clear</p>
              <p className="text-sm text-ink-3">
                {skipped.size > 0
                  ? `You skipped ${skipped.size} for now; they'll be back next time.`
                  : debounced
                    ? `Nothing matching “${debounced}” needs review.`
                    : 'New transactions that need a decision will appear here after the next bank sync.'}
              </p>
              <Link href="/transactions" className="text-sm text-accent underline">
                Browse all transactions
              </Link>
            </div>
          ) : (
            <div>
              <div className="hidden grid-cols-[28px_64px_1fr_minmax(150px,auto)_96px] gap-x-3 border-b border-line px-3 py-2 text-[11.5px] font-semibold text-ink-3 md:grid">
                <Checkbox
                  state={selectedRows.length === 0 ? 'off' : selectedRows.length === order.length ? 'on' : 'part'}
                  onChange={() => setSelected(selectedRows.length === order.length ? new Set() : new Set(order.map((r) => r.id)))}
                  label="Select all"
                />
                <span>Date</span>
                <span>Description</span>
                <span>Suggested</span>
                <span className="text-right">Amount</span>
              </div>
              {groups
                ? groups.map((g) => {
                    const ids = g.rows.map((r) => r.id);
                    const on = ids.filter((id) => selected.has(id)).length;
                    return (
                      <section key={g.merchant} aria-label={g.label}>
                        <div className="grid grid-cols-[28px_1fr_auto] items-center gap-x-3 border-b border-line-2 bg-sunk px-3 py-1.5 text-[12.5px] text-ink-2 md:grid-cols-[28px_1fr_96px]">
                          <Checkbox state={on === 0 ? 'off' : on === ids.length ? 'on' : 'part'} onChange={() => toggleMany(ids)} label={`Select all ${g.label}`} />
                          <span className="min-w-0 truncate">
                            <b className="font-semibold text-ink">{g.label}</b> · {g.rows.length} transaction{g.rows.length === 1 ? '' : 's'}
                            {g.rows.length > 1 &&
                              (g.sharedSuggestion ? (
                                <>
                                  {' '}
                                  · all suggested <b className="font-semibold text-ink">{g.sharedSuggestion.categoryName}</b>
                                </>
                              ) : (
                                ' · mixed'
                              ))}
                          </span>
                          <span className="fig text-right">{money(g.total)}</span>
                        </div>
                        {g.rows.map(rowView)}
                      </section>
                    );
                  })
                : order.map(rowView)}
            </div>
          )}

          {targets.length > 0 && visible.length > 0 && (
            <div className="sticky bottom-0 flex flex-wrap items-center gap-2 bg-bar px-3.5 py-2.5 text-[13px] text-bar-ink md:flex-nowrap">
              <span className="fig whitespace-nowrap">
                {selectedRows.length > 0 ? `${selectedRows.length} selected · ${money(selectedTotal)}` : 'Focused row'}
              </span>
              <span className="flex-1" />
              <button type="button" disabled={busy} onClick={accept} className="whitespace-nowrap rounded-md bg-bar-ink px-2.5 py-1 font-semibold text-bar disabled:opacity-50">
                Accept <kbd className="ml-1 rounded border border-current px-1 font-mono text-[11px] opacity-75">A</kbd>
              </button>
              <CategorySelect
                key={pickerNonce}
                value={null}
                onChange={(id, cat) => setCategory(id, cat?.name)}
                variant="button"
                autoFocus={pickerNonce > 0}
                align="right"
                ariaLabel="Set category"
                buttonLabel={
                  <>
                    Category… <kbd className="ml-1 rounded border border-current px-1 font-mono text-[11px] opacity-75">C</kbd>
                  </>
                }
                triggerClassName="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-bar-ink/30 px-2.5 py-1 text-bar-ink"
              />
              <button
                type="button"
                disabled={busy || targetMerchants.size !== 1 || !targetSuggestion}
                onClick={makeRule}
                title={targetMerchants.size !== 1 ? 'Select rows from one merchant' : undefined}
                className="whitespace-nowrap rounded-md border border-bar-ink/30 px-2.5 py-1 disabled:opacity-40"
              >
                Rule <kbd className="ml-1 rounded border border-current px-1 font-mono text-[11px] opacity-75">R</kbd>
              </button>
              <button type="button" onClick={skip} className="whitespace-nowrap rounded-md border border-bar-ink/30 px-2.5 py-1">
                Skip <kbd className="ml-1 rounded border border-current px-1 font-mono text-[11px] opacity-75">E</kbd>
              </button>
            </div>
          )}
        </div>

        <aside className="grid gap-4">
          {targetMerchants.size === 1 && targetSuggestion && (
            <section className="grid gap-2.5 border-t-[1.5px] border-ink pt-3">
              <h3 className="text-[13px] font-semibold text-ink">Rule from this group</h3>
              <p className="text-[12.5px] text-ink-2">Future {targets[0].merchant} transactions will be categorised automatically.</p>
              <pre className="fig overflow-x-auto rounded-md border border-line-2 bg-sunk px-2.5 py-2 text-xs text-ink">
                {`merchant contains ${targets[0].merchant}\n→ ${targetSuggestion.categoryName}`}
              </pre>
              <button type="button" onClick={makeRule} disabled={busy} className="justify-self-start rounded-md bg-accent px-3 py-1.5 text-[13px] font-semibold text-accent-ink disabled:opacity-50">
                Create rule
              </button>
            </section>
          )}
          <section className="grid gap-1.5 border-t-[1.5px] border-ink pt-3">
            <h3 className="text-[13px] font-semibold text-ink">This session</h3>
            <p className="text-[12.5px] text-ink-2">
              <span className="fig">{cleared}</span> cleared
              {skipped.size > 0 && (
                <>
                  , <span className="fig">{skipped.size}</span> skipped{' '}
                  <button type="button" className="text-accent underline" onClick={() => setSkipped(new Set())}>
                    show again
                  </button>
                </>
              )}
            </p>
          </section>
          <section className="hidden gap-2 border-t-[1.5px] border-ink pt-3 lg:grid">
            <h3 className="text-[13px] font-semibold text-ink">Keyboard</h3>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-[12.5px] text-ink-2">
              {[
                ['J / K', 'Next / previous row'],
                ['X', 'Select row (shift-click for a range)'],
                ['A', 'Accept suggestion'],
                ['C', 'Choose category'],
                ['R', 'Make a rule'],
                ['E', 'Skip for now'],
              ].map(([k, d]) => (
                <div key={k} className="contents">
                  <dt>
                    <kbd className="rounded border border-b-2 border-line bg-surface px-1 font-mono text-[11px]">{k}</kbd>
                  </dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
