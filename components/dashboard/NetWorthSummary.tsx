'use client';

interface AccountTypeBalance {
  type: string;
  label: string;
  balance: number;
}

interface NetWorthSummaryProps {
  netWorth: number;
  accountTypeBalances: AccountTypeBalance[];
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function NetWorthSummary({ netWorth, accountTypeBalances, isLoading }: NetWorthSummaryProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Net Worth skeleton */}
          <div className="flex-shrink-0">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
          </div>
          {/* Account type skeletons */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Net Worth - prominent display */}
        <div className="flex-shrink-0 pr-6 lg:border-r lg:border-gray-200">
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Net Worth</div>
          <div className={`text-3xl lg:text-4xl font-bold ${netWorth >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {formatCurrency(netWorth)}
          </div>
        </div>

        {/* Account type balances */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {accountTypeBalances.map((item) => (
            <div
              key={item.type}
              className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
            >
              <div className="text-xs font-medium text-gray-500">{item.label}</div>
              <div className={`text-lg font-semibold ${item.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {formatCurrency(item.balance)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
