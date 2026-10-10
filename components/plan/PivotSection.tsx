'use client';

import { useMemo, useState } from 'react';
import { pivotProgramme, currentRetune } from '@/lib/plan/pivot';
import { HICBC, PAYSLIP } from '@/lib/plan/assumptions';
import { gbp } from './format';

export function PivotSection() {
  const [target, setTarget] = useState<number>(HICBC.defaultTarget);
  const programme = useMemo(() => pivotProgramme(target), [target]);
  const retune = useMemo(() => currentRetune(target), [target]);

  return (
    <section aria-labelledby="the-pivot">
      <h2 id="the-pivot" className="text-xl font-semibold text-slate-800 mb-1">
        The pivot
      </h2>
      <p className="text-sm text-slate-500 mb-3">
        Abby sacrifices salary each April so her taxable income lands on the target — keeping child benefit
        (full below £60k) and 42% relief. Drag to explore; the plan operates at £59,500.
      </p>

      <div className="mb-4">
        <label htmlFor="ani-target" className="text-sm text-slate-600">
          Target income (ANI): <span className="font-semibold tabular-nums">{gbp(target)}</span>
          {target <= HICBC.lowerThreshold ? (
            <span className="ml-2 text-xs text-emerald-700">full child benefit</span>
          ) : target >= HICBC.upperThreshold ? (
            <span className="ml-2 text-xs text-red-700">no child benefit</span>
          ) : (
            <span className="ml-2 text-xs text-amber-700">tapered child benefit</span>
          )}
        </label>
        <input
          id="ani-target"
          type="range"
          min={50_270}
          max={80_000}
          step={250}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-full accent-[#14467d]"
        />
      </div>

      {retune && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 mb-4 text-sm">
          <span className="font-semibold text-slate-800">April recipe, {retune.taxYear}:</span>{' '}
          package {gbp(retune.packageTotal)} − target {gbp(target)} → extra sacrifice{' '}
          <span className="font-semibold">{gbp(retune.extraSacrifice)}</span> →{' '}
          <span className="font-semibold text-[#14467d]">set AVC to ~{retune.avcPct}%</span> of basic
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums" data-testid="pivot-table">
          <thead>
            <tr className="bg-slate-100 text-left text-xs text-slate-600">
              <th className="px-2 py-1.5">Tax year</th>
              <th className="px-2 py-1.5 text-right">AVC %</th>
              <th className="px-2 py-1.5 text-right">Extra sacrifice</th>
              <th className="px-2 py-1.5 text-right">Take-home cut</th>
              <th className="px-2 py-1.5 text-right">CB kept</th>
              <th className="px-2 py-1.5 text-right">Net cost</th>
            </tr>
          </thead>
          <tbody>
            {programme.years.map((y) => (
              <tr key={y.taxYear} className="border-b border-slate-100">
                <td className="px-2 py-1">{y.taxYear}</td>
                <td className="px-2 py-1 text-right font-medium">{y.avcPct}%</td>
                <td className="px-2 py-1 text-right">{gbp(y.extraSacrifice)}</td>
                <td className="px-2 py-1 text-right">−{gbp(y.takeHomeCut)}</td>
                <td className="px-2 py-1 text-right text-emerald-700">+{gbp(y.cbKept)}</td>
                <td className="px-2 py-1 text-right">{y.netCost > 0 ? `−${gbp(y.netCost)}` : `+${gbp(-y.netCost)}`}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-2 py-1.5">Σ 9 years</td>
              <td />
              <td className="px-2 py-1.5 text-right" data-testid="pivot-total-sacrifice">
                {gbp(programme.totals.extraSacrifice)}
              </td>
              <td className="px-2 py-1.5 text-right">−{gbp(programme.totals.takeHomeCut)}</td>
              <td className="px-2 py-1.5 text-right text-emerald-700">+{gbp(programme.totals.cbKept)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Every £1 of take-home given up puts £{(programme.totals.extraSacrifice / programme.totals.takeHomeCut).toFixed(2)} in her pension; the child benefit rides on top. Payslip
        inputs from plan/assumptions.json ({PAYSLIP.asOf} payslip); {Math.round(PAYSLIP.payGrowth * 100)}% pay growth, {Math.round(PAYSLIP.bonusRate * 100)}% bonus, thresholds frozen.
      </p>
    </section>
  );
}
