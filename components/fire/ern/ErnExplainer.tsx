'use client';

import { Disclosure } from '../Disclosure';

interface ErnExplainerProps {
  horizonYears: number;
  mcPaths: number;
  currentCape: number;
  ernDynamicWr: number;
  hasAccumulation: boolean;
}

export function ErnExplainer({
  horizonYears,
  mcPaths,
  currentCape,
  ernDynamicWr,
  hasAccumulation,
}: ErnExplainerProps) {
  return (
    <Disclosure title="How this works" summary="The data, the simulations, the spending rules and the assumptions behind them.">
      <div className="grid max-w-[80ch] gap-5 text-[13px] leading-relaxed text-ink-2">
      {/* 1. Historical Simulation */}
      <section>
        <h3 className="mb-1.5 text-[13px] font-semibold text-ink">
          Historical Simulation
        </h3>
        <p>
          Tests every possible retirement start date since 1871 using Shiller&apos;s monthly
          real return data (S&P 500 + 10-year Treasury). For each start date, computes the
          maximum sustainable withdrawal rate (SWR) over your {horizonYears}-year horizon
          using a closed-form formula from ERN&apos;s Safe Withdrawal Rate Series (Part 8).
        </p>
        <p className="mt-2">
          The <strong className="font-semibold text-ink">fail-safe SWR</strong> is the worst case across all start dates &mdash;
          the withdrawal rate that would have survived every historical scenario. The
          CAPE-conditional view groups results by starting CAPE ratio to show how valuations
          at retirement affect outcomes.
        </p>
      </section>

      {/* 2. Monte Carlo */}
      <section>
        <h3 className="mb-1.5 text-[13px] font-semibold text-ink">
          Monte Carlo Simulation
        </h3>
        <p>
          Runs {mcPaths.toLocaleString()} simulated paths using block-bootstrap resampling
          (60-month blocks) from historical data. This preserves the autocorrelation and
          volatility clustering seen in real markets, rather than assuming returns are
          independent each month.
        </p>
        <p className="mt-2">
          <strong className="font-semibold text-ink">Survival rate</strong> = percentage of paths where the portfolio stays
          above £1,000 at the end of the horizon. The fan chart shows the 5th, 25th, 50th,
          75th, and 95th percentile outcomes plus the single worst path.
        </p>
      </section>

      {/* 3. CAPE Dynamic WR */}
      <section>
        <h3 className="mb-1.5 text-[13px] font-semibold text-ink">
          CAPE-Based Dynamic Withdrawal Rate
        </h3>
        <p>
          Uses ERN&apos;s regression from Parts 18 &amp; 54:
        </p>
        <p className="fig mt-1 rounded-[3px] bg-sunk px-3 py-2 text-ink">
          WR = 1.75% + 0.50 &times; (100 / CAPE)
        </p>
        <p className="mt-2">
          With the current CAPE of <strong className="font-semibold text-ink">{currentCape.toFixed(1)}</strong>, this gives a
          dynamic withdrawal rate of <strong className="font-semibold text-ink">{ernDynamicWr.toFixed(2)}%</strong>. This rate
          adjusts to market conditions &mdash; lower when valuations are stretched, higher
          when they&apos;re compressed.
        </p>
      </section>

      {/* 4. Spending Rules */}
      <section>
        <h3 className="mb-1.5 text-[13px] font-semibold text-ink">
          Spending Rules
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="font-semibold text-ink">Go-go / slow-go / no-go:</strong> Optional age-based spending decline
            (90% at 75+, 80% at 80+) reflecting reduced activity in later retirement.
          </li>
          <li>
            <strong className="font-semibold text-ink">Guardrail:</strong> Cuts withdrawal by 15% if the portfolio drops below
            80% of its peak, providing a safety valve during downturns.
          </li>
          <li>
            <strong className="font-semibold text-ink">State pension offset:</strong> UK state pension reduces the required
            portfolio withdrawal after pension age, significantly improving survival rates.
          </li>
          <li>
            <strong className="font-semibold text-ink">Partial earnings:</strong> Post-retirement income (consulting, part-time
            work) offsets withdrawals during the configured period.
          </li>
        </ul>
      </section>

      {/* 5. Key Assumptions */}
      <section>
        <h3 className="mb-1.5 text-[13px] font-semibold text-ink">
          Key Assumptions &amp; Limitations
        </h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            All returns are <strong className="font-semibold text-ink">real</strong> (inflation-adjusted). Withdrawal amounts
            are in today&apos;s money.
          </li>
          <li>
            Annual fee drag of <strong className="font-semibold text-ink">0.05%</strong> is applied monthly (approximating
            low-cost index funds).
          </li>
          <li>
            UK state pension is assumed to grow with inflation (triple lock maintained in
            real terms).
          </li>
          <li>
            Historical data uses US market returns (Shiller). UK-specific return data is not
            available at monthly resolution since 1871, but long-run equity premia are similar.
          </li>
          {hasAccumulation && (
            <li>
              <strong className="font-semibold text-ink">Accumulation approximation:</strong> The historical simulation projects
              the portfolio forward using the CAPE-implied real return (1/CAPE) and runs SWR
              analysis on the projected retirement portfolio. The Monte Carlo engine handles
              accumulation month-by-month with actual resampled returns, which is more accurate.
            </li>
          )}
        </ul>
      </section>
      </div>
    </Disclosure>
  );
}
