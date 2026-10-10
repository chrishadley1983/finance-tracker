'use client';

import { Home, PieChart, TrendingUp, Settings2 } from 'lucide-react';
import type { SectionId } from './nav-config';
import { NAV_SECTIONS } from './nav-config';

const ICONS: Record<SectionId, typeof Home> = {
  day: Home,
  plan: PieChart,
  wealth: TrendingUp,
  setup: Settings2,
};

interface NavRailProps {
  current: SectionId;
  onSelect: (id: SectionId) => void;
}

/** Slim section picker. Choosing a section shows its pages in the column. */
export function NavRail({ current, onSelect }: NavRailProps) {
  const main = NAV_SECTIONS.filter((s) => s.id !== 'setup');
  const setup = NAV_SECTIONS.find((s) => s.id === 'setup')!;
  const button = (id: SectionId, label: string) => {
    const Icon = ICONS[id];
    const on = current === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        aria-pressed={on}
        className={`grid w-[54px] justify-items-center gap-0.5 rounded-md pt-2 pb-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
          on ? 'bg-rail-on text-ink font-semibold ring-1 ring-line' : 'text-rail-ink hover:text-ink'
        }`}
      >
        <Icon className="h-[19px] w-[19px]" strokeWidth={1.7} aria-hidden />
        {label}
      </button>
    );
  };
  return (
    <nav aria-label="Sections" className="flex h-full flex-col items-center gap-1 border-r border-line bg-rail py-3.5">
      <div className="mb-3 text-center text-[13px] font-bold leading-tight tracking-tight text-ink">
        Hadley
        <span className="block text-[9.5px] font-normal tracking-normal text-ink-3">Finance</span>
      </div>
      {main.map((s) => button(s.id, s.short))}
      <span className="flex-1" />
      {button(setup.id, setup.short)}
    </nav>
  );
}
