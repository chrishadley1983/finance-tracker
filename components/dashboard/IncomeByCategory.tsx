'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CategorySpend } from '@/lib/hooks/useDashboardData';

const INITIAL_DISPLAY_COUNT = 8;

interface IncomeByCategoryProps {
  data: CategorySpend[];
  isLoading: boolean;
  dateFrom?: string;
  dateTo?: string;
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

export function IncomeByCategory({ data, isLoading, dateFrom, dateTo }: IncomeByCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const hasMore = data.length > INITIAL_DISPLAY_COUNT;
  const displayData = isExpanded ? data : data.slice(0, INITIAL_DISPLAY_COUNT);
  const hiddenCount = data.length - INITIAL_DISPLAY_COUNT;

  const handleCategoryClick = (categoryId: string) => {
    const params = new URLSearchParams();
    params.set('categoryId', categoryId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    router.push(`/transactions?${params.toString()}`);
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Income by Category</h2>

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
          <p className="text-slate-400 text-sm py-4 text-center">No income data available</p>
        ) : (
          <>
            {displayData.map((category) => (
              <button
                key={category.categoryId}
                onClick={() => handleCategoryClick(category.categoryId)}
                className="w-full text-left hover:bg-slate-700/50 rounded-lg p-2 -mx-2 transition-colors"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-300">{category.categoryName}</span>
                  <span className="text-sm text-slate-400">
                    {formatCurrency(category.amount)}
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
              </button>
            ))}
            {hasMore && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-center text-sm text-emerald-400 hover:text-emerald-300 py-2 transition-colors"
              >
                {isExpanded ? 'Show less' : `See ${hiddenCount} more`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
