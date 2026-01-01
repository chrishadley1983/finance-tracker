'use client';

import Link from 'next/link';
import { Transaction } from '@/lib/hooks/useDashboardData';

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
}

function SkeletonRow() {
  return (
    <div className="flex justify-between items-center py-2 animate-pulse">
      <div className="flex-1">
        <div className="h-4 bg-slate-700 rounded w-32 mb-1"></div>
        <div className="h-3 bg-slate-700 rounded w-48"></div>
      </div>
      <div className="h-4 bg-slate-700 rounded w-16"></div>
    </div>
  );
}

export function RecentTransactions({ transactions, isLoading }: RecentTransactionsProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>

      <div className="space-y-1 divide-y divide-slate-700">
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : transactions.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No transactions found</p>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction.id} className="flex justify-between items-center py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">
                    {formatDate(transaction.date)}
                  </span>
                  <span className="text-white text-sm truncate">
                    {transaction.description}
                  </span>
                </div>
              </div>
              <span
                className={`text-sm font-medium ml-4 ${
                  transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(transaction.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      <Link
        href="/transactions"
        className="block mt-4 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        View all →
      </Link>
    </div>
  );
}
