'use client';

import { useState, useEffect, useCallback, useId, type ReactNode } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { formatGBP } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { controlClass } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Disclosure } from '../Disclosure';
import { readableGBP, readablePct } from '../readable';

export interface WrapperBalancesUI {
  isa: number;
  sipp: number;
  gia: number;
  cash: number;
}

export interface ErnConfig {
  portfolio: number;
  annualSpend: number;
  equityAllocation: number;
  horizonYears: number;
  preserveFraction: number;
  glidepathEnabled: boolean;
  statePensionAnnual: number;
  statePensionStartAge: number;
  currentAge: number;
  gogoEnabled: boolean;
  guardrailEnabled: boolean;
  mcPaths: number;
  // Pre-retirement / accumulation
  retirementAge?: number;
  annualSavings?: number;
  partialEarningsAnnual?: number;
  partialEarningsYears?: number;
  // UK tax wrapper mix
  wrapperBalances?: WrapperBalancesUI;
}

interface ErnConfigPanelProps {
  config: ErnConfig;
  onConfigChange: (config: ErnConfig) => void;
  isLoading?: boolean;
  livePortfolio?: number | null;
  liveWrapperBalances?: WrapperBalancesUI | null;
}

// ---- localStorage persistence (best effort: storage can be blocked) ----

const LOCKS_KEY = 'ern-config-locks';
const VALUES_KEY = 'ern-config-locked-values';

type LockableField =
  | 'portfolio' | 'annualSpend' | 'equityAllocation' | 'horizonYears'
  | 'preserveFraction' | 'currentAge' | 'statePensionAnnual' | 'statePensionStartAge'
  | 'retirementAge' | 'annualSavings' | 'partialEarningsAnnual' | 'partialEarningsYears'
  | 'wrapperBalances';

type LocksMap = Partial<Record<LockableField, boolean>>;

function loadLocks(): LocksMap {
  try {
    const raw = localStorage.getItem(LOCKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLocks(locks: LocksMap) {
  try {
    localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
  } catch {
    // ignore: locks just won't survive a reload
  }
}

function loadLockedValues(): Partial<ErnConfig> {
  try {
    const raw = localStorage.getItem(VALUES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLockedValues(locks: LocksMap, draft: ErnConfig) {
  const values: Record<string, unknown> = {};
  for (const [field, locked] of Object.entries(locks)) {
    if (locked) {
      values[field] = (draft as unknown as Record<string, unknown>)[field];
    }
  }
  try {
    localStorage.setItem(VALUES_KEY, JSON.stringify(values));
  } catch {
    // ignore
  }
}

/** Values the user has locked, to apply over any other source on the first run. */
export function loadLockedOverrides(): Partial<ErnConfig> {
  const locks = loadLocks();
  const values = loadLockedValues() as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [field, locked] of Object.entries(locks)) {
    if (locked && values[field] !== undefined) out[field] = values[field];
  }
  return out as Partial<ErnConfig>;
}

// ---- Small building blocks ----

function LockButton({ locked, onToggle, label }: { locked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
      title={locked ? 'Locked: this value is kept between visits. Select to unlock.' : 'Lock this value so it is kept between visits.'}
      className={`rounded-sm p-0.5 focus-visible:outline-2 focus-visible:outline-accent ${locked ? 'text-warn' : 'text-ink-3 opacity-60 hover:opacity-100'}`}
    >
      {locked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : <Unlock className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

function LockField({
  label,
  locked,
  onToggleLock,
  hint,
  aside,
  children,
}: {
  label: string;
  locked?: boolean;
  onToggleLock?: () => void;
  hint?: ReactNode;
  aside?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid content-start gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
            {label}
          </label>
          {onToggleLock && <LockButton locked={!!locked} onToggle={onToggleLock} label={label} />}
        </span>
        {aside}
      </div>
      {children(id)}
      {locked ? <p className="text-xs text-warn">Locked between visits</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

function NumberInput({ id, value, onChange, disabled, locked, min, max, step, prefix }: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  locked?: boolean;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}) {
  if (prefix === '£') {
    return (
      <MoneyInput
        id={id}
        value={Number.isFinite(value) ? value : null}
        onChange={(v) => onChange(v ?? 0)}
        disabled={disabled}
        inputClassName={locked ? 'border-warn/60' : ''}
      />
    );
  }
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">{prefix}</span>}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${controlClass} fig ${prefix ? 'pl-7' : ''} ${locked ? 'border-warn/60' : ''}`}
      />
    </div>
  );
}

function Range({ id, value, min, max, step = 1, onChange, ends }: {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  ends: [string, string];
}) {
  return (
    <div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
      <div className="flex justify-between text-[11.5px] text-ink-3">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
      <span>
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
    </label>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-t border-line-2 pt-3">
      <legend className="sr-only">{title}</legend>
      <div>
        <h3 className="text-[13px] font-semibold text-ink" aria-hidden>
          {title}
        </h3>
        {note && <p className="text-xs text-ink-3">{note}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

// ---- Main component ----

export function ErnConfigPanel({
  config,
  onConfigChange,
  isLoading = false,
  livePortfolio,
  liveWrapperBalances,
}: ErnConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [locks, setLocks] = useState<LocksMap>(() => loadLocks());
  const [draft, setDraft] = useState<ErnConfig>(() => {
    // On first render, apply any locked values over the initial config
    const locked = loadLockedValues();
    return { ...config, ...locked };
  });

  // Toggle states for live data (only apply when field is NOT locked)
  const [useLivePortfolio, setUseLivePortfolio] = useState(!locks.portfolio);
  const [useLiveWrappers, setUseLiveWrappers] = useState(!locks.wrapperBalances);

  // Persist locks + values whenever they change
  const persistLocks = useCallback((newLocks: LocksMap, currentDraft: ErnConfig) => {
    saveLocks(newLocks);
    saveLockedValues(newLocks, currentDraft);
  }, []);

  const toggleLock = useCallback((field: LockableField) => {
    setLocks(prev => {
      const next = { ...prev, [field]: !prev[field] };
      // When locking portfolio or wrappers, disable "use live" for that field
      if (next[field]) {
        if (field === 'portfolio') setUseLivePortfolio(false);
        if (field === 'wrapperBalances') setUseLiveWrappers(false);
      }
      persistLocks(next, draft);
      return next;
    });
  }, [draft, persistLocks]);

  // Sync draft when config prop changes (e.g. after net worth fetch)
  // but respect locks — locked values don't get overwritten
  useEffect(() => {
    setDraft(prev => {
      const next = { ...config };
      const lockedValues = loadLockedValues();

      // Apply locked values over incoming config
      for (const [field, value] of Object.entries(lockedValues)) {
        if (locks[field as LockableField]) {
          (next as Record<string, unknown>)[field] = value;
        }
      }

      // Also preserve manual overrides for live-toggle fields
      if (!useLivePortfolio && !locks.portfolio) {
        next.portfolio = prev.portfolio;
      }
      if (!useLiveWrappers && !locks.wrapperBalances) {
        next.wrapperBalances = prev.wrapperBalances;
      }

      return next;
    });
  }, [config, locks, useLivePortfolio, useLiveWrappers]);

  // When switching from manual back to live, apply the live values (unless locked)
  useEffect(() => {
    if (useLivePortfolio && !locks.portfolio && livePortfolio != null) {
      setDraft(prev => ({ ...prev, portfolio: livePortfolio }));
    }
  }, [useLivePortfolio, livePortfolio, locks.portfolio]);

  useEffect(() => {
    if (useLiveWrappers && !locks.wrapperBalances && liveWrapperBalances) {
      setDraft(prev => ({ ...prev, wrapperBalances: liveWrapperBalances }));
    }
  }, [useLiveWrappers, liveWrapperBalances, locks.wrapperBalances]);

  // Re-persist values whenever draft changes and there are active locks
  useEffect(() => {
    const hasAnyLock = Object.values(locks).some(Boolean);
    if (hasAnyLock) {
      saveLockedValues(locks, draft);
    }
  }, [draft, locks]);

  const handleSubmit = () => {
    onConfigChange(draft);
  };

  const wrPct = draft.portfolio > 0 ? (draft.annualSpend / draft.portfolio) * 100 : 0;
  const hasLivePortfolio = livePortfolio != null && livePortfolio > 0;
  const hasLiveWrappers = liveWrapperBalances != null;
  const wrapperTotal = draft.wrapperBalances
    ? draft.wrapperBalances.isa + draft.wrapperBalances.sipp + draft.wrapperBalances.gia + draft.wrapperBalances.cash
    : 0;
  const lockedCount = Object.values(locks).filter(Boolean).length;
  const retireAge = draft.retirementAge ?? draft.currentAge;
  const set = <K extends keyof ErnConfig>(key: K, value: ErnConfig[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const lockProps = (field: LockableField) => ({ locked: !!locks[field], onToggleLock: () => toggleLock(field) });
  const portfolioIsLive = useLivePortfolio && hasLivePortfolio && !locks.portfolio;
  const wrappersAreLive = !locks.wrapperBalances && useLiveWrappers && hasLiveWrappers;

  const summary = (
    <>
      <span className="fig">{readableGBP(draft.portfolio)}</span> pot, <span className="fig">{readableGBP(draft.annualSpend)}</span> a year (
      <span className="fig">{readablePct(wrPct)}</span> of today&apos;s pot), {Math.round(draft.equityAllocation * 100)}% shares, {draft.horizonYears}-year horizon
      {retireAge > draft.currentAge && <>, retiring at {retireAge}</>}
      {lockedCount > 0 && (
        <>
          {' '}
          <Chip tone="warn">
            {lockedCount} locked
          </Chip>
        </>
      )}
    </>
  );

  const WRAPPERS: Record<keyof WrapperBalancesUI, { name: string; hint: string }> = {
    isa: { name: 'ISA', hint: 'Tax-free withdrawals' },
    sipp: { name: 'SIPP / pension', hint: '25% tax-free, rest taxed' },
    gia: { name: 'GIA', hint: 'CGT on gains only' },
    cash: { name: 'Cash', hint: 'Buffer; no growth' },
  };

  return (
    <Disclosure title="What-if settings" summary={summary} open={isExpanded} onOpenChange={setIsExpanded}>
      <form
        className="grid gap-5 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <p className="max-w-[80ch] text-[12.5px] text-ink-3">
          Age, spending, retirement age and savings start from your FIRE settings; changes here only affect this analysis. Simulation
          settings are remembered on this device; lock any value to keep it between visits.
        </p>

        <Group title="Your money" note={wrappersAreLive ? 'Pot sizes come from your account balances (property excluded).' : undefined}>
          <LockField
            label="Pot today"
            {...lockProps('portfolio')}
            hint={portfolioIsLive ? 'From your accounts' : undefined}
            aside={
              hasLivePortfolio && !locks.portfolio ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-3">
                  <input type="checkbox" checked={useLivePortfolio} onChange={(e) => setUseLivePortfolio(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                  Use accounts
                </label>
              ) : undefined
            }
          >
            {(id) => <NumberInput id={id} prefix="£" value={draft.portfolio} onChange={(v) => set('portfolio', v)} disabled={portfolioIsLive} locked={locks.portfolio} min={0} step={1000} />}
          </LockField>

          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-3 lg:self-end">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
              Split by tax wrapper, which sets the drawdown order
              <LockButton locked={!!locks.wrapperBalances} onToggle={() => toggleLock('wrapperBalances')} label="the wrapper split" />
            </span>
            {hasLiveWrappers && !locks.wrapperBalances && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-3">
                <input type="checkbox" checked={useLiveWrappers} onChange={(e) => setUseLiveWrappers(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                Use accounts
              </label>
            )}
          </div>

          {(Object.keys(WRAPPERS) as (keyof WrapperBalancesUI)[]).map((w) => (
            <LockField
              key={w}
              label={WRAPPERS[w].name}
              hint={WRAPPERS[w].hint}
            >
              {(id) => (
                <NumberInput
                  id={id}
                  prefix="£"
                  min={0}
                  step={1000}
                  value={draft.wrapperBalances?.[w] ?? 0}
                  locked={locks.wrapperBalances}
                  disabled={wrappersAreLive}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      wrapperBalances: {
                        isa: d.wrapperBalances?.isa ?? 0,
                        sipp: d.wrapperBalances?.sipp ?? 0,
                        gia: d.wrapperBalances?.gia ?? 0,
                        cash: d.wrapperBalances?.cash ?? 0,
                        [w]: v,
                      },
                    }))
                  }
                />
              )}
            </LockField>
          ))}
          {draft.wrapperBalances && Math.abs(wrapperTotal - draft.portfolio) > 100 && (
            <p className="text-xs text-warn sm:col-span-2 lg:col-span-4">
              The pots add up to {formatGBP(wrapperTotal)}, {formatGBP(Math.abs(wrapperTotal - draft.portfolio))}{' '}
              {wrapperTotal > draft.portfolio ? 'more' : 'less'} than the pot today.
            </p>
          )}
        </Group>

        <Group title="Timeline">
          <LockField label="Age now" {...lockProps('currentAge')}>
            {(id) => <NumberInput id={id} value={draft.currentAge} onChange={(v) => set('currentAge', v)} locked={locks.currentAge} min={18} max={100} />}
          </LockField>
          <LockField
            label="Retirement age"
            {...lockProps('retirementAge')}
            hint={retireAge > draft.currentAge ? `${retireAge - draft.currentAge} years from now` : 'Retiring now'}
          >
            {(id) => <NumberInput id={id} value={retireAge} onChange={(v) => set('retirementAge', v)} locked={locks.retirementAge} min={draft.currentAge} max={100} />}
          </LockField>
          <LockField label={`Plan to last ${draft.horizonYears} years`} {...lockProps('horizonYears')}>
            {(id) => <Range id={id} min={20} max={60} value={draft.horizonYears} onChange={(v) => set('horizonYears', v)} ends={['20', '60 years']} />}
          </LockField>
          <div />
          <LockField label="State pension a year" {...lockProps('statePensionAnnual')} hint="Household total, today's money">
            {(id) => <NumberInput id={id} prefix="£" value={draft.statePensionAnnual} onChange={(v) => set('statePensionAnnual', v)} locked={locks.statePensionAnnual} min={0} step={100} />}
          </LockField>
          <LockField label="State pension from age" {...lockProps('statePensionStartAge')}>
            {(id) => <NumberInput id={id} value={draft.statePensionStartAge} onChange={(v) => set('statePensionStartAge', v)} locked={locks.statePensionStartAge} min={55} max={80} />}
          </LockField>
        </Group>

        <Group title="Spending and income">
          <LockField label="Spending a year" {...lockProps('annualSpend')}>
            {(id) => <NumberInput id={id} prefix="£" value={draft.annualSpend} onChange={(v) => set('annualSpend', v)} locked={locks.annualSpend} min={0} step={1000} />}
          </LockField>
          <LockField label="Saving a year until retiring" {...lockProps('annualSavings')}>
            {(id) => <NumberInput id={id} prefix="£" value={draft.annualSavings ?? 0} onChange={(v) => set('annualSavings', v)} locked={locks.annualSavings} min={0} step={1000} />}
          </LockField>
          <LockField label="Part-time earnings a year" {...lockProps('partialEarningsAnnual')} hint="After retiring, e.g. consulting">
            {(id) => <NumberInput id={id} prefix="£" value={draft.partialEarningsAnnual ?? 0} onChange={(v) => set('partialEarningsAnnual', v)} locked={locks.partialEarningsAnnual} min={0} step={1000} />}
          </LockField>
          <LockField label="For how many years" {...lockProps('partialEarningsYears')}>
            {(id) => <NumberInput id={id} value={draft.partialEarningsYears ?? 0} onChange={(v) => set('partialEarningsYears', v)} locked={locks.partialEarningsYears} min={0} max={30} />}
          </LockField>
          <div className="grid gap-3 sm:col-span-2 lg:col-span-4 lg:grid-cols-2">
            <Toggle checked={draft.gogoEnabled} onChange={(v) => set('gogoEnabled', v)} label="Spend less later in life" hint="90% of spending from 75, 80% from 80" />
            <Toggle checked={draft.guardrailEnabled} onChange={(v) => set('guardrailEnabled', v)} label="Cut spending in a bad market" hint="15% less while the pot is under 80% of its peak" />
          </div>
        </Group>

        <Group title="Investments">
          <LockField label={`Shares ${Math.round(draft.equityAllocation * 100)}%, bonds ${100 - Math.round(draft.equityAllocation * 100)}%`} {...lockProps('equityAllocation')}>
            {(id) => <Range id={id} min={40} max={100} value={Math.round(draft.equityAllocation * 100)} onChange={(v) => set('equityAllocation', v / 100)} ends={['40%', '100% shares']} />}
          </LockField>
          <LockField label={`Leave ${Math.round(draft.preserveFraction * 100)}% of the pot at the end`} {...lockProps('preserveFraction')}>
            {(id) => <Range id={id} min={0} max={100} value={Math.round(draft.preserveFraction * 100)} onChange={(v) => set('preserveFraction', v / 100)} ends={['Spend it all', 'Keep it all']} />}
          </LockField>
          <div className="sm:col-span-2">
            <Toggle checked={draft.glidepathEnabled} onChange={(v) => set('glidepathEnabled', v)} label="Glidepath" hint="Start at 60% shares and rise to 100% over the first years" />
          </div>
        </Group>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-2 pt-3">
          <Button variant="ghost" onClick={() => setIsExpanded(false)}>
            Close
          </Button>
          <Button type="submit" variant="primary" loading={isLoading}>
            {isLoading ? 'Running…' : 'Run analysis'}
          </Button>
        </div>
      </form>
    </Disclosure>
  );
}
