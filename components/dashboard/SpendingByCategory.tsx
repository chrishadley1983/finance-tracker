'use client';

import { CategorySpend } from '@/lib/hooks/useDashboardData';

interface SpendingByCategoryProps {
  data: CategorySpend[];
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

function SkeletonRow() {
  return (
    <div className="animate-pulse">
      <div className="flex justify-between items-center mb-1">
        <div className="h-4 bg-slate-700 rounded w-24"></div>
        <div className="h-4 bg-slate-700 rounded w-16"></div>
      </div>
      <div className="h-2 bg-slate-700 rounded-full"></div>
    </div>
  );
}

export function SpendingByCategory({ data, isLoading }: SpendingByCategoryProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Spending by Category</h2>

      <div className="space-y-4">
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : data.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No spending data available</p>
        ) : (
          data.map((category) => (
            <div key={category.categoryId}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-300">{category.categoryName}</span>
                <span className="text-sm text-slate-400">
                  {formatCurrency(category.amount)}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${category.percentage}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
