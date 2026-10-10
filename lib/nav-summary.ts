import { isCosted, monthlyCost } from '@/lib/subscriptions/analysis';

/**
 * Live figures for the navigation column and the Overview header. One small
 * endpoint so the nav never fires a burst of separate requests.
 */
export interface NavSummary {
  asOf: string;
  review: { total: number; uncategorised: number; withSuggestion: number };
  transactions: { thisMonth: number };
  budget: { spent: number; planned: number; usedPct: number | null };
  subscriptions: {
    monthly: number;
    next: { name: string; date: string; amount: number } | null;
  };
  sync: { lastSyncAt: string | null; accounts: string[] };
}

export function monthBounds(today: string): { start: string; end: string; year: number; month: number } {
  const [y, m] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}`, year: y, month: m };
}

export function budgetUsage(expenseActual: number, expenseBudget: number) {
  const spent = Math.abs(expenseActual);
  const planned = Math.abs(expenseBudget);
  return { spent, planned, usedPct: planned > 0 ? Math.round((spent / planned) * 100) : null };
}

interface SubLike {
  name: string;
  amount: number;
  frequency: string;
  status: string | null;
  next_renewal_date: string | null;
}

export function subscriptionsSummary(subs: SubLike[], today: string) {
  const active = subs.filter((s) => isCosted(s.status));
  const monthly = Math.round(active.reduce((t, s) => t + monthlyCost(Number(s.amount), s.frequency), 0) * 100) / 100;
  const upcoming = active
    .filter((s) => s.next_renewal_date && s.next_renewal_date >= today)
    .sort((a, b) => (a.next_renewal_date! < b.next_renewal_date! ? -1 : 1))[0];
  return {
    monthly,
    next: upcoming ? { name: upcoming.name, date: upcoming.next_renewal_date!, amount: Number(upcoming.amount) } : null,
  };
}
