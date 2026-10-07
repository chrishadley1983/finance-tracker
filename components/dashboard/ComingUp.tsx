'use client';

import { formatGBP, formatDayHeading } from '@/lib/format';
import type { UpcomingCharge } from '@/lib/hooks/useDashboardData';

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Active subscriptions and bills due between today and `days` from now, soonest first. */
export function upcomingCharges(subs: UpcomingCharge[], now: Date = new Date(), days = 14): UpcomingCharge[] {
  const from = isoDay(now);
  const until = isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
  return subs
    .filter((s) => ['active', 'trial'].includes(s.status ?? 'active'))
    .filter((s) => s.next_due !== null && s.next_due >= from && s.next_due <= until)
    .sort((a, b) => (a.next_due! < b.next_due! ? -1 : a.next_due! > b.next_due! ? 1 : a.name.localeCompare(b.name)));
}

export function ComingUp({ subscriptions, now = new Date() }: { subscriptions: UpcomingCharge[]; now?: Date }) {
  const due = upcomingCharges(subscriptions, now);
  if (due.length === 0) {
    return <p className="py-2 text-[13.5px] text-ink-3">Nothing due in the next two weeks.</p>;
  }
  const total = due.reduce((t, s) => t + Math.abs(Number(s.amount)), 0);
  return (
    <div>
      <ul className="divide-y divide-line-2">
        {due.map((s) => (
          <li key={s.id} className="flex items-baseline justify-between gap-3 py-2 text-[13.5px]">
            <span className="min-w-0">
              <span className="block truncate text-ink">{s.name}</span>
              <span className="block text-[12px] text-ink-3">{formatDayHeading(s.next_due!, now)}</span>
            </span>
            <span className="fig shrink-0 text-ink">{formatGBP(Math.abs(Number(s.amount)), { pence: true })}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12.5px] text-ink-3">
        <span className="fig text-ink-2">{formatGBP(total)}</span> due in the next 14 days.
      </p>
    </div>
  );
}
