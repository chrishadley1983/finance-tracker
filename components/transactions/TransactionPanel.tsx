'use client';

import { useEffect, useMemo, useState } from 'react';
import { SidePanel } from '@/components/ui/SidePanel';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { useToast, type ToastOptions } from '@/components/ui/Toast';
import { useAccounts } from '@/lib/hooks/useAccounts';
import { useCategories } from '@/lib/hooks/useCategories';
import type { TransactionWithRelations } from '@/lib/hooks/useTransactions';
import { merchantKey } from '@/lib/categorisation/normalise';
import { formatDateGB, formatGBP } from '@/lib/format';
import { TRANSACTION_ACCOUNT_TYPES } from './TransactionFilters';
import { formatAmount } from '@/lib/format';

export interface TransactionPanelProps {
  open: boolean;
  /** The transaction to show, or null to add a new one. */
  transaction: TransactionWithRelations | null;
  onClose: () => void;
  /** Called after a successful save / create / rule so the list can refresh. */
  onSaved: () => void;
  /** Ask the page to delete (it closes the panel and confirms first). */
  onDelete?: (transaction: TransactionWithRelations) => void;
  /** Pre-selected account when adding (e.g. the account filter). */
  defaultAccountId?: string;
}

interface HistoryRow {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: { name: string } | null;
}

export interface MerchantHistory {
  rows: HistoryRow[];
  count: number;
  totalThisYear: number;
  commonCategory: string | null;
}

/** Summarise same-merchant transactions (newest first) for the panel. */
export function summariseMerchantHistory(rows: HistoryRow[], now = new Date()): MerchantHistory {
  const year = String(now.getFullYear());
  let totalThisYear = 0;
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.date.startsWith(year)) totalThisYear += Number(r.amount);
    const name = r.category?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let commonCategory: string | null = null;
  let best = 0;
  counts.forEach((n, name) => {
    if (n > best) {
      best = n;
      commonCategory = name;
    }
  });
  return {
    rows: rows.slice(0, 10),
    count: rows.length,
    totalThisYear: Math.round(totalThisYear * 100) / 100,
    commonCategory,
  };
}

/** Search term for the merchant: its first meaningful word (the API matches substrings). */
function merchantSearchTerm(key: string): string {
  const word = key.split(' ').find((w) => w.length >= 3);
  return word ?? key;
}

/** Toast for an "always" answer's rule outcome (POST /api/categorisation/answers). */
export function ruleToast(
  rule: { status?: string; pattern?: string; reason?: string } | undefined,
  categoryName: string | undefined,
  merchant: string
): ToastOptions {
  if (rule?.status === 'skipped') {
    return { tone: 'neutral', message: `Categorised, but no rule was made${rule.reason ? `: ${rule.reason}` : ''}` };
  }
  return {
    tone: 'success',
    message: `Rule saved: "${rule?.pattern || merchant}" is always ${categoryName ?? 'that category'}`,
  };
}

export async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fieldClass =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-ink-3';
const primaryBtn =
  'inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-50';

export function TransactionPanel({ open, transaction, onClose, onSaved, onDelete, defaultAccountId }: TransactionPanelProps) {
  const isCreate = transaction === null;
  const { toast } = useToast();
  const { data: categories } = useCategories();
  const { data: accountData } = useAccounts({ enabled: open && isCreate });
  const accounts = useMemo(
    () => (accountData ?? []).filter((a) => TRANSACTION_ACCOUNT_TYPES.includes(a.type)),
    [accountData]
  );

  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [history, setHistory] = useState<MerchantHistory | null>(null);
  const [historyState, setHistoryState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Reset the form whenever the panel opens on a (different) transaction.
  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setSaving(false);
    if (transaction) {
      setDescription(transaction.description);
      setCategoryId(transaction.category_id);
    } else {
      setDescription('');
      setCategoryId(null);
      setDate(todayIso());
      setAmount('');
      setDirection('out');
      setAccountId(defaultAccountId ?? '');
    }
  }, [open, transaction, defaultAccountId]);

  const key = useMemo(() => (transaction ? merchantKey(transaction.description) : ''), [transaction]);

  // Merchant history: recent transactions with the same merchant key.
  useEffect(() => {
    if (!open || !transaction || !key) {
      setHistory(null);
      setHistoryState('idle');
      return;
    }
    const controller = new AbortController();
    setHistoryState('loading');
    const params = new URLSearchParams({ search: merchantSearchTerm(key), limit: '20', totals: '0' });
    fetch(`/api/transactions?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, 'Failed to load merchant history'));
        return res.json();
      })
      .then((json: { data?: HistoryRow[] }) => {
        const same = (json.data ?? []).filter((r) => merchantKey(r.description) === key);
        setHistory(summariseMerchantHistory(same));
        setHistoryState('idle');
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setHistory(null);
        setHistoryState('error');
      });
    return () => controller.abort();
  }, [open, transaction, key]);

  const category = categories?.find((c) => c.id === categoryId) ?? null;

  const handleSave = async () => {
    setFormError(null);
    if (isCreate) {
      const value = Number(amount);
      if (!description.trim()) return setFormError('Enter a description.');
      if (!date) return setFormError('Choose a date.');
      if (!accountId) return setFormError('Choose an account.');
      if (!Number.isFinite(value) || value <= 0) return setFormError('Enter an amount greater than zero.');
      setSaving(true);
      try {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            description: description.trim(),
            amount: direction === 'out' ? -value : value,
            account_id: accountId,
            category_id: categoryId,
            categorisation_source: 'manual',
          }),
        });
        if (!res.ok) throw new Error(await readError(res, 'Failed to create transaction'));
        toast({ tone: 'success', message: 'Transaction added' });
        onSaved();
        onClose();
      } catch (err) {
        toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to create transaction' });
      } finally {
        setSaving(false);
      }
      return;
    }

    const body: Record<string, unknown> = {};
    const trimmed = description.trim();
    if (!trimmed) return setFormError('Description cannot be empty.');
    if (trimmed !== transaction.description) body.description = trimmed;
    if (categoryId !== transaction.category_id) {
      body.category_id = categoryId;
      if (categoryId) body.categorisation_source = 'manual';
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to update transaction'));
      toast({ tone: 'success', message: 'Transaction saved' });
      onSaved();
      onClose();
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to update transaction' });
    } finally {
      setSaving(false);
    }
  };

  const handleAlways = async () => {
    if (!transaction || !categoryId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/categorisation/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [{ transaction_ids: [transaction.id], category_id: categoryId, always: true }] }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to create the rule'));
      const json = await res.json().catch(() => null);
      toast(ruleToast(json?.results?.[0]?.rule, category?.name, key));
      // Keep any description edit the user made alongside.
      if (description.trim() && description.trim() !== transaction.description) {
        await fetch(`/api/transactions/${transaction.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: description.trim() }),
        }).then(async (r) => {
          if (!r.ok) throw new Error(await readError(r, 'Failed to save the description'));
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to create the rule' });
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <div>
        {!isCreate && onDelete && (
          <button type="button" onClick={() => onDelete(transaction)} className={`${secondaryBtn} text-bad`}>
            Delete
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className={secondaryBtn}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className={primaryBtn}>
          {saving ? 'Saving...' : isCreate ? 'Add transaction' : 'Save'}
        </button>
      </div>
    </div>
  );

  return (
    <SidePanel open={open} onClose={onClose} title={isCreate ? 'Add transaction' : 'Transaction'} footer={footer}>
      {isCreate ? (
        <div className="space-y-4">
          <div>
            <span className={labelClass}>Direction</span>
            <div role="group" aria-label="Direction" className="inline-flex rounded-md border border-line p-0.5">
              {(['out', 'in'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={direction === d}
                  onClick={() => setDirection(d)}
                  className={`rounded-md px-3 py-1 text-sm ${direction === d ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-sunk'}`}
                >
                  {d === 'out' ? 'Money out' : 'Money in'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="txn-amount" className={labelClass}>
              Amount (£)
            </label>
            <input
              id="txn-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${fieldClass} fig`}
              data-autofocus
            />
          </div>
          <div>
            <label htmlFor="txn-date" className={labelClass}>
              Date
            </label>
            <input id="txn-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="txn-account" className={labelClass}>
              Account
            </label>
            <select id="txn-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldClass}>
              <option value="">Choose an account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="txn-description" className={labelClass}>
              Description
            </label>
            <input
              id="txn-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <span className={labelClass}>Category</span>
            <CategorySelect value={categoryId} onChange={(id) => setCategoryId(id)} allowClear placeholder="Uncategorised" />
          </div>
          {formError && <p className="text-sm text-bad">{formError}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className={`fig text-3xl font-semibold ${transaction.amount > 0 ? 'text-in' : 'text-ink'}`}>
              {formatAmount(transaction.amount)}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {formatDateGB(transaction.date)}
              {transaction.account?.name ? ` · ${transaction.account.name}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {transaction.is_validated && <span className="rounded-sm bg-accent-soft px-1.5 py-px text-ink-2">Validated</span>}
              {transaction.needs_review && <span className="rounded-sm bg-warn-soft px-1.5 py-px text-warn">Needs review</span>}
            </div>
          </div>

          <div>
            <span className={labelClass}>Bank text</span>
            <p className="fig break-words rounded-md border border-line bg-sunk px-3 py-2 text-xs text-ink-2">
              {transaction.description}
            </p>
          </div>

          <div>
            <span className={labelClass}>Category</span>
            <CategorySelect
              value={categoryId}
              onChange={(id) => setCategoryId(id)}
              allowClear
              placeholder="Uncategorised"
            />
            {categoryId && key && (
              <button
                type="button"
                onClick={handleAlways}
                disabled={saving}
                className="mt-2 text-left text-sm text-accent underline underline-offset-2 hover:no-underline disabled:opacity-50"
              >
                Always use {category?.name ?? 'this category'} for &ldquo;{key}&rdquo;
              </button>
            )}
          </div>

          <div>
            <label htmlFor="txn-note" className={labelClass}>
              Description
            </label>
            <input
              id="txn-note"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass}
            />
            {formError && <p className="mt-1 text-sm text-bad">{formError}</p>}
          </div>

          <section aria-labelledby="merchant-history-heading">
            <h3 id="merchant-history-heading" className={labelClass}>
              Merchant history
            </h3>
            {!key ? (
              <p className="text-sm text-ink-3">No merchant could be read from this description.</p>
            ) : historyState === 'loading' ? (
              <p className="text-sm text-ink-3">Loading...</p>
            ) : historyState === 'error' ? (
              <p className="text-sm text-ink-3">Merchant history could not be loaded.</p>
            ) : history && history.count > 0 ? (
              <>
                <p className="text-sm text-ink-2">
                  <span className="fig">{history.count}</span> recent transaction{history.count === 1 ? '' : 's'}
                  {' · '}
                  <span className="fig">{formatGBP(history.totalThisYear, { pence: true })}</span> this year
                  {history.commonCategory ? ` · usually ${history.commonCategory}` : ''}
                </p>
                <ul className="mt-2 divide-y divide-line-2 rounded-md border border-line">
                  {history.rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className={`truncate ${r.id === transaction.id ? 'font-medium text-ink' : 'text-ink'}`}>
                          {formatDateGB(r.date)}
                        </p>
                        <p className="truncate text-xs text-ink-3">{r.category?.name ?? 'Uncategorised'}</p>
                      </div>
                      <span className={`fig shrink-0 ${r.amount > 0 ? 'text-in' : 'text-ink'}`}>{formatAmount(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-ink-3">No other transactions from this merchant.</p>
            )}
          </section>
        </div>
      )}
    </SidePanel>
  );
}
