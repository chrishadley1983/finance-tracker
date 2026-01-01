import { AppLayout } from '@/components/layout';

export default function CategoriesPage() {
  return (
    <AppLayout title="Categories">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income Categories */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Income Categories</h2>
          <p className="text-slate-500">Income category management coming soon...</p>
        </div>

        {/* Expense Categories */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Expense Categories</h2>
          <p className="text-slate-500">Expense category management coming soon...</p>
        </div>

        {/* Category Mappings */}
        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Auto-Categorisation Rules</h2>
          <p className="text-slate-500">
            Configure rules to automatically categorise transactions based on description patterns.
          </p>
          <p className="mt-2 text-sm text-slate-400">32 rules configured</p>
        </div>
      </div>
    </AppLayout>
  );
}
