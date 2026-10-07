'use client';

import { Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  onSearch: () => void;
  /** The docked nav column already has a search box on wide screens. */
  columnDocked?: boolean;
}

/** Page title bar. Search is always one click (or ⌘K) away. */
export function Header({ title, onSearch, columnDocked = false }: HeaderProps) {
  return (
    <header
      className="sticky z-30 flex items-center justify-between gap-3 border-b border-line bg-ground/95 px-4 py-3 backdrop-blur lg:px-7"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <h1 className="text-xl font-semibold tracking-tight text-ink lg:text-[22px]">{title}</h1>
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search or jump"
        className={`flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink-3 hover:text-ink-2 ${columnDocked ? 'dock:hidden' : ''}`}
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Search</span>
      </button>
    </header>
  );
}
