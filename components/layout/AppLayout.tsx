'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ToastProvider } from '@/components/ui/Toast';
import { Header } from './Header';
import { NavRail } from './NavRail';
import { NavColumn } from './NavColumn';
import { MobileTabBar } from './MobileTabBar';
import { CommandPalette } from './CommandPalette';
import { activeSection, type SectionId } from './nav-config';
import { useNavSummary } from './useNavSummary';
import { useShortcuts } from './useShortcuts';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

const COLUMN_KEY = 'hft-nav-column';

/**
 * Page shell: labelled section rail, a live column for the chosen section
 * (figures + pins), ⌘K search, and a bottom tab bar on phones. Also mounts the
 * ToastProvider so `useToast()` works in anything rendered inside it.
 */
export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <ToastProvider>
      <Shell title={title}>{children}</Shell>
    </ToastProvider>
  );
}

function Shell({ children, title }: AppLayoutProps) {
  const pathname = usePathname();
  const { summary, stale } = useNavSummary();
  const [section, setSection] = useState<SectionId>(() => activeSection(pathname));
  const [columnHidden, setColumnHidden] = useState(false);
  const [flyout, setFlyout] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setSection(activeSection(pathname));
    setFlyout(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setColumnHidden(window.localStorage.getItem(COLUMN_KEY) === 'hidden');
    } catch {
      // storage blocked
    }
  }, []);

  const toggleColumn = useCallback(() => {
    setColumnHidden((h) => {
      try {
        window.localStorage.setItem(COLUMN_KEY, h ? 'shown' : 'hidden');
      } catch {
        // ignore
      }
      return !h;
    });
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  useShortcuts({ onSearch: openSearch, onToggleColumn: toggleColumn });

  const pickSection = (id: SectionId) => {
    setSection(id);
    // When the column is docked it just switches; otherwise it opens as a flyout.
    setFlyout(columnHidden || window.innerWidth < 1100 ? true : false);
  };

  const columnProps = { summary, stale, pageTitle: title, onOpenSearch: openSearch };

  return (
    <div className="min-h-screen bg-ground text-ink">
      {/* Rail: tablets and up */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[68px] md:block">
        <NavRail current={section} onSelect={pickSection} />
      </div>

      {/* Docked column: wide screens, unless hidden with [ */}
      {!columnHidden && (
        <div className="fixed inset-y-0 left-[68px] z-30 hidden w-[232px] min-[1100px]:block">
          <NavColumn section={section} {...columnProps} />
        </div>
      )}

      {/* Flyout column: narrower screens, or when docking is off */}
      {flyout && (
        <>
          <div className="fixed inset-0 z-30 hidden bg-black/20 md:block" onClick={() => setFlyout(false)} aria-hidden />
          <div className="fixed inset-y-0 left-[68px] z-40 hidden w-[260px] shadow-xl md:block">
            <NavColumn section={section} {...columnProps} onNavigate={() => setFlyout(false)} />
          </div>
        </>
      )}

      {/* Phone "More" sheet */}
      {moreOpen && (
        <div className="fixed inset-x-0 top-0 bottom-[64px] z-40 md:hidden">
          <NavColumn section={section} {...columnProps} allSections onNavigate={() => setMoreOpen(false)} />
        </div>
      )}

      <div className={`pb-24 md:pb-0 md:pl-[68px] ${columnHidden ? '' : 'min-[1100px]:pl-[300px]'}`}>
        <Header title={title} onSearch={openSearch} />
        <main className="p-4 lg:px-7 lg:py-6">{children}</main>
      </div>

      <MobileTabBar summary={summary} onMore={() => setMoreOpen((o) => !o)} moreOpen={moreOpen} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
