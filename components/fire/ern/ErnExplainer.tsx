'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">How This Works</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-6 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-6 text-sm text-gray-700 dark:text-gray-300">
          {/* 1. Historical Simulation */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Historical Simulation
            </h4>
            <p>
              Tests every possible retirement start date since 1871 using Shiller&apos;s monthly
              real return data (S&P 500 + 10-year Treasury). For each start date, computes the
              maximum sustainable withdrawal rate (SWR) over your {horizonYears}-year horizon
              using a closed-form formula from ERN&apos;s Safe Withdrawal Rate Series (Part 8).
            </p>
            <p className="mt-2">
              The <strong>fail-safe SWR</strong> is the worst case across all start dates &mdash;
              the withdrawal rate that would have survived every historical scenario. The
              CAPE-conditional view groups results by starting CAPE ratio to show how valuations
              at retirement affect outcomes.
            </p>
          </section>

          {/* 2. Monte Carlo */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Monte Carlo Simulation
            </h4>
            <p>
              Runs {mcPaths.toLocaleString()} simulated paths using block-bootstrap resampling
              (60-month blocks) from historical data. This preserves the autocorrelation and
              volatility clustering seen in real markets, rather than assuming returns are
              independent each month.
            </p>
            <p className="mt-2">
              <strong>Survival rate</strong> = percentage of paths where the portfolio stays
              above £1,000 at the end of the horizon. The fan chart shows the 5th, 25th, 50th,
              75th, and 95th percentile outcomes plus the single worst path.
            </p>
          </section>

          {/* 3. CAPE Dynamic WR */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              CAPE-Based Dynamic Withdrawal Rate
            </h4>
            <p>
              Uses ERN&apos;s regression from Parts 18 &amp; 54:
            </p>
            <p className="mt-1 font-mono bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded">
              WR = 1.75% + 0.50 &times; (100 / CAPE)
            </p>
            <p className="mt-2">
              With the current CAPE of <strong>{currentCape.toFixed(1)}</strong>, this gives a
              dynamic withdrawal rate of <strong>{ernDynamicWr.toFixed(2)}%</strong>. This rate
              adjusts to market conditions &mdash; lower when valuations are stretched, higher
              when they&apos;re compressed.
            </p>
          </section>

          {/* 4. Spending Rules */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Spending Rules
            </h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Go-go / slow-go / no-go:</strong> Optional age-based spending decline
                (90% at 75+, 80% at 80+) reflecting reduced activity in later retirement.
              </li>
              <li>
                <strong>Guardrail:</strong> Cuts withdrawal by 15% if the portfolio drops below
                80% of its peak, providing a safety valve during downturns.
              </li>
              <li>
                <strong>State pension offset:</strong> UK state pension reduces the required
                portfolio withdrawal after pension age, significantly improving survival rates.
              </li>
              <li>
                <strong>Partial earnings:</strong> Post-retirement income (consulting, part-time
                work) offsets withdrawals during the configured period.
              </li>
            </ul>
          </section>

          {/* 5. Key Assumptions */}
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Key Assumptions &amp; Limitations
            </h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                All returns are <strong>real</strong> (inflation-adjusted). Withdrawal amounts
                are in today&apos;s money.
              </li>
              <li>
                Annual fee drag of <strong>0.05%</strong> is applied monthly (approximating
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
                  <strong>Accumulation approximation:</strong> The historical simulation projects
                  the portfolio forward using the CAPE-implied real return (1/CAPE) and runs SWR
                  analysis on the projected retirement portfolio. The Monte Carlo engine handles
                  accumulation month-by-month with actual resampled returns, which is more accurate.
                </li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
