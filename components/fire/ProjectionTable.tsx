'use client';

import { useState } from 'react';
import { Download, ChevronDown, ChevronUp, PartyPopper } from 'lucide-react';
import type { FireResult, FireProjection } from '@/lib/types/fire';

interface ProjectionTableProps {
  result: FireResult | null;
  isLoading?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(projection: FireProjection, fiAge: number | null) {
  if (projection.fiStatus === 'depleted') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        Depleted
      </span>
    );
  }

  if (projection.fiStatus === 'fi_reached' && projection.age === fiAge) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <PartyPopper className="h-3 w-3" />
        FI Reached!
      </span>
    );
  }

  if (projection.fiStatus === 'retired') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
        Retired
      </span>
    );
  }

  if (projection.fiStatus === 'fi_reached') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        FI
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
      Accumulating
    </span>
  );
}

export function ProjectionTable({ result, isLoading = false }: ProjectionTableProps) {
  const [showAllYears, setShowAllYears] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!result || result.projections.length === 0) {
    return null;
  }

  const exportToCsv = () => {
    const headers = [
      'Age',
      'Year',
      'Portfolio Start',
      'Contributions',
      'Growth',
      'Withdrawals',
      'State Pension',
      'Portfolio End',
      'Status',
    ];

    const rows = result.projections.map((p) => [
      p.age,
      p.year,
      p.portfolioStart.toFixed(2),
      p.contributions.toFixed(2),
      p.growth.toFixed(2),
      p.withdrawals.toFixed(2),
      p.statePension.toFixed(2),
      p.portfolioEnd.toFixed(2),
      p.fiStatus,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fire-projection-${result.scenario.name.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get key years to show when collapsed
  const retirementAge = result.inputs.targetRetirementAge || 65;
  const keyYears = new Set<number>();

  // Always show first 3 years
  result.projections.slice(0, 3).forEach((p) => keyYears.add(p.age));

  // Show FI year
  if (result.fiAge) keyYears.add(result.fiAge);

  // Show retirement year and a few after
  const retirementIndex = result.projections.findIndex((p) => p.age === retirementAge);
  if (retirementIndex >= 0) {
    for (let i = 0; i < 3 && retirementIndex + i < result.projections.length; i++) {
      keyYears.add(result.projections[retirementIndex + i].age);
    }
  }

  // Show last year
  if (result.projections.length > 0) {
    keyYears.add(result.projections[result.projections.length - 1].age);
  }

  const displayProjections = showAllYears
    ? result.projections
    : result.projections.filter((p) => keyYears.has(p.age));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Year-by-Year Projection
        </h3>
        <button
          onClick={exportToCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Age
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Portfolio Start
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Contributions
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Growth
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Withdrawals
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                State Pension
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Portfolio End
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {displayProjections.map((projection, index) => {
              const isFiYear = projection.age === result.fiAge;
              const isRetirementYear = projection.age === retirementAge;

              return (
                <tr
                  key={projection.age}
                  className={`${
                    isFiYear
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : isRetirementYear
                        ? 'bg-amber-50 dark:bg-amber-900/20'
                        : ''
                  } hover:bg-gray-50 dark:hover:bg-gray-700/50`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {projection.age}
                    <span className="text-gray-400 ml-1">({projection.year})</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                    {formatCurrency(projection.portfolioStart)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-emerald-600 dark:text-emerald-400">
                    {projection.contributions > 0 ? `+${formatCurrency(projection.contributions)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400">
                    {projection.growth > 0 ? `+${formatCurrency(projection.growth)}` : formatCurrency(projection.growth)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                    {projection.withdrawals > 0 ? `-${formatCurrency(projection.withdrawals)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                    {projection.statePension > 0 ? `+${formatCurrency(projection.statePension)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(projection.portfolioEnd)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(projection, result.fiAge)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result.projections.length > displayProjections.length && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAllYears(!showAllYears)}
            className="flex items-center gap-1.5 mx-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {showAllYears ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show Key Years Only
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show All {result.projections.length} Years
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
