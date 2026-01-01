import { AppLayout } from '@/components/layout';

export default function TransactionsPage() {
  return (
    <AppLayout title="Transactions">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-slate-500">
            Transaction list with filtering and search coming soon...
          </p>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            Add Transaction
          </button>
        </div>

        {/* Placeholder table header */}
        <div className="border-b border-slate-200 pb-3">
          <div className="grid grid-cols-5 gap-4 text-sm font-medium text-slate-500">
            <div>Date</div>
            <div>Description</div>
            <div>Category</div>
            <div>Account</div>
            <div className="text-right">Amount</div>
          </div>
        </div>

        {/* Empty state */}
        <div className="py-12 text-center text-slate-400">
          <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>6,848 transactions ready to display</p>
        </div>
      </div>
    </AppLayout>
  );
}
