import { AppLayout } from '@/components/layout';

export default function BudgetsPage() {
  return (
    <AppLayout title="Budgets">
      <div className="grid gap-6">
        {/* Month selector placeholder */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-lg font-semibold">January 2026</span>
            <button className="p-2 hover:bg-slate-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            Edit Budgets
          </button>
        </div>

        {/* Budget summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Budgeted</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Spent</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Remaining</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">--</p>
          </div>
        </div>

        {/* Budget categories placeholder */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Budget by Category</h2>
          <p className="text-slate-500">Budget progress bars coming soon...</p>
          <p className="mt-2 text-sm text-slate-400">372 budget entries in database</p>
        </div>
      </div>
    </AppLayout>
  );
}
