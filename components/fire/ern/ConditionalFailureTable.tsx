'use client';

interface ConditionalFailureRow {
  label: string;
  count: number;
  failureRates: Record<string, number>;
}

interface ConditionalFailureTableProps {
  table: {
    wrRates: number[];
    rows: ConditionalFailureRow[];
  } | null;
  isLoading?: boolean;
}

function getCellColor(rate: number): string {
  if (rate === 0) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300';
  if (rate < 5) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  if (rate < 15) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
  if (rate < 30) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
  return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
}

export function ConditionalFailureTable({
  table,
  isLoading = false,
}: ConditionalFailureTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading table...</div>
        </div>
      </div>
    );
  }

  if (!table || !table.rows || table.rows.length === 0) return null;

  const { wrRates, rows } = table;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
        Conditional Failure Probability
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Failure rate (%) by starting CAPE bucket and withdrawal rate &mdash; ERN&apos;s signature output
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                CAPE Bucket
              </th>
              <th className="text-center px-2 py-2 text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                #
              </th>
              {wrRates.map((rate) => (
                <th
                  key={rate}
                  className="text-center px-2 py-2 text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700"
                >
                  {rate}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">
                  {row.label}
                </td>
                <td className="text-center px-2 py-2 text-gray-500 dark:text-gray-400">
                  {row.count}
                </td>
                {wrRates.map((rate) => {
                  const key = rate.toFixed(2);
                  const failRate = row.failureRates[key] ?? 0;
                  return (
                    <td
                      key={rate}
                      className={`text-center px-2 py-2 font-mono text-xs font-medium ${getCellColor(failRate)}`}
                    >
                      {failRate.toFixed(0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
