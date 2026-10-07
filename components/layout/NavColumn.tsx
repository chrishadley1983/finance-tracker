'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Pin, PinOff, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { NAV_SECTIONS, activeItem, type NavItem, type SectionId } from './nav-config';
import type { NavSummary } from '@/lib/nav-summary';
import { usePins } from './usePins';

interface NavColumnProps {
  section: SectionId;
  summary: NavSummary | null;
  stale: boolean;
  pageTitle: string;
  onOpenSearch: () => void;
  onNavigate?: () => void;
  /** Show every section (used by the phone "More" sheet). */
  allSections?: boolean;
}

function syncLabel(iso: string | null): string {
  if (!iso) return 'Not synced yet';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `Synced ${Math.max(mins, 1)} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Synced ${hrs}h ago`;
  return `Synced ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function Item({ item, summary, current, onNavigate }: { item: NavItem; summary: NavSummary | null; current: boolean; onNavigate?: () => void }) {
  let live: ReturnType<NonNullable<NavItem['live']>> = null;
  try {
    live = summary && item.live ? item.live(summary) : null;
  } catch {
    // A malformed summary must never take the navigation down.
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      className={`grid grid-cols-[1fr_auto] gap-x-2 rounded-md px-2 py-1.5 text-ink focus-visible:outline-2 focus-visible:outline-accent ${
        current ? 'bg-surface ring-1 ring-line' : 'hover:bg-line-2'
      }`}
    >
      <span className={`text-[13.5px] ${current ? 'font-semibold' : ''}`}>{item.label}</span>
      {live?.value ? (
        <b
          className={`fig text-[12.5px] font-medium ${
            live.tone === 'warn' ? 'text-warn' : live.tone === 'bad' ? 'text-bad' : 'text-ink-2'
          }`}
        >
          {live.value}
        </b>
      ) : (
        <span />
      )}
      {live?.note && <em className="col-span-2 text-xs not-italic text-ink-3">{live.note}</em>}
      {live?.progress !== undefined && (
        <span className="col-span-2 mt-1 block h-[3px] overflow-hidden rounded bg-line-2" aria-hidden>
          <span
            className={`block h-full ${live.tone === 'bad' ? 'bg-bad' : 'bg-ink-3'}`}
            style={{ width: `${live.progress}%` }}
          />
        </span>
      )}
    </Link>
  );
}

/** The live column: the chosen section's pages with figures, then pins. */
export function NavColumn({ section, summary, stale, pageTitle, onOpenSearch, onNavigate, allSections }: NavColumnProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { pins, pin, unpin } = usePins();
  const [signingOut, setSigningOut] = useState(false);
  const current = activeItem(pathname);
  const isPinned = pins.some((p) => p.href === pathname);
  const sections = allSections ? NAV_SECTIONS : NAV_SECTIONS.filter((s) => s.id === section);

  const togglePin = async () => {
    try {
      if (isPinned) await unpin(pathname);
      else await pin(pathname, current?.label ?? pageTitle);
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Something went wrong', tone: 'error' });
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
      router.push('/login');
      router.refresh();
    } catch {
      toast({ message: 'Could not sign out. Try again.', tone: 'error' });
      setSigningOut(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3.5 overflow-y-auto border-r border-line bg-sunk px-3 py-3.5">
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex items-center justify-between rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink-3 hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" aria-hidden />
          Search or jump
        </span>
        <kbd className="rounded border border-b-2 border-line px-1 font-mono text-[11px] text-ink-2">⌘K</kbd>
      </button>

      {sections.map((s) => (
        <div key={s.id} className="grid gap-0.5">
          <h2 className={allSections ? 'px-2 pb-1 text-[12.5px] text-ink-3' : 'mx-2 mb-1 text-[15px] font-semibold text-ink'}>
            {s.label}
          </h2>
          {s.items.map((item) => (
            <Item key={item.href} item={item} summary={summary} current={current?.href === item.href} onNavigate={onNavigate} />
          ))}
        </div>
      ))}

      <div className="grid gap-0.5 border-t border-line pt-2.5">
        <div className="flex items-center justify-between px-2 pb-1 text-[12.5px] text-ink-3">
          <span>Pinned</span>
          <button type="button" onClick={togglePin} className="flex items-center gap-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
            {isPinned ? <PinOff className="h-3 w-3" aria-hidden /> : <Pin className="h-3 w-3" aria-hidden />}
            {isPinned ? 'Unpin this page' : 'Pin this page'}
          </button>
        </div>
        {pins.length === 0 ? (
          <p className="px-2 text-xs text-ink-3">Pin pages you use a lot, like a budget month or a report.</p>
        ) : (
          pins.map((p) => (
            <div key={p.href} className="group flex items-center">
              <Link
                href={p.href}
                onClick={onNavigate}
                className={`flex-1 rounded-md px-2 py-1.5 text-[13.5px] text-ink hover:bg-line-2 ${pathname === p.href ? 'font-semibold' : ''}`}
              >
                {p.label}
              </Link>
              <button
                type="button"
                aria-label={`Unpin ${p.label}`}
                onClick={() => unpin(p.href).catch(() => toast({ message: 'Could not unpin', tone: 'error' }))}
                className="rounded p-1 text-ink-3 opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
              >
                <PinOff className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto grid gap-1 px-2 text-xs text-ink-3">
        <span title={summary?.sync.accounts.join(', ')}>
          <span className={`mr-1.5 inline-block h-[7px] w-[7px] rounded-full ${stale ? 'bg-warn' : 'bg-in'}`} aria-hidden />
          {stale ? 'Figures may be out of date' : syncLabel(summary?.sync.lastSyncAt ?? null)}
        </span>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 justify-self-start hover:text-ink disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
