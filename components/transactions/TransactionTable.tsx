'use client';

import { TransactionWithRelations } from '@/lib/hooks/useTransactions';

interface TransactionTableProps {
  transactions: TransactionWithRelations[];
  isLoading: boolean;
  onSort: (column: string) => void;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
}

function SortIcon({ column, sortColumn, sortDirection }: { column: string; sortColumn: string; sortDirection: 'asc' | 'desc' }) {
  if (sortColumn !== column) {
    return (
      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }

  if (sortDirection === 'asc') {
    return (
      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-24"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-48"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-32"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-28"></div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div>
      </td>
    </tr>
  );
}

export function TransactionTable({
  transactions,
  isLoading,
  onSort,
  sortColumn,
  sortDirection,
}: TransactionTableProps) {
  const columns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'description', label: 'Description', sortable: true },
    { key: 'account', label: 'Account', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right' as const },
  ];

  const handleHeaderClick = (column: string, sortable: boolean) => {
    if (sortable) {
      onSort(column);
    }
  };

  if (!isLoading && transactions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-lg font-medium text-slate-900">No transactions found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or search terms</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleHeaderClick(column.key, column.sortable)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-slate-100 select-none' : ''
                  } ${column.align === 'right' ? 'text-right' : ''}`}
                >
                  <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : ''}`}>
                    <span>{column.label}</span>
                    {column.sortable && (
                      <SortIcon column={column.key} sortColumn={sortColumn} sortDirection={sortDirection} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    <div className="max-w-md truncate" title={transaction.description}>
                      {transaction.description}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {transaction.account?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {transaction.category ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {transaction.category.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">Uncategorized</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${
                    transaction.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatAmount(transaction.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
