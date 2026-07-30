'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  LabelList,
} from 'recharts';
import { drawdownSim, sustainableSpend, potsAtExit, DEFAULT_OUTLOOK } from '@/lib/plan/outlook';
import { PALETTE } from '@/lib/plan/constants';
import { gbp, gbpK } from './format';

export function OutlookSection() {
  const [retireYear, setRetireYear] = useState<number>(2035);
  const [realReturn, setRealReturn] = useState<number>(0.02);
  const [spend, setSpend] = useState<number>(60_000);
  const [hb, setHb] = useState<number>(13_000);

  const opts = useMemo(
    () => ({ ...DEFAULT_OUTLOOK, retireYear, realReturn, retirementSpend: spend, hbPostRetirement: hb }),
    [retireYear, realReturn, spend, hb]
  );
  const pots = useMemo(() => potsAtExit(opts), [opts]);
  const sim = useMemo(() => drawdownSim(opts), [opts]);
  const sustainable = useMemo(() => sustainableSpend(opts), [opts]);

  const byYear = useMemo(
    () =>
      [2031, 2032, 2033, 2034, 2035].map((y) => {
        const r = drawdownSim({ ...opts, retireYear: y });
        return {
          year: String(y),
          surplus: Math.round(r.surplusAt92),
          label: r.depletedYear ? `runs out ~${r.depletedYear}` : gbpK(r.surplusAt92),
          depleted: r.depletedYear !== null,
        };
      }),
    [opts]
  );

  const phases = useMemo(() => {
    const buckets = [
      { label: `${retireYear}–40`, from: retireYear, to: 2040 },
      { label: '2041–43', from: 2041, to: 2043 },
      { label: '2044–51', from: 2044, to: 2051 },
      { label: '2052–54', from: 2052, to: 2054 },
      { label: '2055–75', from: 2055, to: 2075 },
    ].filter((b) => b.to >= b.from);
    return buckets.map((b) => {
      const rows = sim.fundingByYear.filter((r) => r.year >= b.from && r.year <= b.to);
      const n = Math.max(1, rows.length);
      const avg = (f: (r: (typeof rows)[number]) => number) => Math.round(rows.reduce((s, r) => s + f(r), 0) / n);
      return {
        phase: b.label,
        HB: avg((r) => r.hb),
        'State pensions': avg((r) => r.statePension),
        'Chris pension': avg((r) => r.chrisPensionDraw),
        'Abby pension': avg((r) => r.abbyPensionDraw),
        'Gilt rungs': avg((r) => r.ladderDraw),
        'ISA / cash': avg((r) => r.isaDraw),
      };
    });
  }, [sim, retireYear]);

  return (
    <section aria-labelledby="the-outlook">
      <h2 id="the-outlook" className="text-xl font-semibold text-slate-800 mb-1">
        The outlook
      </h2>
      <p className="text-sm text-slate-500 mb-3">
        The plan&apos;s models, live &mdash; everything recomputes client-side. These are <em>deterministic</em>
        projections: they assume the chosen real return arrives smoothly every year (the plan&apos;s
        cautious-case convention), not the mean or median of market simulations.
      </p>

      <div className="flex flex-wrap gap-x-8 gap-y-3 mb-4 text-sm">
        <div>
          <label htmlFor="retire-year" className="text-slate-600 block">
            Retire in <span className="font-semibold">{retireYear}</span>
          </label>
          <input
            id="retire-year"
            type="range"
            min={2031}
            max={2035}
            step={1}
            value={retireYear}
            onChange={(e) => setRetireYear(Number(e.target.value))}
            className="w-44 accent-[#14467d]"
          />
        </div>
        <div>
          <span className="text-slate-600 block">Real return</span>
          {[0.02, 0.04].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRealReturn(r)}
              className={`mr-1 rounded px-2 py-0.5 text-xs font-medium ${
                realReturn === r ? 'bg-[#14467d] text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {r * 100}%
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="spend-input" className="text-slate-600 block">
            Retirement spend
          </label>
          <input
            id="spend-input"
            type="number"
            step={5000}
            min={30_000}
            max={120_000}
            value={spend}
            onChange={(e) => setSpend(Number(e.target.value) || 60_000)}
            className="w-28 rounded border border-slate-200 px-2 py-0.5 tabular-nums"
          />
        </div>
        <div>
          <label htmlFor="hb-input" className="text-slate-600 block">
            HB to Nov 2040
          </label>
          <input
            id="hb-input"
            type="number"
            step={1000}
            min={0}
            max={30_000}
            value={hb}
            onChange={(e) => setHb(Number(e.target.value) || 0)}
            className="w-28 rounded border border-slate-200 px-2 py-0.5 tabular-nums"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Pots at exit</div>
          <div className="text-xl font-semibold tabular-nums" data-testid="pots-at-exit">
            {gbpK(pots.total)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Sustainable spend</div>
          <div className="text-xl font-semibold tabular-nums">{gbp(sustainable)}/yr</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Left at 92</div>
          <div className="text-xl font-semibold tabular-nums" data-testid="surplus-at-92">
            {gbpK(sim.surplusAt92)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Drawdown tax (total)</div>
          <div className="text-xl font-semibold tabular-nums">
            {gbp(sim.totalTax)}
            <span className="ml-1 text-xs font-normal text-slate-500">
              {(sim.effectiveTaxRate * 100).toFixed(1)}%{sim.firstTaxedYear ? `, first ${sim.firstTaxedYear}` : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="text-sm text-slate-600 mb-1">
            If we retired in year&hellip; what&apos;s left at 92 (under this scenario&apos;s settings)
          </div>
          <div className="h-56" data-testid="early-retirement-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byYear} margin={{ top: 18, right: 8, bottom: 0, left: 8 }}>
                <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} fontSize={12} />
                <YAxis tickFormatter={(v: number) => gbpK(v)} tickLine={false} axisLine={false} fontSize={11} width={52} />
                <Tooltip formatter={(v) => gbp(Number(v))} />
                <Bar dataKey="surplus" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="label" position="top" style={{ fontSize: 10, fill: '#475569' }} />
                  {byYear.map((d) => (
                    <Cell
                      key={d.year}
                      fill={d.depleted ? PALETTE.amber : Number(d.year) === retireYear ? PALETTE.navy : PALETTE.blue}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Each bar is a separate what-if: retire that year, keep every other setting. Amber = the money
            runs out before 92 at this spend level.
          </p>
        </div>
        <div>
          <div className="text-sm text-slate-600 mb-1">Who funds each year of spending (average by phase)</div>
          <div className="h-56" data-testid="phase-funding-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phases} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <XAxis dataKey="phase" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} fontSize={11} />
                <YAxis tickFormatter={(v: number) => gbpK(v)} tickLine={false} axisLine={false} fontSize={11} width={52} />
                <Tooltip formatter={(v) => gbp(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="HB" stackId="a" fill={PALETTE.amber} />
                <Bar dataKey="Gilt rungs" stackId="a" fill={PALETTE.grey} />
                <Bar dataKey="Chris pension" stackId="a" fill={PALETTE.navy} />
                <Bar dataKey="Abby pension" stackId="a" fill={PALETTE.blue} />
                <Bar dataKey="ISA / cash" stackId="a" fill="#c3ccd8" />
                <Bar dataKey="State pensions" stackId="a" fill={PALETTE.green} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Today&apos;s money throughout. Early exits assume HB stops at retirement. &ldquo;Gilt rungs&rdquo; are the
        non-pension ladder maturing (to 2045); the 2041&ndash;45 rungs live inside Chris&apos;s SIPP, so they appear
        as &ldquo;Chris pension&rdquo; here &mdash; same ladder, second wrapper.
      </p>
    </section>
  );
}
