'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ErnSummaryCards } from './ErnSummaryCards';
import { ErnConfigPanel, loadLockedOverrides, type ErnConfig } from './ErnConfigPanel';
import { CapeScatterChart } from './CapeScatterChart';
import { MonteCarloFanChart } from './MonteCarloFanChart';
import { CapeWithdrawalChart } from './CapeWithdrawalChart';
import { ConditionalFailureTable } from './ConditionalFailureTable';
import { DrawdownExplainer } from './DrawdownExplainer';
import { ErnTakeaways, type TakeawaysState } from './ErnTakeaways';
import { ErnExplainer } from './ErnExplainer';
import { loadSimPrefs, saveSimPrefs } from './sim-prefs';
import { Button } from '@/components/ui/Button';
import { EmptyState, Notice } from '@/components/ui/Notice';
import { PageIntro } from '@/components/ui/PageIntro';
import { ernLedeParts, historicalSurvival } from '../readable';
import type { FireTakeaway } from '@/lib/fire/ern/types';
import type { FireInputs, NetWorthSummary } from '@/lib/types/fire';

// Types matching the API response
export interface ErnApiResponse {
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

export interface McApiResponse {
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

export const DEFAULT_CONFIG: ErnConfig = {
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
export function mapNetWorthToWrappers(byType: Array<{ type: string; total: number }>): { isa: number; sipp: number; gia: number; cash: number } {
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

export function mergeFireInputsIntoConfig(inputs: FireInputs, base: ErnConfig): ErnConfig {
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

/** The FIRE inputs that change the simulation; a change in any of them reruns it. */
function inputsKey(i: FireInputs | null | undefined): string {
  if (!i) return '';
  return [i.currentAge, i.annualSpend, i.currentPortfolioValue, i.targetRetirementAge, i.annualSavings].join('|');
}

interface ErnDashboardProps {
  fireInputs?: FireInputs | null;
  /** Net worth summary, for the live portfolio and wrapper mix. */
  netWorth?: NetWorthSummary | null;
  /** True once the page has loaded inputs and net worth (or given up), so the first run uses them. */
  ready?: boolean;
}

export function ErnDashboard({ fireInputs, netWorth, ready = true }: ErnDashboardProps) {
  const [config, setConfig] = useState<ErnConfig>(DEFAULT_CONFIG);
  const [ernData, setErnData] = useState<ErnApiResponse | null>(null);
  const [mcData, setMcData] = useState<McApiResponse | null>(null);
  const [takeaways, setTakeaways] = useState<TakeawaysState>({ status: 'idle' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const lastInputsKey = useRef('');
  const lastRun = useRef<{ ern: ErnApiResponse; mc?: McApiResponse; cfg: ErnConfig } | null>(null);

  // Live data from net worth (separate from config so the panel can toggle it)
  const [livePortfolio, setLivePortfolio] = useState<number | null>(null);
  const [liveWrappers, setLiveWrappers] = useState<ErnConfig['wrapperBalances'] | null>(null);

  const fetchTakeaways = useCallback(async (ern: ErnApiResponse, mc: McApiResponse | undefined, cfg: ErnConfig) => {
    setTakeaways({ status: 'loading' });
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
      const data = (await response.json().catch(() => ({}))) as { takeaways?: FireTakeaway[]; error?: string };
      if (response.status === 503) {
        setTakeaways({ status: 'unavailable', message: data.error || 'AI takeaways are not available right now.' });
      } else if (!response.ok || !Array.isArray(data.takeaways)) {
        setTakeaways({ status: 'error', message: data.error || 'The takeaways couldn’t be generated.' });
      } else {
        setTakeaways({ status: 'ready', items: data.takeaways });
      }
    } catch {
      setTakeaways({ status: 'error', message: 'Couldn’t reach the server for takeaways.' });
    }
  }, []);

  const runAnalysis = useCallback(
    async (cfg: ErnConfig) => {
      setIsLoading(true);
      setError(null);

      try {
        const ernResponse = await fetch('/api/fire/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: cfg, includeCohorts: true }),
        });

        if (!ernResponse.ok) {
          const errData = await ernResponse.json().catch(() => ({}));
          throw new Error(errData.error || 'The simulation failed to run.');
        }

        const ernResult: ErnApiResponse = await ernResponse.json();
        setErnData(ernResult);

        // Monte Carlo is a separate call so it can fail without blocking the rest.
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
          } else {
            setMcData(null);
          }
        } catch {
          setMcData(null);
        }

        setConfig(cfg);
        lastRun.current = { ern: ernResult, mc: mcResult, cfg };
        fetchTakeaways(ernResult, mcResult, cfg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTakeaways]
  );

  // First run: once the page has the FIRE inputs and net worth.
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    let cfg: ErnConfig = { ...DEFAULT_CONFIG };
    if (fireInputs) cfg = mergeFireInputsIntoConfig(fireInputs, cfg);
    cfg = { ...cfg, ...loadSimPrefs() };
    if (netWorth?.byType?.length) {
      const wrappers = mapNetWorthToWrappers(netWorth.byType);
      const liquidTotal = wrappers.isa + wrappers.sipp + wrappers.gia + wrappers.cash;
      setLivePortfolio(liquidTotal);
      setLiveWrappers(wrappers);
      cfg = { ...cfg, portfolio: liquidTotal, wrapperBalances: wrappers };
    }
    // Values the user locked in the what-if settings win over everything else.
    cfg = { ...cfg, ...loadLockedOverrides() };
    lastInputsKey.current = inputsKey(fireInputs);
    setConfig(cfg);
    runAnalysis(cfg);
  }, [ready, fireInputs, netWorth, runAnalysis]);

  // Rerun when the FIRE settings change (saved on the Settings tab).
  useEffect(() => {
    if (!started.current || !fireInputs) return;
    const key = inputsKey(fireInputs);
    if (key === lastInputsKey.current) return;
    lastInputsKey.current = key;
    runAnalysis(mergeFireInputsIntoConfig(fireInputs, config));
  }, [fireInputs]);

  const handleConfigChange = (newConfig: ErnConfig) => {
    saveSimPrefs(newConfig);
    runAnalysis(newConfig);
  };

  const retryTakeaways = () => {
    const r = lastRun.current;
    if (r) fetchTakeaways(r.ern, r.mc, r.cfg);
  };

  const lede = ernData
    ? ernLedeParts({
        annualSpend: config.annualSpend,
        portfolio: config.portfolio,
        personalWr: ernData.personalWr,
        ernDynamicWr: ernData.ernDynamicWr,
        horizonYears: ernData.accumulation?.drawdownYears ?? config.horizonYears,
        historicalSurvivalPct: historicalSurvival(ernData.historical.cohorts, ernData.personalWr),
        mcSurvivalRate: mcData?.survivalRate ?? null,
        mcPaths: config.mcPaths,
        retirementAge: config.retirementAge,
        currentAge: config.currentAge,
        projectedPortfolio: ernData.accumulation?.projectedPortfolio,
      })
    : null;

  return (
    <div className="grid gap-8">
      <PageIntro>
        {lede ? (
          <p aria-live="polite">
            {lede.retiresLater ? (
              <>
                Retiring at <strong>{config.retirementAge}</strong> with a projected <strong className="fig">{lede.pot}</strong>, spending{' '}
                <strong className="fig">{lede.spend}</strong> a year is a <strong className="fig">{lede.wr}</strong> withdrawal rate
              </>
            ) : (
              <>
                At <strong className="fig">{lede.spend}</strong> a year from <strong className="fig">{lede.pot}</strong> you&apos;re at a{' '}
                <strong className="fig">{lede.wr}</strong> withdrawal rate
              </>
            )}
            {lede.historical !== null ? (
              <>
                ; historically that survived <strong className="fig">{lede.historical}</strong> of {lede.years}-year retirements
              </>
            ) : null}
            {lede.mc !== null ? (
              <>
                {' '}and <strong className="fig">{lede.mc}</strong> of {config.mcPaths.toLocaleString('en-GB')} simulated futures
              </>
            ) : null}
            . That&apos;s {lede.verdict} today&apos;s market-adjusted rate of <span className="fig">{lede.ernWr}</span>.
          </p>
        ) : isLoading ? (
          <p>Running the historical and Monte Carlo simulations…</p>
        ) : (
          <p>Run the analysis to see how your plan would have fared in every retirement since 1871.</p>
        )}
      </PageIntro>

      <ErnConfigPanel
        config={config}
        onConfigChange={handleConfigChange}
        isLoading={isLoading}
        livePortfolio={livePortfolio}
        liveWrapperBalances={liveWrappers}
      />

      {error && (
        <Notice tone="error" action={<Button size="sm" onClick={() => runAnalysis(config)}>Try again</Button>}>
          The analysis didn&apos;t run. {error}
        </Notice>
      )}

      {(ernData || isLoading) && (
        <ErnSummaryCards
          failSafeSwr={ernData?.historical.failSafeSwr ?? 0}
          medianSwr={ernData?.historical.medianSwr ?? 0}
          ernDynamicWr={ernData?.ernDynamicWr ?? 0}
          personalWr={ernData?.personalWr ?? 0}
          currentCape={ernData?.currentCape ?? 39}
          mcSurvivalRate={mcData?.survivalRate ?? null}
          totalCohorts={ernData?.historical.totalCohorts ?? 0}
          mcPaths={config.mcPaths}
          isLoading={isLoading && !ernData}
        />
      )}

      <ErnTakeaways state={takeaways} onRetry={retryTakeaways} />

      {ernData && (
        <>
          {ernData.historical.cohorts && (
            <CapeScatterChart
              cohorts={ernData.historical.cohorts.map((c) => ({ cape: c.cape, swr: c.swr, startIndex: c.startIndex }))}
              personalWr={ernData.personalWr}
              ernDynamicWr={ernData.ernDynamicWr}
            />
          )}

          {mcData && (
            <MonteCarloFanChart
              percentiles={mcData.percentiles}
              worstPath={mcData.worstPath}
              survivalRate={mcData.survivalRate}
              initialPortfolio={config.portfolio}
              retirementYear={mcData.retirementYear}
              paths={config.mcPaths}
            />
          )}

          <CapeWithdrawalChart curve={ernData.capeWithdrawalCurve} currentCape={ernData.currentCape} currentWr={ernData.ernDynamicWr} />

          <ConditionalFailureTable table={ernData.conditionalFailureTable} personalWr={ernData.personalWr} />

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

          <ErnExplainer
            horizonYears={config.horizonYears}
            mcPaths={config.mcPaths}
            currentCape={ernData.currentCape}
            ernDynamicWr={ernData.ernDynamicWr}
            hasAccumulation={(config.retirementAge ?? config.currentAge) > config.currentAge}
          />
        </>
      )}

      {!ernData && !isLoading && !error && (
        <EmptyState title="No analysis yet" action={<Button variant="primary" onClick={() => runAnalysis(config)}>Run analysis</Button>}>
          The analysis tests your spending against every historical retirement since 1871.
        </EmptyState>
      )}
    </div>
  );
}
