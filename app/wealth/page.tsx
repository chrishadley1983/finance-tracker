import { AppLayout } from '@/components/layout';

export default function WealthPage() {
  return (
    <AppLayout title="Wealth Tracker">
      <div className="grid gap-6">
        {/* Net worth summary */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Net Worth</h2>
            <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
              Add Snapshot
            </button>
          </div>
          <p className="text-4xl font-bold text-slate-900">--</p>
          <p className="mt-1 text-sm text-slate-500">Last updated: --</p>
        </div>

        {/* Account balances */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Current Accounts</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Savings</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">ISAs</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Pensions</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Investments</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Property</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
        </div>

        {/* Wealth history chart placeholder */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Wealth History</h2>
          <div className="h-64 flex items-center justify-center text-slate-400">
            <p>Chart coming soon... (732 snapshots in database)</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
