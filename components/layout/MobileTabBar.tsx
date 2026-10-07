'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Inbox, List, Menu, TrendingUp } from 'lucide-react';
import type { NavSummary } from '@/lib/nav-summary';

interface MobileTabBarProps {
  summary: NavSummary | null;
  onMore: () => void;
  moreOpen: boolean;
}

const TABS = [
  { href: '/', label: 'Overview', Icon: Home },
  { href: '/transactions', label: 'Spending', Icon: List },
  { href: '/review', label: 'Review', Icon: Inbox },
  { href: '/wealth', label: 'Wealth', Icon: TrendingUp },
];

/** Phone navigation: four tabs plus "More" for everything else. */
export function MobileTabBar({ summary, onMore, moreOpen }: MobileTabBarProps) {
  const pathname = usePathname();
  const reviewCount = summary?.review.total ?? 0;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface px-1 pt-2 md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const on = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? 'page' : undefined}
            className={`relative grid justify-items-center gap-0.5 text-[10.5px] ${on ? 'font-semibold text-ink' : 'text-ink-3'}`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
            {label}
            {href === '/review' && reviewCount > 0 && (
              <span className="fig absolute -top-1 right-[18%] rounded bg-warn-soft px-1 text-[10px] text-warn">
                {reviewCount > 99 ? '99+' : reviewCount}
              </span>
            )}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        aria-expanded={moreOpen}
        className={`grid justify-items-center gap-0.5 text-[10.5px] ${moreOpen ? 'font-semibold text-ink' : 'text-ink-3'}`}
      >
        <Menu className="h-5 w-5" strokeWidth={1.7} aria-hidden />
        More
      </button>
    </nav>
  );
}
