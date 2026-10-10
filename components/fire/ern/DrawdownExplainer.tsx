'use client';

import { useMemo } from 'react';
import {
  projectDrawdown,
  type DrawdownProjectionConfig,
  type YearlyDrawdown,
} from '@/lib/fire/ern/uk-drawdown';
import type { WrapperBalances } from '@/lib/fire/ern/uk-drawdown';
import { formatGBP } from '@/lib/format';
import { Disclosure } from '../Disclosure';
import { readableGBP } from '../readable';

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

  const finalTotal = projection.finalBalances.isa + projection.finalBalances.sipp + projection.finalBalances.gia + projection.finalBalances.cash;

  const phaseBox = 'rounded-[3px] border border-line bg-surface p-3';
  const phaseList = 'mt-1.5 list-decimal space-y-0.5 pl-5 text-ink-2';
  const sub = 'mb-2 text-[13px] font-semibold text-ink';
  const dash = <span className="text-ink-3">–</span>;

  return (
    <Disclosure
      title="Drawdown order and tax"
      summary={
        <>
          About <span className="fig">{readableGBP(projection.totalTaxPaid)}</span> in tax over retirement ({pct(avgTaxRate)} of what you draw)
          {projection.depletionAge ? `; the money runs out at ${projection.depletionAge}` : '; the money lasts the whole horizon'}.
        </>
      }
    >
      <div className="grid gap-6 text-[13px] text-ink-2">
        <section>
          <h3 className={sub}>Which pot to draw from, and when</h3>
          <p className="mb-3 max-w-[80ch]">
            Withdrawals follow a tax-efficient order that changes when the state pension starts at {statePensionStartAge}. Growth is
            assumed at {pct(realReturn)} a year after inflation (from today&apos;s CAPE).
            {partialEarningsAnnual > 0 && partialEarningsYears > 0 && (
              <>
                {' '}
                Part-time earnings of {formatGBP(partialEarningsAnnual)} a year reduce withdrawals for the first {partialEarningsYears} years.
              </>
            )}
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {retirementAge < 57 && (
              <div className={phaseBox}>
                <h4 className="font-medium text-ink">
                  Before pension access (age {retirementAge}–57)
                </h4>
                <ol className={phaseList}>
                  <li>ISA first: tax-free</li>
                  <li>GIA if the ISA runs short: CGT on gains only</li>
                  <li>Cash last</li>
                </ol>
                <p className="mt-2 text-[12px] text-ink-3">The SIPP can&apos;t be touched until 57, so it keeps growing.</p>
              </div>
            )}

            {Math.max(retirementAge, 57) < statePensionStartAge && (
              <div className={phaseBox}>
                <h4 className="font-medium text-ink">
                  Pension access, before state pension (age {Math.max(retirementAge, 57)}–{statePensionStartAge})
                </h4>
                <ol className={phaseList}>
                  <li>SIPP up to the personal allowance ({formatGBP(12570)} a year): no tax</li>
                  <li>ISA for the rest: tax-free</li>
                  <li>GIA if those run short: CGT on gains only</li>
                  <li>Cash last</li>
                </ol>
                <p className="mt-2 text-[12px] text-ink-3">Uses an allowance that would otherwise go to waste.</p>
              </div>
            )}

            <div className={phaseBox}>
              <h4 className="font-medium text-ink">After state pension (age {Math.max(retirementAge, statePensionStartAge)}+)</h4>
              <ol className={phaseList}>
                <li>ISA first: tax-free</li>
                <li>SIPP when the ISA is used up: 25% tax-free, the rest taxed as income</li>
                <li>GIA when both are used up: CGT on gains only</li>
                <li>Cash last</li>
              </ol>
              <p className="mt-2 text-[12px] text-ink-3">
                The state pension ({formatGBP(statePensionAnnual)} a year) uses most of the allowance, so SIPP draws are taxed.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className={sub}>{projection.accumulationYears > 0 ? 'Your pots now and at retirement' : 'Your pots at the start'}</h3>
          {projection.accumulationYears > 0 && (
            <p className="mb-2 text-[12.5px] text-ink-3">
              After {projection.accumulationYears} more years
              {annualSavings > 0 && <> saving {formatGBP(annualSavings)} a year</>} at {pct(realReturn)} growth. Savings are split
              in proportion to today&apos;s mix.
            </p>
          )}
          <ul className="divide-y divide-line-2 rounded-[3px] border border-line bg-surface">
            {[
              { label: 'ISA', now: wrapperBalances.isa, ret: projection.retirementBalances.isa },
              { label: 'SIPP', now: wrapperBalances.sipp, ret: projection.retirementBalances.sipp },
              { label: 'GIA', now: wrapperBalances.gia, ret: projection.retirementBalances.gia },
              { label: 'Cash', now: wrapperBalances.cash, ret: projection.retirementBalances.cash },
            ].map(({ label, now, ret }) => (
              <li key={label} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="text-ink">{label}</span>
                <span className="flex items-baseline gap-3">
                  {projection.accumulationYears > 0 && (
                    <span className="fig text-[12px] text-ink-3" title={`Today: ${formatGBP(now)}`}>
                      {readableGBP(now)} now
                    </span>
                  )}
                  <span className="fig text-ink" title={formatGBP(ret)}>
                    {readableGBP(ret)}
                  </span>
                  <span className="fig w-10 text-right text-[12px] text-ink-3">{retirementTotal > 0 ? `${Math.round((ret / retirementTotal) * 100)}%` : '0%'}</span>
                </span>
              </li>
            ))}
          </ul>
          {projection.accumulationYears > 0 && (
            <p className="mt-2 text-[12.5px] text-ink-3">
              Pot at retirement: <span className="fig text-ink-2">{formatGBP(retirementTotal)}</span> (from{' '}
              <span className="fig">{formatGBP(totalPortfolio)}</span> today).
            </p>
          )}
        </section>

        <section>
          <h3 className={sub}>Year by year (every fifth year)</h3>
          <div className="overflow-x-auto rounded-[3px] border border-line bg-surface">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-sunk text-[11.5px] text-ink-3">
                  <th scope="col" className="px-2.5 py-2 text-left font-medium">Age</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">From ISA</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">From SIPP</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">From GIA</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">State pension</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">Tax</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">Tax rate</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">ISA left</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">SIPP left</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">GIA left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {sampleYears.map((y) => {
                  const isPartialEarnings = partialEarningsAnnual > 0 && y.year < partialEarningsYears;
                  return (
                    <tr key={y.year} className={y.age === statePensionStartAge ? 'bg-sel' : ''}>
                      <th scope="row" className="px-2.5 py-1.5 text-left font-medium text-ink">
                        {y.age}
                        {isPartialEarnings && (
                          <span className="ml-0.5 text-ink-3" title="Part-time earnings in this year">
                            *
                          </span>
                        )}
                      </th>
                      <td className="fig px-2.5 py-1.5 text-right">{y.fromIsa > 0 ? formatGBP(y.fromIsa) : dash}</td>
                      <td className="fig px-2.5 py-1.5 text-right">{y.fromSipp > 0 ? formatGBP(y.fromSipp) : dash}</td>
                      <td className="fig px-2.5 py-1.5 text-right">{y.fromGia > 0 ? formatGBP(y.fromGia) : dash}</td>
                      <td className="fig px-2.5 py-1.5 text-right">{y.statePensionIncome > 0 ? formatGBP(y.statePensionIncome) : dash}</td>
                      <td className="fig px-2.5 py-1.5 text-right text-ink">{y.totalTax > 0 ? formatGBP(y.totalTax) : dash}</td>
                      <td className="fig px-2.5 py-1.5 text-right">{y.effectiveTaxRate > 0 ? pct(y.effectiveTaxRate) : '0%'}</td>
                      <td className="fig px-2.5 py-1.5 text-right">{formatGBP(y.remainingBalances.isa)}</td>
                      <td className="fig px-2.5 py-1.5 text-right">{formatGBP(y.remainingBalances.sipp)}</td>
                      <td className="fig px-2.5 py-1.5 text-right">{formatGBP(y.remainingBalances.gia)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">
            The shaded row is the year the state pension starts.
            {partialEarningsAnnual > 0 && partialEarningsYears > 0 && <> * Part-time earnings ({formatGBP(partialEarningsAnnual)} a year) reduce withdrawals.</>}
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className={sub}>When each pot runs out</h3>
            <ul className="divide-y divide-line-2">
              {[
                { label: 'ISA', data: isaDepletionYear, balance: projection.retirementBalances.isa },
                { label: 'SIPP', data: sippDepletionYear, balance: projection.retirementBalances.sipp },
                { label: 'GIA', data: giaDepletionYear, balance: projection.retirementBalances.gia },
                { label: 'Cash', data: cashDepletionYear, balance: projection.retirementBalances.cash },
              ]
                .filter((w) => w.balance > 0)
                .map(({ label, data }) => (
                  <li key={label} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="text-ink">{label}</span>
                    {data ? (
                      <span>
                        used up at {data.age} <span className="text-ink-3">(year {data.year})</span>
                      </span>
                    ) : (
                      <span className="text-in">lasts the whole horizon</span>
                    )}
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h3 className={sub}>Over the whole retirement</h3>
            <dl className="divide-y divide-line-2">
              {[
                ['Total drawn', formatGBP(projection.totalDrawn)],
                ['Total tax', formatGBP(projection.totalTaxPaid)],
                ['Average tax rate', pct(avgTaxRate)],
                ['Left at the end', formatGBP(finalTotal)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
                  <dt>{k}</dt>
                  <dd className="fig text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section>
          <h3 className={sub}>Tax assumptions</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-ink-3">
            <li>
              2025-26 UK bands: personal allowance {formatGBP(12570)}, basic 20% to {formatGBP(50270)}, higher 40% to {formatGBP(125140)}, additional 45%
            </li>
            <li>CGT allowance {formatGBP(3000)} a year; 10% or 20% (basic or higher rate)</li>
            <li>SIPP tax-free lump sum: 25% of what&apos;s crystallised, up to {formatGBP(268275)} in a lifetime</li>
            <li>GIA gains start at half the value and grow by 1 percentage point a year</li>
            <li>Fiscal drag isn&apos;t modelled (thresholds held flat in real terms)</li>
            <li>Growth {pct(realReturn)} a year after inflation (from CAPE); cash earns nothing after inflation</li>
            {projection.accumulationYears > 0 && <li>Savings until retirement ({formatGBP(annualSavings)} a year) are split in proportion to today&apos;s mix</li>}
            {partialEarningsAnnual > 0 && (
              <li>
                Part-time earnings ({formatGBP(partialEarningsAnnual)} a year for {partialEarningsYears} years) reduce withdrawals and aren&apos;t taxed in the model
              </li>
            )}
          </ul>
        </section>
      </div>
    </Disclosure>
  );
}
