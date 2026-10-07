export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4">
      <div className="w-full max-w-sm space-y-6 py-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Hadley <span className="font-normal text-ink-3">Finance Tracker</span>
          </h1>
          <p className="text-sm text-ink-3">Household money, budgets and the long-term plan.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
