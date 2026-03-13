'use client';

import { useState, useEffect, useCallback } from 'react';
import { ErnSummaryCards } from './ErnSummaryCards';
import { ErnConfigPanel, type ErnConfig } from './ErnConfigPanel';
import { CapeScatterChart } from './CapeScatterChart';
import { MonteCarloFanChart } from './MonteCarloFanChart';
import { CapeWithdrawalChart } from './CapeWithdrawalChart';
import { ConditionalFailureTable } from './ConditionalFailureTable';
import { DrawdownExplainer } from './DrawdownExplainer';
import { ErnTakeaways } from './ErnTakeaways';
import { ErnExplainer } from './ErnExplainer';
import type { FireTakeaway } from '@/lib/fire/ern/types';
import type { FireInputs } from '@/lib/types/fire';

// Types matching the API response
interface ErnApiResponse {
  historical: {
    failSafeSwr: number;
    medianSwr: number;
    totalCohorts: number;
    capeBuckets: Array<{
      label: string;
      range: [number, number];
      count: number;
      failSafeSwr: number;
      medianSwr: number;
    }>;
    cohorts?: Array<{
      startIndex: number;
      cape: number;
      swr: number;
    }>;
  };
  ernDynamicWr: number;
  capeImpliedReturn: number;
  personalWr: number;
  currentCape: number;
  capeWithdrawalCurve: Array<{ cape: number; withdrawalRate: number }>;
  conditionalFailureTable: {
    wrRates: number[];
    rows: Array<{
      label: string;
      count: number;
      failureRates: Record<string, number>;
    }>;
  };
  config: ErnConfig;
  accumulation?: {
    projectedPortfolio: number;
    yearsToRetirement: number;
    drawdownYears: number;
    growthRateUsed: number;
  };
}

interface McApiResponse {
  survivalRate: number;
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  worstPath: number[];
  retirementYear?: number;
}

const DEFAULT_CONFIG: ErnConfig = {
  portfolio: 1_538_050,
  annualSpend: 50_000,
  equityAllocation: 0.8,
  horizonYears: 48,
  preserveFraction: 0.5,
  glidepathEnabled: false,
  statePensionAnnual: 23_000,
  statePensionStartAge: 67,
  currentAge: 42,
  gogoEnabled: true,
  guardrailEnabled: false,
  mcPaths: 500,
  retirementAge: 42,
  annualSavings: 0,
  partialEarningsAnnual: 0,
  partialEarningsYears: 0,
};

/** Map net worth byType entries to wrapper balances */
function mapNetWorthToWrappers(byType: Array<{ type: string; total: number }>): { isa: number; sipp: number; gia: number; cash: number } {
  let isa = 0, sipp = 0, gia = 0, cash = 0;
  for (const entry of byType) {
    switch (entry.type) {
      case 'isa': isa += entry.total; break;
      case 'pension': sipp += entry.total; break;
      case 'investment': gia += entry.total; break;
      case 'savings':
      case 'current': cash += entry.total; break;
      // 'property' excluded from liquid portfolio
    }
  }
  return { isa, sipp, gia, cash };
}

function mergeFireInputsIntoConfig(inputs: FireInputs, base: ErnConfig): ErnConfig {
  return {
    ...base,
    currentAge: inputs.currentAge,
    annualSpend: inputs.annualSpend,
    ...(inputs.currentPortfolioValue != null && { portfolio: inputs.currentPortfolioValue }),
    ...(inputs.targetRetirementAge != null && { retirementAge: inputs.targetRetirementAge }),
    ...(inputs.annualSavings != null && { annualSavings: inputs.annualSavings }),
    // Recalculate horizon: years from current age to 90
    horizonYears: 90 - inputs.currentAge,
  };
}

interface ErnDashboardProps {
  fireInputs?: FireInputs | null;
}

export function ErnDashboard({ fireInputs }: ErnDashboardProps) {
  const initialConfig = fireInputs
    ? mergeFireInputsIntoConfig(fireInputs, DEFAULT_CONFIG)
    : DEFAULT_CONFIG;
  const [config, setConfig] = useState<ErnConfig>(initialConfig);
  const [ernData, setErnData] = useState<ErnApiResponse | null>(null);
  const [mcData, setMcData] = useState<McApiResponse | null>(null);
  const [takeaways, setTakeaways] = useState<FireTakeaway[] | null>(null);
  const [takeawaysLoading, setTakeawaysLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastInputsId, setLastInputsId] = useState<string | undefined>(fireInputs?.id);

  // Live data from net worth API (separate from config so panel can toggle)
  const [livePortfolio, setLivePortfolio] = useState<number | null>(null);
  const [liveWrappers, setLiveWrappers] = useState<ErnConfig['wrapperBalances'] | null>(null);

  const runAnalysis = useCallback(async (cfg: ErnConfig) => {
    setIsLoading(true);
    setError(null);

    try {
      // Run historical + CAPE analysis
      const ernResponse = await fetch('/api/fire/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: cfg,
          includeCohorts: true,
        }),
      });

      if (!ernResponse.ok) {
        const errData = await ernResponse.json();
        throw new Error(errData.error || 'Failed to run ERN analysis');
      }

      const ernResult: ErnApiResponse = await ernResponse.json();
      setErnData(ernResult);

      // Run Monte Carlo (separate call to allow independent loading)
      let mcResult: McApiResponse | undefined;
      try {
        const mcResponse = await fetch('/api/fire/monte-carlo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: cfg }),
        });

        if (mcResponse.ok) {
          mcResult = await mcResponse.json();
          setMcData(mcResult!);
        }
      } catch {
        // MC is optional — don't block the dashboard
        console.warn('Monte Carlo endpoint not available');
      }

      setConfig(cfg);

      // Fetch AI takeaways asynchronously after simulations complete
      fetchTakeaways(ernResult, mcResult, cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTakeaways = async (
    ern: ErnApiResponse,
    mc: McApiResponse | undefined,
    cfg: ErnConfig,
  ) => {
    setTakeawaysLoading(true);
    setTakeaways(null);
    try {
      const response = await fetch('/api/fire/takeaways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          failSafeSwr: ern.historical.failSafeSwr,
          medianSwr: ern.historical.medianSwr,
          ernDynamicWr: ern.ernDynamicWr,
          personalWr: ern.personalWr,
          currentCape: ern.currentCape,
          mcSurvivalRate: mc?.survivalRate ?? null,
          config: cfg,
          accumulation: ern.accumulation ?? null,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTakeaways(data.takeaways);
      }
    } catch {
      // Takeaways are optional — fail silently
    } finally {
      setTakeawaysLoading(false);
    }
  };

  // Fetch net worth on mount, then run initial analysis with live data
  useEffect(() => {
    async function init() {
      let cfgToRun = config;

      try {
        const res = await fetch('/api/wealth/net-worth');
        if (res.ok) {
          const data = await res.json();
          if (data.byType?.length > 0) {
            const wrappers = mapNetWorthToWrappers(data.byType);
            // Liquid portfolio = sum of wrappers (excludes property)
            const liquidTotal = wrappers.isa + wrappers.sipp + wrappers.gia + wrappers.cash;
            setLivePortfolio(liquidTotal);
            setLiveWrappers(wrappers);

            // Apply live data to initial config
            cfgToRun = { ...cfgToRun, portfolio: liquidTotal, wrapperBalances: wrappers };
            setConfig(cfgToRun);
          }
        }
      } catch {
        // Non-critical — use defaults
      }

      runAnalysis(cfgToRun);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run when fireInputs change (e.g. after saving settings)
  useEffect(() => {
    if (fireInputs && fireInputs.id !== lastInputsId) {
      const updated = mergeFireInputsIntoConfig(fireInputs, config);
      setLastInputsId(fireInputs.id);
      runAnalysis(updated);
    } else if (fireInputs && fireInputs.updatedAt) {
      // Same ID but inputs may have been updated
      const updated = mergeFireInputsIntoConfig(fireInputs, config);
      // Only re-run if values actually changed
      if (
        updated.currentAge !== config.currentAge ||
        updated.annualSpend !== config.annualSpend ||
        updated.portfolio !== config.portfolio ||
        updated.retirementAge !== config.retirementAge ||
        updated.annualSavings !== config.annualSavings
      ) {
        runAnalysis(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireInputs]);

  const handleConfigChange = (newConfig: ErnConfig) => {
    runAnalysis(newConfig);
  };

  return (
    <div>
      {/* Config Panel */}
      <ErnConfigPanel
        config={config}
        onConfigChange={handleConfigChange}
        isLoading={isLoading}
        livePortfolio={livePortfolio}
        liveWrapperBalances={liveWrappers}
      />

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <ErnSummaryCards
        failSafeSwr={ernData?.historical.failSafeSwr ?? 0}
        medianSwr={ernData?.historical.medianSwr ?? 0}
        ernDynamicWr={ernData?.ernDynamicWr ?? 0}
        personalWr={ernData?.personalWr ?? 0}
        currentCape={ernData?.currentCape ?? 39}
        mcSurvivalRate={mcData?.survivalRate ?? null}
        totalCohorts={ernData?.historical.totalCohorts ?? 0}
        isLoading={isLoading}
      />

      {/* AI Takeaways */}
      <ErnTakeaways
        takeaways={takeaways}
        isLoading={takeawaysLoading}
      />

      {ernData && (
        <>
          {/* CAPE Scatter Chart */}
          {ernData.historical.cohorts && (
            <CapeScatterChart
              cohorts={ernData.historical.cohorts.map((c) => ({
                cape: c.cape,
                swr: c.swr,
                startIndex: c.startIndex,
              }))}
              personalWr={ernData.personalWr}
              ernDynamicWr={ernData.ernDynamicWr}
            />
          )}

          {/* Monte Carlo Fan Chart */}
          {mcData && (
            <MonteCarloFanChart
              percentiles={mcData.percentiles}
              worstPath={mcData.worstPath}
              survivalRate={mcData.survivalRate}
              initialPortfolio={config.portfolio}
              retirementYear={mcData.retirementYear}
            />
          )}

          {/* CAPE Withdrawal Curve */}
          <CapeWithdrawalChart
            curve={ernData.capeWithdrawalCurve}
            currentCape={ernData.currentCape}
            currentWr={ernData.ernDynamicWr}
          />

          {/* Conditional Failure Table */}
          <ConditionalFailureTable
            table={ernData.conditionalFailureTable}
          />

          {/* Drawdown Strategy Explainer */}
          {config.wrapperBalances && (
            <DrawdownExplainer
              wrapperBalances={config.wrapperBalances}
              annualSpend={config.annualSpend}
              currentAge={config.currentAge}
              retirementAge={config.retirementAge ?? config.currentAge}
              statePensionAnnual={config.statePensionAnnual}
              statePensionStartAge={config.statePensionStartAge}
              horizonYears={config.horizonYears}
              capeImpliedReturn={ernData.capeImpliedReturn}
              annualSavings={config.annualSavings ?? 0}
              partialEarningsAnnual={config.partialEarningsAnnual ?? 0}
              partialEarningsYears={config.partialEarningsYears ?? 0}
            />
          )}

          {/* Model Explainer */}
          <ErnExplainer
            horizonYears={config.horizonYears}
            mcPaths={config.mcPaths}
            currentCape={ernData.currentCape}
            ernDynamicWr={ernData.ernDynamicWr}
            hasAccumulation={(config.retirementAge ?? config.currentAge) > config.currentAge}
          />
        </>
      )}

      {/* Empty state */}
      {!ernData && !isLoading && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 shadow-sm text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Click &quot;Run Analysis&quot; to compute ERN SWR metrics.
          </p>
        </div>
      )}
    </div>
  );
}
