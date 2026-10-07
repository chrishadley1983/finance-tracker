import type { NavSummary } from '@/lib/nav-summary';
import { formatGBP, gbDate } from '@/lib/format';

export type SectionId = 'day' | 'plan' | 'wealth' | 'setup';

export interface NavLive {
  /** Short figure shown on the right, e.g. "23" or "63%". */
  value?: string;
  /** Second line under the label, e.g. "17 ready to accept". */
  note?: string;
  tone?: 'warn' | 'bad';
  /** 0–100, draws a thin progress bar under the item. */
  progress?: number;
}

export interface NavItem {
  href: string;
  label: string;
  /** Keyboard shortcut after pressing G, e.g. 'o' for G then O. */
  go?: string;
  live?: (s: NavSummary) => NavLive | null;
}

export interface NavSection {
  id: SectionId;
  label: string;
  /** Rail label (short). */
  short: string;
  items: NavItem[];
}

const relDay = (iso: string, today: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const days = Math.round((d.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return gbDate(d, { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'day',
    label: 'Day to day',
    short: 'Day',
    items: [
      { href: '/', label: 'Overview', go: 'o' },
      {
        href: '/transactions',
        label: 'Transactions',
        go: 't',
        live: (s) => ({ value: String(s.transactions.thisMonth), note: 'this month' }),
      },
      {
        href: '/review',
        label: 'To review',
        go: 'r',
        live: (s) =>
          s.review.total > 0
            ? {
                value: String(s.review.total),
                tone: 'warn',
                note: s.review.withSuggestion > 0 ? `${s.review.withSuggestion} have a suggestion` : undefined,
              }
            : { note: 'All clear' },
      },
      {
        href: '/subscriptions',
        label: 'Subscriptions',
        go: 's',
        live: (s) => ({
          value: `${formatGBP(s.subscriptions.monthly)}/mo`,
          note: s.subscriptions.next
            ? `${s.subscriptions.next.name} renews ${relDay(s.subscriptions.next.date, s.asOf)}`
            : undefined,
        }),
      },
    ],
  },
  {
    id: 'plan',
    label: 'Planning',
    short: 'Plan',
    items: [
      {
        href: '/budgets',
        label: 'Budgets',
        go: 'b',
        live: (s) =>
          s.budget.usedPct === null
            ? null
            : {
                value: `${s.budget.usedPct}%`,
                note: `${formatGBP(s.budget.spent)} of ${formatGBP(s.budget.planned)} this month`,
                tone: s.budget.usedPct > 100 ? 'bad' : undefined,
                progress: Math.min(100, s.budget.usedPct),
              },
      },
      { href: '/reports', label: 'Reports', go: 'p' },
    ],
  },
  {
    id: 'wealth',
    label: 'Long term',
    short: 'Wealth',
    items: [
      { href: '/wealth', label: 'Net worth', go: 'w' },
      { href: '/fire', label: 'FIRE', go: 'f' },
      { href: '/planning', label: 'Notes', go: 'n' },
    ],
  },
  {
    id: 'setup',
    label: 'Set-up',
    short: 'Set-up',
    items: [
      { href: '/accounts', label: 'Accounts', go: 'a' },
      { href: '/categories', label: 'Categories & rules', go: 'c' },
      { href: '/import', label: 'Import', go: 'i' },
      { href: '/settings/bank-sync', label: 'Bank sync', go: 'y' },
      { href: '/settings', label: 'Settings' },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, section: s })));

/** The nav item a path belongs to: exact match, else the longest prefix. */
export function activeItem(pathname: string) {
  const exact = ALL_NAV_ITEMS.find((i) => i.href === pathname);
  if (exact) return exact;
  return (
    ALL_NAV_ITEMS.filter((i) => i.href !== '/' && pathname.startsWith(`${i.href}/`)).sort(
      (a, b) => b.href.length - a.href.length
    )[0] ?? null
  );
}

export function activeSection(pathname: string): SectionId {
  return activeItem(pathname)?.section.id ?? 'day';
}
