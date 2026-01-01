import { AppLayout } from '@/components/layout';

export default function SettingsPage() {
  return (
    <AppLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        {/* Accounts */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Accounts</h2>
          <p className="text-slate-500 mb-4">Manage your financial accounts.</p>
          <p className="text-sm text-slate-400">18 accounts configured</p>
          <button className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
            Manage Accounts
          </button>
        </div>

        {/* Data Import */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Data Import</h2>
          <p className="text-slate-500 mb-4">Import transactions from bank statements or spreadsheets.</p>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
            Import Data
          </button>
        </div>

        {/* Export */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Export Data</h2>
          <p className="text-slate-500 mb-4">Export your financial data to CSV or JSON.</p>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
              Export CSV
            </button>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
              Export JSON
            </button>
          </div>
        </div>

        {/* Database Info */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Database Statistics</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Transactions</p>
              <p className="font-semibold text-slate-900">6,848</p>
            </div>
            <div>
              <p className="text-slate-500">Accounts</p>
              <p className="font-semibold text-slate-900">18</p>
            </div>
            <div>
              <p className="text-slate-500">Categories</p>
              <p className="font-semibold text-slate-900">55</p>
            </div>
            <div>
              <p className="text-slate-500">Budgets</p>
              <p className="font-semibold text-slate-900">372</p>
            </div>
            <div>
              <p className="text-slate-500">Wealth Snapshots</p>
              <p className="font-semibold text-slate-900">732</p>
            </div>
            <div>
              <p className="text-slate-500">Category Rules</p>
              <p className="font-semibold text-slate-900">32</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
