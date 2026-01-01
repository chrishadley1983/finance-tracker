import { AppLayout } from '@/components/layout';

export default function DashboardPage() {
  return (
    <AppLayout title="Dashboard">
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Total Balance</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Monthly Spending</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Monthly Income</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-500">Savings Rate</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
          </div>
        </div>

        {/* Placeholder sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
            <p className="mt-4 text-slate-500">Transaction list coming soon...</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Budget Overview</h2>
            <p className="mt-4 text-slate-500">Budget summary coming soon...</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
