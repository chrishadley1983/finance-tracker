'use client';

import { MonthlyData } from '@/lib/hooks/useDashboardData';

interface MonthlyTrendProps {
  data: MonthlyData[];
  isLoading: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}k`;
  }
  return `£${amount.toFixed(0)}`;
}

function SkeletonChart() {
  return (
    <div className="animate-pulse">
      <div className="flex items-end justify-around h-48 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex-1 flex items-end justify-center gap-1">
            <div
              className="w-4 bg-slate-700 rounded-t"
              style={{ height: `${30 + Math.random() * 70}%` }}
            ></div>
            <div
              className="w-4 bg-slate-700 rounded-t"
              style={{ height: `${30 + Math.random() * 70}%` }}
            ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-around mt-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-3 bg-slate-700 rounded w-8"></div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyTrend({ data, isLoading }: MonthlyTrendProps) {
  // Calculate max value for scaling
  const maxValue = Math.max(
    ...data.flatMap((d) => [d.income, d.expenses]),
    1 // Avoid division by zero
  );

  const chartHeight = 180;
  const barWidth = 16;
  const barGap = 4;
  const groupGap = 24;
  const yAxisWidth = 45; // Space for Y-axis labels

  // Calculate total width needed
  const groupWidth = barWidth * 2 + barGap;
  const totalWidth = data.length * groupWidth + (data.length - 1) * groupGap;

  // Calculate Y-axis tick values (0, 25%, 50%, 75%, 100% of max)
  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    value: maxValue * ratio,
  }));

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Monthly Trend</h2>

      {isLoading ? (
        <SkeletonChart />
      ) : data.length === 0 ? (
        <p className="text-slate-400 text-sm py-4 text-center">No trend data available</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[300px]">
            {/* Chart */}
            <svg
              viewBox={`0 0 ${Math.max(totalWidth + yAxisWidth + 20, 300)} ${chartHeight + 40}`}
              className="w-full h-auto"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Y-axis labels and grid lines */}
              {yAxisTicks.map(({ ratio, value }) => (
                <g key={ratio}>
                  {/* Y-axis label */}
                  <text
                    x={yAxisWidth - 5}
                    y={chartHeight - ratio * chartHeight + 14}
                    textAnchor="end"
                    className="fill-slate-400"
                    fontSize="10"
                  >
                    {formatCompactCurrency(value)}
                  </text>
                  {/* Grid line */}
                  <line
                    x1={yAxisWidth}
                    y1={chartHeight - ratio * chartHeight + 10}
                    x2={yAxisWidth + totalWidth + 10}
                    y2={chartHeight - ratio * chartHeight + 10}
                    stroke="#334155"
                    strokeDasharray="4,4"
                  />
                </g>
              ))}

              {/* Bars */}
              {data.map((month, index) => {
                const x = yAxisWidth + index * (groupWidth + groupGap);
                const incomeHeight = (month.income / maxValue) * chartHeight;
                const expenseHeight = (month.expenses / maxValue) * chartHeight;

                return (
                  <g key={month.month}>
                    {/* Income bar (green) */}
                    <rect
                      x={x}
                      y={chartHeight - incomeHeight + 10}
                      width={barWidth}
                      height={incomeHeight}
                      fill="#4ade80"
                      rx="2"
                    />
                    {/* Expense bar (red) */}
                    <rect
                      x={x + barWidth + barGap}
                      y={chartHeight - expenseHeight + 10}
                      width={barWidth}
                      height={expenseHeight}
                      fill="#f87171"
                      rx="2"
                    />
                    {/* Month label */}
                    <text
                      x={x + groupWidth / 2}
                      y={chartHeight + 28}
                      textAnchor="middle"
                      className="fill-slate-400 text-xs"
                      fontSize="11"
                    >
                      {month.month}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded"></div>
                <span className="text-xs text-slate-400">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded"></div>
                <span className="text-xs text-slate-400">Expenses</span>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-around mt-4 text-xs">
              {data.slice(-3).map((month) => (
                <div key={month.month} className="text-center">
                  <p className="text-slate-500">{month.month}</p>
                  <p className="text-green-400">{formatCurrency(month.income)}</p>
                  <p className="text-red-400">{formatCurrency(month.expenses)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
