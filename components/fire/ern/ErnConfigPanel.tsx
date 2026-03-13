'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, ChevronDown, ChevronUp, Play, Lock, Unlock } from 'lucide-react';

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

// ---- localStorage persistence ----

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
  localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
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
  localStorage.setItem(VALUES_KEY, JSON.stringify(values));
}

// ---- Helpers ----

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---- Lock button component ----

function LockButton({
  locked,
  onToggle,
}: {
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={locked ? 'Locked — value persists across sessions. Click to unlock.' : 'Click to lock this value across sessions.'}
      className={`p-0.5 rounded transition-colors ${
        locked
          ? 'text-amber-500 hover:text-amber-600'
          : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'
      }`}
    >
      {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
    </button>
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

  const wrPct = draft.portfolio > 0
    ? ((draft.annualSpend / draft.portfolio) * 100).toFixed(2)
    : '0';

  const hasLivePortfolio = livePortfolio != null && livePortfolio > 0;
  const hasLiveWrappers = liveWrapperBalances != null;

  const wrapperTotal = draft.wrapperBalances
    ? draft.wrapperBalances.isa + draft.wrapperBalances.sipp + draft.wrapperBalances.gia + draft.wrapperBalances.cash
    : 0;

  const lockedCount = Object.values(locks).filter(Boolean).length;

  // Helper to render a field label with lock button
  const FieldLabel = ({ field, children }: { field: LockableField; children: React.ReactNode }) => (
    <div className="flex items-center gap-1.5 mb-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {children}
      </label>
      <LockButton locked={!!locks[field]} onToggle={() => toggleLock(field)} />
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
      {/* Collapsed summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-gray-400" />
          <div>
            <span className="font-medium text-gray-900 dark:text-white">ERN Configuration</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-3">
              {formatCurrency(draft.portfolio)} portfolio | {formatCurrency(draft.annualSpend)}/yr ({wrPct}% WR) | {draft.equityAllocation * 100}/{(1 - draft.equityAllocation) * 100} equity/bond | {draft.horizonYears}yr horizon
              {draft.retirementAge && draft.retirementAge > draft.currentAge && (
                <> | retire at {draft.retirementAge}</>
              )}
              {lockedCount > 0 && (
                <span className="inline-flex items-center gap-0.5 ml-2 text-amber-500">
                  <Lock className="h-3 w-3" /> {lockedCount}
                </span>
              )}
            </span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Expanded form */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Portfolio */}
            <div>
              <div className="flex items-center justify-between">
                <FieldLabel field="portfolio">Portfolio Value</FieldLabel>
                {hasLivePortfolio && !locks.portfolio && (
                  <label className="flex items-center gap-1.5 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={useLivePortfolio}
                      onChange={(e) => setUseLivePortfolio(e.target.checked)}
                      className="rounded accent-emerald-500 h-3.5 w-3.5"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Use live</span>
                  </label>
                )}
              </div>
              <input
                type="number"
                value={draft.portfolio}
                onChange={(e) => setDraft({ ...draft, portfolio: Number(e.target.value) })}
                disabled={useLivePortfolio && hasLivePortfolio && !locks.portfolio}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  locks.portfolio
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                    : useLivePortfolio && hasLivePortfolio
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              />
              {locks.portfolio && (
                <p className="text-xs text-amber-500 mt-1">Locked across sessions</p>
              )}
              {!locks.portfolio && useLivePortfolio && hasLivePortfolio && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  From your accounts (excl. property)
                </p>
              )}
            </div>

            {/* Annual Spend */}
            <div>
              <FieldLabel field="annualSpend">Annual Spend</FieldLabel>
              <input
                type="number"
                value={draft.annualSpend}
                onChange={(e) => setDraft({ ...draft, annualSpend: Number(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  locks.annualSpend
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              />
              {locks.annualSpend && <p className="text-xs text-amber-500 mt-1">Locked across sessions</p>}
            </div>

            {/* Equity Allocation */}
            <div>
              <FieldLabel field="equityAllocation">
                Equity: {(draft.equityAllocation * 100).toFixed(0)}%
              </FieldLabel>
              <input
                type="range"
                min="40"
                max="100"
                value={draft.equityAllocation * 100}
                onChange={(e) => setDraft({ ...draft, equityAllocation: Number(e.target.value) / 100 })}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>40%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Horizon */}
            <div>
              <FieldLabel field="horizonYears">
                Horizon: {draft.horizonYears} years
              </FieldLabel>
              <input
                type="range"
                min="20"
                max="60"
                value={draft.horizonYears}
                onChange={(e) => setDraft({ ...draft, horizonYears: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>20yr</span>
                <span>60yr</span>
              </div>
            </div>

            {/* Capital Preservation */}
            <div>
              <FieldLabel field="preserveFraction">
                Preserve: {(draft.preserveFraction * 100).toFixed(0)}%
              </FieldLabel>
              <input
                type="range"
                min="0"
                max="100"
                value={draft.preserveFraction * 100}
                onChange={(e) => setDraft({ ...draft, preserveFraction: Number(e.target.value) / 100 })}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Deplete</span>
                <span>Full preserve</span>
              </div>
            </div>

            {/* Current Age */}
            <div>
              <FieldLabel field="currentAge">Current Age</FieldLabel>
              <input
                type="number"
                value={draft.currentAge}
                onChange={(e) => setDraft({ ...draft, currentAge: Number(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  locks.currentAge
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              />
            </div>

            {/* State Pension */}
            <div>
              <FieldLabel field="statePensionAnnual">State Pension (annual)</FieldLabel>
              <input
                type="number"
                value={draft.statePensionAnnual}
                onChange={(e) => setDraft({ ...draft, statePensionAnnual: Number(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  locks.statePensionAnnual
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              />
            </div>

            {/* Pension Start Age */}
            <div>
              <FieldLabel field="statePensionStartAge">Pension Start Age</FieldLabel>
              <input
                type="number"
                value={draft.statePensionStartAge}
                onChange={(e) => setDraft({ ...draft, statePensionStartAge: Number(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  locks.statePensionStartAge
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              />
            </div>

            {/* Pre-Retirement Section */}
            <div className="col-span-full">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                Pre-Retirement
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <FieldLabel field="retirementAge">Retirement Age</FieldLabel>
                  <input
                    type="number"
                    min={draft.currentAge}
                    max={100}
                    value={draft.retirementAge ?? draft.currentAge}
                    onChange={(e) => setDraft({ ...draft, retirementAge: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      locks.retirementAge
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {(draft.retirementAge ?? draft.currentAge) > draft.currentAge
                      ? `${(draft.retirementAge ?? draft.currentAge) - draft.currentAge} years to retirement`
                      : 'Immediate retirement'}
                  </p>
                </div>
                <div>
                  <FieldLabel field="annualSavings">Annual Savings</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={draft.annualSavings ?? 0}
                    onChange={(e) => setDraft({ ...draft, annualSavings: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      locks.annualSavings
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Contributions during accumulation</p>
                </div>
                <div>
                  <FieldLabel field="partialEarningsAnnual">Partial Earnings (annual)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={draft.partialEarningsAnnual ?? 0}
                    onChange={(e) => setDraft({ ...draft, partialEarningsAnnual: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      locks.partialEarningsAnnual
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Post-retirement income (e.g. consulting)</p>
                </div>
                <div>
                  <FieldLabel field="partialEarningsYears">Partial Earnings Years</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={draft.partialEarningsYears ?? 0}
                    onChange={(e) => setDraft({ ...draft, partialEarningsYears: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      locks.partialEarningsYears
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Duration of partial earnings</p>
                </div>
              </div>
            </div>

            {/* Portfolio Wrapper Mix */}
            <div className="col-span-full">
              <div className="flex items-center justify-between mb-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Portfolio Wrapper Mix
                  </h4>
                  <LockButton locked={!!locks.wrapperBalances} onToggle={() => toggleLock('wrapperBalances')} />
                </div>
                {hasLiveWrappers && !locks.wrapperBalances && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useLiveWrappers}
                      onChange={(e) => setUseLiveWrappers(e.target.checked)}
                      className="rounded accent-emerald-500 h-3.5 w-3.5"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Use live balances</span>
                  </label>
                )}
              </div>
              {locks.wrapperBalances && (
                <p className="text-xs text-amber-500 mb-3">Locked across sessions. Unlock to use live balances.</p>
              )}
              {!locks.wrapperBalances && useLiveWrappers && hasLiveWrappers && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
                  Populated from your account balances. Uncheck to override manually.
                </p>
              )}
              {!locks.wrapperBalances && !hasLiveWrappers && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  How your portfolio is split across tax wrappers. This determines the tax-optimal drawdown order.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(['isa', 'sipp', 'gia', 'cash'] as const).map((wrapper) => {
                  const labels: Record<string, { name: string; hint: string }> = {
                    isa: { name: 'ISA', hint: 'Tax-free withdrawals' },
                    sipp: { name: 'SIPP / Pension', hint: '25% TFLS + taxed income' },
                    gia: { name: 'GIA', hint: 'CGT on gains only' },
                    cash: { name: 'Cash', hint: 'Liquidity buffer' },
                  };
                  const { name, hint } = labels[wrapper];
                  const isDisabled = locks.wrapperBalances
                    ? false  // locked values are editable (they'll be re-saved)
                    : useLiveWrappers && hasLiveWrappers;

                  return (
                    <div key={wrapper}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {name}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={draft.wrapperBalances?.[wrapper] ?? 0}
                        onChange={(e) => setDraft({
                          ...draft,
                          wrapperBalances: {
                            isa: draft.wrapperBalances?.isa ?? 0,
                            sipp: draft.wrapperBalances?.sipp ?? 0,
                            gia: draft.wrapperBalances?.gia ?? 0,
                            cash: draft.wrapperBalances?.cash ?? 0,
                            [wrapper]: Number(e.target.value),
                          },
                        })}
                        disabled={isDisabled}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          locks.wrapperBalances
                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                            : isDisabled
                            ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      />
                      <p className="text-xs text-gray-500 mt-1">{hint}</p>
                    </div>
                  );
                })}
              </div>
              {draft.wrapperBalances && (
                <div className="mt-2 text-xs text-gray-500">
                  Wrapper total: {formatCurrency(wrapperTotal)}
                  {Math.abs(wrapperTotal - draft.portfolio) > 100 && (
                    <span className="text-amber-500 ml-2">
                      (differs from portfolio by {formatCurrency(Math.abs(wrapperTotal - draft.portfolio))})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.glidepathEnabled}
                  onChange={(e) => setDraft({ ...draft, glidepathEnabled: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Glidepath (60%→100%)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.gogoEnabled}
                  onChange={(e) => setDraft({ ...draft, gogoEnabled: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Spending decline (75+)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.guardrailEnabled}
                  onChange={(e) => setDraft({ ...draft, guardrailEnabled: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Guardrail (15% cut)</span>
              </label>
            </div>
          </div>

          {/* Run button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4" />
              {isLoading ? 'Running...' : 'Run Analysis'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
