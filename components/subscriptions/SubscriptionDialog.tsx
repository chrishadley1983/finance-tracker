'use client';

import { useEffect, useState } from 'react';
import { FREQUENCIES, SCOPES, STATUSES, type AssessedSubscription } from '@/lib/subscriptions/analysis';

export interface SubscriptionDraft {
  name: string;
  provider: string;
  scope: (typeof SCOPES)[number];
  category: string;
  amount: string;
  frequency: (typeof FREQUENCIES)[number];
  status: (typeof STATUSES)[number];
  next_renewal_date: string;
  cancellation_notice_days: string;
  bank_description_pattern: string;
  payment_method: string;
  notes: string;
}

export const emptyDraft: SubscriptionDraft = {
  name: '',
  provider: '',
  scope: 'personal',
  category: '',
  amount: '',
  frequency: 'monthly',
  status: 'active',
  next_renewal_date: '',
  cancellation_notice_days: '',
  bank_description_pattern: '',
  payment_method: '',
  notes: '',
};

export function draftFrom(s: AssessedSubscription): SubscriptionDraft {
  return {
    name: s.name,
    provider: s.provider ?? '',
    scope: (SCOPES as readonly string[]).includes(s.scope) ? (s.scope as SubscriptionDraft['scope']) : 'personal',
    category: s.category ?? '',
    amount: String(s.amount),
    frequency: (FREQUENCIES as readonly string[]).includes(s.frequency)
      ? (s.frequency as SubscriptionDraft['frequency'])
      : 'monthly',
    status: (STATUSES as readonly string[]).includes(s.status ?? '')
      ? (s.status as SubscriptionDraft['status'])
      : 'active',
    next_renewal_date: s.next_renewal_date ?? '',
    cancellation_notice_days: s.cancellation_notice_days != null ? String(s.cancellation_notice_days) : '',
    bank_description_pattern: s.bank_description_pattern ?? '',
    payment_method: s.payment_method ?? '',
    notes: s.notes ?? '',
  };
}

/** The request body for a draft: blanks become null so a cleared field is cleared in the database. */
export function bodyFrom(d: SubscriptionDraft) {
  const orNull = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    name: d.name.trim(),
    provider: orNull(d.provider),
    scope: d.scope,
    category: orNull(d.category),
    amount: Number(d.amount),
    frequency: d.frequency,
    status: d.status,
    next_renewal_date: orNull(d.next_renewal_date),
    cancellation_notice_days: d.cancellation_notice_days.trim() === '' ? null : Number(d.cancellation_notice_days),
    bank_description_pattern: orNull(d.bank_description_pattern),
    payment_method: orNull(d.payment_method),
    notes: orNull(d.notes),
  };
}

interface SubscriptionDialogProps {
  open: boolean;
  /** Set when editing an existing subscription. */
  editingId: string | null;
  initial: SubscriptionDraft;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

export function SubscriptionDialog({ open, editingId, initial, categories, onClose, onSaved }: SubscriptionDialogProps) {
  const [draft, setDraft] = useState<SubscriptionDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof SubscriptionDraft>(key: K, value: SubscriptionDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/subscriptions/${editingId}` : '/api/subscriptions', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyFrom(draft)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = Array.isArray(body.details) && body.details[0]?.message ? `: ${body.details[0].message}` : '';
        throw new Error(`${body.error ?? 'Could not save'}${detail}`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-dialog-title"
        className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="subscription-dialog-title" className="text-lg font-semibold text-slate-900">
            {editingId ? 'Edit subscription' : 'Add subscription'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="sub-name" className={labelClass}>
                Name <span className="text-red-500">*</span>
              </label>
              <input id="sub-name" className={inputClass} value={draft.name} maxLength={120} required
                onChange={(e) => set('name', e.target.value)} />
            </div>

            <div>
              <label htmlFor="sub-amount" className={labelClass}>
                Amount (£) <span className="text-red-500">*</span>
              </label>
              <input id="sub-amount" type="number" step="0.01" min="0.01" className={inputClass} value={draft.amount}
                required onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sub-frequency" className={labelClass}>Every</label>
              <select id="sub-frequency" className={inputClass} value={draft.frequency}
                onChange={(e) => set('frequency', e.target.value as SubscriptionDraft['frequency'])}>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="sub-scope" className={labelClass}>Scope</label>
              <select id="sub-scope" className={inputClass} value={draft.scope}
                onChange={(e) => set('scope', e.target.value as SubscriptionDraft['scope'])}>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sub-status" className={labelClass}>Status</label>
              <select id="sub-status" className={inputClass} value={draft.status}
                onChange={(e) => set('status', e.target.value as SubscriptionDraft['status'])}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="sub-category" className={labelClass}>Category</label>
              <input id="sub-category" className={inputClass} value={draft.category} list="sub-categories" maxLength={60}
                onChange={(e) => set('category', e.target.value)} />
              <datalist id="sub-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="sub-provider" className={labelClass}>Provider</label>
              <input id="sub-provider" className={inputClass} value={draft.provider} maxLength={120}
                onChange={(e) => set('provider', e.target.value)} />
            </div>

            <div className="col-span-2">
              <label htmlFor="sub-pattern" className={labelClass}>Text on the bank statement</label>
              <input id="sub-pattern" className={inputClass} value={draft.bank_description_pattern} maxLength={120}
                placeholder="e.g. NETFLIX.COM" onChange={(e) => set('bank_description_pattern', e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Used to find its charges and spot missed payments or price changes.</p>
            </div>

            <div>
              <label htmlFor="sub-renewal" className={labelClass}>Next renewal</label>
              <input id="sub-renewal" type="date" className={inputClass} value={draft.next_renewal_date}
                onChange={(e) => set('next_renewal_date', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sub-notice" className={labelClass}>Notice to cancel (days)</label>
              <input id="sub-notice" type="number" min="0" max="365" className={inputClass}
                value={draft.cancellation_notice_days} onChange={(e) => set('cancellation_notice_days', e.target.value)} />
            </div>

            <div className="col-span-2">
              <label htmlFor="sub-payment" className={labelClass}>Paid with</label>
              <input id="sub-payment" className={inputClass} value={draft.payment_method} maxLength={60}
                onChange={(e) => set('payment_method', e.target.value)} />
            </div>

            <div className="col-span-2">
              <label htmlFor="sub-notes" className={labelClass}>Notes</label>
              <textarea id="sub-notes" rows={2} className={inputClass} value={draft.notes} maxLength={1000}
                onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
