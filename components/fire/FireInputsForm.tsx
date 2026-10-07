'use client';

import { useState, useEffect, useMemo, useId, type ReactNode } from 'react';
import type { FireInputs } from '@/lib/types/fire';
import { formatGBP } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Notice, SkeletonRows } from '@/components/ui/Notice';
import { useToast } from '@/components/ui/Toast';

interface FireInputsFormProps {
  inputs: FireInputs | null;
  portfolioValue?: number;
  /** Save the changed inputs. Throw (or reject) to show an error. */
  onSave: (inputs: Partial<FireInputs>) => Promise<void>;
  isLoading?: boolean;
}

interface FormData {
  currentAge: number;
  dateOfBirth: string;
  targetRetirementAge: number;
  currentPortfolioValue: number;
  annualIncome: number;
  annualSavings: number;
  annualSpend: number;
  expectedReturn: number;
  withdrawalRate: number;
  includeStatePension: boolean;
  partnerStatePension: boolean;
  excludePropertyFromFire: boolean;
  normalFireSpend: number;
  fatFireSpend: number;
}

export function toFormData(inputs: FireInputs | null): FormData {
  return {
    currentAge: inputs?.currentAge ?? 35,
    dateOfBirth: inputs?.dateOfBirth ?? '',
    targetRetirementAge: inputs?.targetRetirementAge ?? 55,
    // Blank means "use account balances", so never prefill it with them.
    currentPortfolioValue: inputs?.currentPortfolioValue ?? 0,
    annualIncome: inputs?.annualIncome ?? 0,
    annualSavings: inputs?.annualSavings ?? 18000, // Default £1,500/month
    annualSpend: inputs?.annualSpend ?? 50000,
    expectedReturn: inputs?.expectedReturn ?? 7,
    withdrawalRate: inputs?.withdrawalRate ?? 4,
    includeStatePension: inputs?.includeStatePension ?? true,
    partnerStatePension: inputs?.partnerStatePension ?? false,
    excludePropertyFromFire: inputs?.excludePropertyFromFire ?? true,
    normalFireSpend: inputs?.normalFireSpend ?? 55000,
    fatFireSpend: inputs?.fatFireSpend ?? 65000,
  };
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-line-2 pt-4 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        {note && <p className="mt-0.5 text-xs text-ink-3">{note}</p>}
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * The one place FIRE inputs are edited. They drive the ERN analysis, the
 * maths planning tab and the Coast FIRE figure on the Net worth page.
 */
export function FireInputsForm({ inputs, portfolioValue, onSave, isLoading = false }: FireInputsFormProps) {
  const { toast } = useToast();
  const idp = useId();
  const id = (k: string) => `${idp}-${k}`;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(() => toFormData(inputs));
  const saved = useMemo(() => toFormData(inputs), [inputs]);

  // Update form data when inputs load from the API (or after a save)
  useEffect(() => {
    if (inputs) setFormData(toFormData(inputs));
  }, [inputs]);

  const dirty = JSON.stringify(formData) !== JSON.stringify(saved);
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setFormData((f) => ({ ...f, [k]: v }));
  const num = (v: string, fallback = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        currentAge: formData.currentAge,
        dateOfBirth: formData.dateOfBirth || null,
        targetRetirementAge: formData.targetRetirementAge || null,
        currentPortfolioValue: formData.currentPortfolioValue || null,
        annualIncome: formData.annualIncome || null,
        annualSavings: formData.annualSavings || null,
        annualSpend: formData.annualSpend,
        expectedReturn: formData.expectedReturn,
        withdrawalRate: formData.withdrawalRate,
        includeStatePension: formData.includeStatePension,
        partnerStatePension: formData.partnerStatePension,
        excludePropertyFromFire: formData.excludePropertyFromFire,
        normalFireSpend: formData.normalFireSpend,
        fatFireSpend: formData.fatFireSpend,
      });
      toast({ message: 'FIRE settings saved; the analysis will update', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The settings weren’t saved. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <SkeletonRows rows={8} />;

  return (
    <form
      className="grid max-w-5xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      {error && <Notice tone="error">{error}</Notice>}

      <Section title="You">
        <Field label="Date of birth" htmlFor={id('dob')} hint="Used to work out your exact age">
          <Input id={id('dob')} type="date" value={formData.dateOfBirth || ''} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </Field>
        <Field label="Age" htmlFor={id('age')} hint={formData.dateOfBirth ? 'Your date of birth takes priority' : undefined}>
          <Input id={id('age')} type="number" min={18} max={100} className="fig" value={formData.currentAge} onChange={(e) => set('currentAge', parseInt(e.target.value) || 0)} />
        </Field>
        <Field label="Target retirement age" htmlFor={id('retire')}>
          <Input
            id={id('retire')}
            type="number"
            min={30}
            max={100}
            className="fig"
            placeholder="Optional"
            value={formData.targetRetirementAge || ''}
            onChange={(e) => set('targetRetirementAge', parseInt(e.target.value) || 0)}
          />
        </Field>
      </Section>

      <Section title="Money in and out">
        <Field label="Spending a year in retirement" htmlFor={id('spend')} hint="Used by the analysis and Coast FIRE">
          <Input id={id('spend')} type="number" min={0} step={1000} className="fig" value={formData.annualSpend || ''} onChange={(e) => set('annualSpend', num(e.target.value, 0))} />
        </Field>
        <Field label="Saving a month" htmlFor={id('save')} hint={`${formatGBP(formData.annualSavings || 0)} a year`}>
          <Input
            id={id('save')}
            type="number"
            min={0}
            step={100}
            className="fig"
            placeholder="1500"
            value={Math.round((formData.annualSavings || 0) / 12) || ''}
            onChange={(e) => set('annualSavings', num(e.target.value) * 12)}
          />
        </Field>
        <Field label="Income a year" htmlFor={id('income')} hint="Optional">
          <Input id={id('income')} type="number" min={0} className="fig" placeholder="Optional" value={formData.annualIncome || ''} onChange={(e) => set('annualIncome', num(e.target.value))} />
        </Field>
        <Field
          label="Portfolio value"
          htmlFor={id('portfolio')}
          hint="Leave blank to use your account balances"
        >
          <Input
            id={id('portfolio')}
            type="number"
            min={0}
            className="fig"
            placeholder={portfolioValue ? `From accounts: ${formatGBP(portfolioValue)}` : 'From your accounts'}
            value={formData.currentPortfolioValue || ''}
            onChange={(e) => set('currentPortfolioValue', num(e.target.value))}
          />
        </Field>
      </Section>

      <Section title="Assumptions">
        <Field label="Growth a year, after inflation (%)" htmlFor={id('return')} hint="Usually 4 to 7">
          <Input id={id('return')} type="number" min={0} max={15} step={0.5} className="fig" value={formData.expectedReturn} onChange={(e) => set('expectedReturn', num(e.target.value, 7))} />
        </Field>
        <Field label="Withdrawal rate (%)" htmlFor={id('swr')} hint="Share of the pot spent each year; 4 is the classic rule">
          <Input id={id('swr')} type="number" min={1} max={10} step={0.25} className="fig" value={formData.withdrawalRate} onChange={(e) => set('withdrawalRate', num(e.target.value, 4))} />
        </Field>
        <div className="grid content-start gap-3 sm:col-span-2 lg:col-span-1">
          <Check checked={formData.includeStatePension} onChange={(v) => set('includeStatePension', v)} label="Include my state pension" />
          <Check checked={formData.partnerStatePension} onChange={(v) => set('partnerStatePension', v)} label="Include my partner's state pension" />
          <Check
            checked={formData.excludePropertyFromFire}
            onChange={(v) => set('excludePropertyFromFire', v)}
            label="Leave property out"
            hint="Don't count your home towards Coast FIRE"
          />
        </div>
      </Section>

      <Section title="Targets for the maths tab" note="Two spending levels to compare: comfortable and generous.">
        <Field label="Comfortable spending a year" htmlFor={id('normal')}>
          <Input id={id('normal')} type="number" min={0} step={1000} className="fig" value={formData.normalFireSpend || ''} onChange={(e) => set('normalFireSpend', num(e.target.value, 55000))} />
        </Field>
        <Field label="Generous (FAT) spending a year" htmlFor={id('fat')}>
          <Input id={id('fat')} type="number" min={0} step={1000} className="fig" value={formData.fatFireSpend || ''} onChange={(e) => set('fatFireSpend', num(e.target.value, 65000))} />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        {dirty && <span className="mr-auto text-[12.5px] text-warn">Unsaved changes</span>}
        <Button variant="ghost" disabled={!dirty || isSaving} onClick={() => setFormData(saved)}>
          Undo changes
        </Button>
        <Button type="submit" variant="primary" loading={isSaving} disabled={!dirty}>
          {isSaving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
