'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import {
  projectDrawdown,
  type DrawdownProjectionConfig,
  type YearlyDrawdown,
} from '@/lib/fire/ern/uk-drawdown';
import type { WrapperBalances } from '@/lib/fire/ern/uk-drawdown';

interface DrawdownExplainerProps {
  wrapperBalances: { isa: number; sipp: number; gia: number; cash: number };
  annualSpend: number;
  currentAge: number;
  retirementAge: number;
  statePensionAnnual: number;
  statePensionStartAge: number;
  horizonYears: number;
  /** CAPE-implied real return from the ERN analysis (e.g. 0.026 for 2.6%) */
  capeImpliedReturn: number;
  /** Annual savings during accumulation (default 0) */
  annualSavings?: number;
  /** Annual partial earnings post-retirement (default 0) */
  partialEarningsAnnual?: number;
  /** Years of partial earnings (default 0) */
  partialEarningsYears?: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Grow wrapper balances during accumulation, distributing savings
 * proportionally to the current wrapper mix.
 */
function accumulateWrappers(
  balances: WrapperBalances,
  annualSavings: number,
  years: number,
  realReturn: number,
): WrapperBalances {
  let b = { ...balances };
  for (let y = 0; y < years; y++) {
    const total = b.isa + b.sipp + b.gia + b.cash;
    const fractions = total > 0
      ? { isa: b.isa / total, sipp: b.sipp / total, gia: b.gia / total, cash: b.cash / total }
      : { isa: 0.25, sipp: 0.25, gia: 0.25, cash: 0.25 };

    b = {
      isa: (b.isa + annualSavings * fractions.isa) * (1 + realReturn),
      sipp: (b.sipp + annualSavings * fractions.sipp) * (1 + realReturn),
      gia: (b.gia + annualSavings * fractions.gia) * (1 + realReturn),
      cash: b.cash + annualSavings * fractions.cash, // Cash: no real return
    };
  }
  return b;
}

interface ProjectionResult {
  years: YearlyDrawdown[];
  totalTaxPaid: number;
  totalDrawn: number;
  finalBalances: WrapperBalances;
  depletionAge: number | null;
  retirementBalances: WrapperBalances;
  accumulationYears: number;
}

export function DrawdownExplainer({
  wrapperBalances,
  annualSpend,
  currentAge,
  retirementAge,
  statePensionAnnual,
  statePensionStartAge,
  horizonYears,
  capeImpliedReturn,
  annualSavings = 0,
  partialEarningsAnnual = 0,
  partialEarningsYears = 0,
}: DrawdownExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // capeImpliedReturn comes from the API as a percentage (e.g. 2.56 for CAPE 39)
  // Convert to decimal for projection (0.0256)
  const realReturn = capeImpliedReturn > 0
    ? (capeImpliedReturn > 1 ? capeImpliedReturn / 100 : capeImpliedReturn)
    : 0.04;

  const projection = useMemo((): ProjectionResult | null => {
    const accumulationYears = Math.max(0, retirementAge - currentAge);
    const drawdownYears = horizonYears - accumulationYears;
    if (drawdownYears <= 0) return null;

    // Phase 1: Grow wrappers during accumulation
    const retirementBalances = accumulationYears > 0 && annualSavings > 0
      ? accumulateWrappers(wrapperBalances, annualSavings, accumulationYears, realReturn)
      : (accumulationYears > 0
        ? accumulateWrappers(wrapperBalances, 0, accumulationYears, realReturn)
        : { ...wrapperBalances });

    // Phase 2: Drawdown with partial earnings offset
    // For years where partial earnings apply, reduce the spending need
    // We run the projection in two segments if partial earnings are present
    const effectiveSpend = annualSpend;

    const config: DrawdownProjectionConfig = {
      currentAge: retirementAge,
      statePensionAge: statePensionStartAge,
      statePensionAnnual,
      annualSpend: effectiveSpend,
      balances: retirementBalances,
      realReturn,
      horizonYears: drawdownYears,
    };

    const result = projectDrawdown(config);

    // Apply partial earnings offset to the early years
    if (partialEarningsAnnual > 0 && partialEarningsYears > 0) {
      // Re-run with reduced spend for the partial earnings period,
      // then continue with full spend from the resulting balances
      const peYears = Math.min(partialEarningsYears, drawdownYears);
      const reducedSpend = Math.max(0, annualSpend - partialEarningsAnnual);

      const phase1Config: DrawdownProjectionConfig = {
        currentAge: retirementAge,
        statePensionAge: statePensionStartAge,
        statePensionAnnual,
        annualSpend: reducedSpend,
        balances: retirementBalances,
        realReturn,
        horizonYears: peYears,
      };
      const phase1 = projectDrawdown(phase1Config);

      const remainingYears = drawdownYears - peYears;
      if (remainingYears > 0) {
        const phase2Config: DrawdownProjectionConfig = {
          currentAge: retirementAge + peYears,
          statePensionAge: statePensionStartAge,
          statePensionAnnual,
          annualSpend: effectiveSpend,
          balances: phase1.finalBalances,
          realReturn,
          horizonYears: remainingYears,
          lsaUsed: phase1.years.reduce((sum, y) => sum + y.fromSippTaxFree, 0),
        };
        const phase2 = projectDrawdown(phase2Config);

        // Merge the two phases
        const allYears = [
          ...phase1.years.map(y => ({ ...y, partialEarnings: partialEarningsAnnual })),
          ...phase2.years.map(y => ({
            ...y,
            year: y.year + peYears,
            age: y.age,
          })),
        ];

        return {
          years: allYears,
          totalTaxPaid: phase1.totalTaxPaid + phase2.totalTaxPaid,
          totalDrawn: phase1.totalDrawn + phase2.totalDrawn,
          finalBalances: phase2.finalBalances,
          depletionAge: phase2.depletionAge ?? phase1.depletionAge,
          retirementBalances,
          accumulationYears,
        };
      }

      return {
        ...phase1,
        retirementBalances,
        accumulationYears,
      };
    }

    return {
      ...result,
      retirementBalances,
      accumulationYears,
    };
  }, [wrapperBalances, annualSpend, retirementAge, statePensionAnnual, statePensionStartAge, horizonYears, currentAge, realReturn, annualSavings, partialEarningsAnnual, partialEarningsYears]);

  if (!projection) return null;

  const totalPortfolio = wrapperBalances.isa + wrapperBalances.sipp + wrapperBalances.gia + wrapperBalances.cash;
  if (totalPortfolio <= 0) return null;

  const retirementTotal = projection.retirementBalances.isa + projection.retirementBalances.sipp
    + projection.retirementBalances.gia + projection.retirementBalances.cash;

  // Determine draw order phases
  const prePensionYears = Math.max(0, statePensionStartAge - retirementAge);

  // Find wrapper depletion ages
  const isaDepletionYear = projection.years.find(y => y.remainingBalances.isa <= 0);
  const sippDepletionYear = projection.years.find(y => y.remainingBalances.sipp <= 0);
  const giaDepletionYear = projection.years.find(y => y.remainingBalances.gia <= 0);
  const cashDepletionYear = projection.years.find(y => y.remainingBalances.cash <= 0 && projection.retirementBalances.cash > 0);

  // Sample years for the table (every 5 years + first + last)
  const sampleYears = projection.years.filter(
    (y) => y.year === 0 || y.year === projection.years.length - 1 || y.year % 5 === 0
  );

  // Average effective tax rate
  const avgTaxRate = projection.totalDrawn > 0 ? projection.totalTaxPaid / projection.totalDrawn : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-gray-400" />
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Drawdown Strategy</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-3">
              {fmt(projection.totalTaxPaid)} lifetime tax ({pct(avgTaxRate)} effective)
              {projection.depletionAge && ` | depletes at age ${projection.depletionAge}`}
              {' | '}{pct(realReturn)} real return
            </span>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-6 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-6 text-sm text-gray-700 dark:text-gray-300">
          {/* Strategy Overview */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Optimal Draw Order
            </h4>
            <p className="mb-3">
              The model draws from your wrappers in a tax-efficient order that minimises lifetime
              tax. The strategy adapts when state pension starts at age {statePensionStartAge}.
              Returns are projected at {pct(realReturn)} real (CAPE-implied).
              {partialEarningsAnnual > 0 && partialEarningsYears > 0 && (
                <> Partial earnings of {fmt(partialEarningsAnnual)}/yr offset withdrawals for the first {partialEarningsYears} years of retirement.</>
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pre-SIPP access strategy (before age 57) */}
              {retirementAge < 57 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <h5 className="font-medium text-purple-800 dark:text-purple-300 mb-2">
                    Pre-SIPP Access (age {retirementAge}&ndash;57)
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 text-purple-700 dark:text-purple-400">
                    <li><strong>ISA</strong> first &mdash; entirely tax-free</li>
                    <li><strong>GIA</strong> if ISA insufficient &mdash; CGT on gains only</li>
                    <li><strong>Cash</strong> as last resort</li>
                  </ol>
                  <p className="mt-2 text-xs text-purple-600 dark:text-purple-500">
                    SIPP inaccessible until age 57 &mdash; pension stays invested and compounds
                  </p>
                </div>
              )}

              {/* Pre-pension, post-SIPP access strategy (age 57 to SPA) */}
              {Math.max(retirementAge, 57) < statePensionStartAge && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                    SIPP Access, Pre-Pension (age {Math.max(retirementAge, 57)}&ndash;{statePensionStartAge})
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
                    <li><strong>SIPP</strong> up to Personal Allowance ({fmt(12570)}/yr) &mdash; taxed at 0% via PA</li>
                    <li><strong>ISA</strong> for the remainder &mdash; entirely tax-free</li>
                    <li><strong>GIA</strong> if ISA + SIPP insufficient &mdash; CGT on gains only</li>
                    <li><strong>Cash</strong> as last resort</li>
                  </ol>
                  <p className="mt-2 text-xs text-blue-600 dark:text-blue-500">
                    Uses PA that would otherwise be wasted while no state pension income
                  </p>
                </div>
              )}

              {/* Post-pension strategy */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                <h5 className="font-medium text-emerald-800 dark:text-emerald-300 mb-2">
                  Post-Pension (age {Math.max(retirementAge, statePensionStartAge)}+)
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-emerald-700 dark:text-emerald-400">
                  <li><strong>ISA</strong> first &mdash; entirely tax-free</li>
                  <li><strong>SIPP</strong> if ISA depleted &mdash; 25% TFLS tax-free, rest taxed as income</li>
                  <li><strong>GIA</strong> if both depleted &mdash; CGT on gains only</li>
                  <li><strong>Cash</strong> as last resort</li>
                </ol>
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-500">
                  State pension ({fmt(statePensionAnnual)}/yr) fills most of PA, so SIPP draws are taxed
                </p>
              </div>
            </div>
          </section>

          {/* Wrapper Balances: Now vs Retirement */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              {projection.accumulationYears > 0 ? 'Wrapper Balances (Now → Retirement)' : 'Starting Wrapper Balances'}
            </h4>
            {projection.accumulationYears > 0 && (
              <p className="text-xs text-gray-500 mb-2">
                After {projection.accumulationYears} years of accumulation
                {annualSavings > 0 && <> saving {fmt(annualSavings)}/yr</>}
                {' '}at {pct(realReturn)} real return. Savings distributed proportionally to current wrapper mix.
              </p>
            )}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'ISA', now: wrapperBalances.isa, ret: projection.retirementBalances.isa, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' },
                { label: 'SIPP', now: wrapperBalances.sipp, ret: projection.retirementBalances.sipp, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
                { label: 'GIA', now: wrapperBalances.gia, ret: projection.retirementBalances.gia, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' },
                { label: 'Cash', now: wrapperBalances.cash, ret: projection.retirementBalances.cash, color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300' },
              ].map(({ label, now, ret, color }) => (
                <div key={label} className={`rounded-lg p-3 ${color}`}>
                  <div className="text-xs font-medium">{label}</div>
                  {projection.accumulationYears > 0 ? (
                    <>
                      <div className="text-xs line-through opacity-60">{fmt(now)}</div>
                      <div className="text-lg font-bold">{fmt(ret)}</div>
                    </>
                  ) : (
                    <div className="text-lg font-bold">{fmt(ret)}</div>
                  )}
                  <div className="text-xs">{retirementTotal > 0 ? pct(ret / retirementTotal) : '0%'}</div>
                </div>
              ))}
            </div>
            {projection.accumulationYears > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Portfolio at retirement: {fmt(retirementTotal)} (from {fmt(totalPortfolio)} today)
              </p>
            )}
          </section>

          {/* Year-by-Year Table */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Projected Drawdown Timeline
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 px-2 text-left font-medium">Age</th>
                    <th className="py-2 px-2 text-right font-medium">From ISA</th>
                    <th className="py-2 px-2 text-right font-medium">From SIPP</th>
                    <th className="py-2 px-2 text-right font-medium">From GIA</th>
                    <th className="py-2 px-2 text-right font-medium">Pension</th>
                    <th className="py-2 px-2 text-right font-medium">Tax</th>
                    <th className="py-2 px-2 text-right font-medium">Tax Rate</th>
                    <th className="py-2 px-2 text-right font-medium">ISA Bal</th>
                    <th className="py-2 px-2 text-right font-medium">SIPP Bal</th>
                    <th className="py-2 px-2 text-right font-medium">GIA Bal</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleYears.map((y) => {
                    const isPartialEarnings = partialEarningsAnnual > 0 && y.year < partialEarningsYears;
                    return (
                      <tr
                        key={y.year}
                        className={`border-b border-gray-100 dark:border-gray-800 ${
                          y.age === statePensionStartAge ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''
                        }`}
                      >
                        <td className="py-1.5 px-2 font-medium">
                          {y.age}
                          {isPartialEarnings && <span className="text-purple-500 ml-1" title="Partial earnings active">*</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">{y.fromIsa > 0 ? fmt(y.fromIsa) : '—'}</td>
                        <td className="py-1.5 px-2 text-right">{y.fromSipp > 0 ? fmt(y.fromSipp) : '—'}</td>
                        <td className="py-1.5 px-2 text-right">{y.fromGia > 0 ? fmt(y.fromGia) : '—'}</td>
                        <td className="py-1.5 px-2 text-right">{y.statePensionIncome > 0 ? fmt(y.statePensionIncome) : '—'}</td>
                        <td className="py-1.5 px-2 text-right text-red-600 dark:text-red-400">
                          {y.totalTax > 0 ? fmt(y.totalTax) : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {y.effectiveTaxRate > 0 ? pct(y.effectiveTaxRate) : '0%'}
                        </td>
                        <td className="py-1.5 px-2 text-right text-emerald-600 dark:text-emerald-400">
                          {fmt(y.remainingBalances.isa)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-blue-600 dark:text-blue-400">
                          {fmt(y.remainingBalances.sipp)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-amber-600 dark:text-amber-400">
                          {fmt(y.remainingBalances.gia)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {partialEarningsAnnual > 0 && partialEarningsYears > 0 && (
                <p className="text-xs text-purple-500 mt-1">* Partial earnings ({fmt(partialEarningsAnnual)}/yr) reducing withdrawal need</p>
              )}
            </div>
          </section>

          {/* Wrapper Depletion Timeline */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Wrapper Depletion
            </h4>
            <div className="space-y-2">
              {[
                { label: 'ISA', data: isaDepletionYear, balance: projection.retirementBalances.isa },
                { label: 'SIPP', data: sippDepletionYear, balance: projection.retirementBalances.sipp },
                { label: 'GIA', data: giaDepletionYear, balance: projection.retirementBalances.gia },
                { label: 'Cash', data: cashDepletionYear, balance: projection.retirementBalances.cash },
              ].filter(w => w.balance > 0).map(({ label, data }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-12 font-medium">{label}</span>
                  {data ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      Depleted at age {data.age} (year {data.year})
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Survives full horizon
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Summary Stats */}
          <section className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Lifetime Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500">Total Drawn</div>
                <div className="text-lg font-bold">{fmt(projection.totalDrawn)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Tax Paid</div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">{fmt(projection.totalTaxPaid)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Avg Effective Tax Rate</div>
                <div className="text-lg font-bold">{pct(avgTaxRate)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Final Portfolio</div>
                <div className="text-lg font-bold">
                  {fmt(projection.finalBalances.isa + projection.finalBalances.sipp + projection.finalBalances.gia + projection.finalBalances.cash)}
                </div>
              </div>
            </div>
          </section>

          {/* Tax Assumptions */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Tax Assumptions
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-gray-500">
              <li>2025-26 UK tax bands: PA {fmt(12570)}, basic 20% to {fmt(50270)}, higher 40% to {fmt(125140)}, additional 45%</li>
              <li>CGT allowance {fmt(3000)}/yr; rates 10%/20% (basic/higher rate taxpayers)</li>
              <li>SIPP Tax-Free Lump Sum: 25% of crystallised amount, up to {fmt(268275)} lifetime</li>
              <li>GIA gain fraction starts at 50% and increases 1pp/yr (reflecting compounding gains)</li>
              <li>Fiscal drag not modelled (thresholds assumed frozen in real terms)</li>
              <li>Real return: {pct(realReturn)} (CAPE-implied). Cash earns 0% real.</li>
              {projection.accumulationYears > 0 && (
                <li>Savings during accumulation ({fmt(annualSavings)}/yr) distributed proportionally to current wrapper mix</li>
              )}
              {partialEarningsAnnual > 0 && (
                <li>Partial earnings ({fmt(partialEarningsAnnual)}/yr for {partialEarningsYears} years) reduce withdrawal need, not modelled as taxable income</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
