'use client';

import Link from 'next/link';
import { type InvestmentSummary } from '@/lib/types/investment';

interface InvestmentSummaryCardProps {
  summary: InvestmentSummary | null;
  isLoading: boolean;
}

export function InvestmentSummaryCard({ summary, isLoading }: InvestmentSummaryCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
        <div className="h-8 bg-gray-200 rounded w-32 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!summary || summary.accountCount === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h3 className="font-medium text-gray-900">Investments</h3>
        </div>
        <p className="text-sm text-gray-500 mb-3">No investment accounts yet</p>
        <Link
          href="/investments"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Add account →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h3 className="font-medium text-gray-900">Investments</h3>
        </div>
        <Link
          href="/investments"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          View all
        </Link>
      </div>

      {/* Total Value */}
      <p className="text-2xl font-bold text-gray-900 mb-1">
        {formatCurrency(summary.totalValue)}
      </p>
      <p className="text-xs text-gray-500 mb-3">
        {summary.accountCount} account{summary.accountCount !== 1 ? 's' : ''}
        {summary.lastUpdated && ` · Updated ${formatDate(summary.lastUpdated)}`}
      </p>

      {/* Breakdown by Type */}
      {summary.byType.length > 0 && (
        <div className="space-y-1.5">
          {summary.byType.slice(0, 3).map((item) => (
            <div key={item.type} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{item.label}</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
