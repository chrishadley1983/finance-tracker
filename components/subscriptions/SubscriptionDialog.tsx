'use client';

import { useEffect, useState } from 'react';
import { FREQUENCIES, SCOPES, STATUSES, type AssessedSubscription } from '@/lib/subscriptions/analysis';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';

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

const FREQ_LABEL: Record<SubscriptionDraft['frequency'], string> = {
  weekly: 'Week',
  fortnightly: 'Fortnight',
  monthly: 'Month',
  quarterly: 'Quarter',
  termly: 'Term',
  annual: 'Year',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    <Modal
      open={open}
      onClose={onClose}
      title={editingId ? 'Edit subscription' : 'Add subscription'}
      onSubmit={submit}
      widthClassName="max-w-lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>
            {editingId ? 'Save changes' : 'Add subscription'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Name" htmlFor="sub-name">
          <Input id="sub-name" value={draft.name} maxLength={120} required onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount (£)" htmlFor="sub-amount">
            <Input id="sub-amount" type="number" step="0.01" min="0.01" className="fig" value={draft.amount} required
              onChange={(e) => set('amount', e.target.value)} />
          </Field>
          <Field label="Every" htmlFor="sub-frequency">
            <Select id="sub-frequency" value={draft.frequency}
              onChange={(e) => set('frequency', e.target.value as SubscriptionDraft['frequency'])}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
            </Select>
          </Field>
          <Field label="Scope" htmlFor="sub-scope">
            <Select id="sub-scope" value={draft.scope}
              onChange={(e) => set('scope', e.target.value as SubscriptionDraft['scope'])}>
              {SCOPES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </Select>
          </Field>
          <Field label="Status" htmlFor="sub-status">
            <Select id="sub-status" value={draft.status}
              onChange={(e) => set('status', e.target.value as SubscriptionDraft['status'])}>
              {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </Select>
          </Field>
          <Field label="Category" htmlFor="sub-category">
            <Input id="sub-category" value={draft.category} list="sub-categories" maxLength={60}
              onChange={(e) => set('category', e.target.value)} />
            <datalist id="sub-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Provider" htmlFor="sub-provider">
            <Input id="sub-provider" value={draft.provider} maxLength={120} onChange={(e) => set('provider', e.target.value)} />
          </Field>
        </div>
        <Field label="Text on the bank statement" htmlFor="sub-pattern"
          hint="Used to find its charges and spot missed payments or price changes.">
          <Input id="sub-pattern" className="fig" value={draft.bank_description_pattern} maxLength={120}
            placeholder="e.g. NETFLIX.COM" onChange={(e) => set('bank_description_pattern', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Next renewal" htmlFor="sub-renewal">
            <Input id="sub-renewal" type="date" value={draft.next_renewal_date}
              onChange={(e) => set('next_renewal_date', e.target.value)} />
          </Field>
          <Field label="Notice to cancel (days)" htmlFor="sub-notice">
            <Input id="sub-notice" type="number" min="0" max="365" value={draft.cancellation_notice_days}
              onChange={(e) => set('cancellation_notice_days', e.target.value)} />
          </Field>
        </div>
        <Field label="Paid with" htmlFor="sub-payment">
          <Input id="sub-payment" value={draft.payment_method} maxLength={60} onChange={(e) => set('payment_method', e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="sub-notes">
          <Textarea id="sub-notes" rows={2} value={draft.notes} maxLength={1000} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
