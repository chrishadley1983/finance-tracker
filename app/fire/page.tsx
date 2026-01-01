import { AppLayout } from '@/components/layout';

export default function FirePage() {
  return (
    <AppLayout title="FIRE Calculator">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Parameters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Parameters</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Annual Spending
                </label>
                <input
                  type="text"
                  placeholder="--"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Withdrawal Rate (%)
                </label>
                <input
                  type="text"
                  placeholder="4.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expected Return (%)
                </label>
                <input
                  type="text"
                  placeholder="7.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Retirement Age
                </label>
                <input
                  type="text"
                  placeholder="55"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Scenarios</h2>
            <p className="text-sm text-slate-500">4 scenarios configured</p>
            <ul className="mt-3 space-y-2">
              <li className="text-sm text-slate-600">Lean FIRE</li>
              <li className="text-sm text-slate-600">Regular FIRE</li>
              <li className="text-sm text-slate-600">Fat FIRE</li>
              <li className="text-sm text-slate-600">Coast FIRE</li>
            </ul>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <p className="text-sm font-medium text-slate-500">FIRE Number</p>
              <p className="mt-2 text-3xl font-bold text-emerald-600">--</p>
              <p className="mt-1 text-sm text-slate-400">25x annual spending</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <p className="text-sm font-medium text-slate-500">Years to FIRE</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
              <p className="mt-1 text-sm text-slate-400">At current savings rate</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <p className="text-sm font-medium text-slate-500">Current Progress</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">--%</p>
              <p className="mt-1 text-sm text-slate-400">Towards FIRE number</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <p className="text-sm font-medium text-slate-500">Target Date</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">--</p>
              <p className="mt-1 text-sm text-slate-400">Estimated FIRE date</p>
            </div>
          </div>

          {/* Projection chart placeholder */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Wealth Projection</h2>
            <div className="h-64 flex items-center justify-center text-slate-400">
              <p>FIRE projection chart coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
