/** Shapes and helpers for GET /api/truelayer/status, shared by Bank sync and Settings. */

import { gbDate } from '@/lib/format';

export interface StatusAccount {
  id: string;
  name: string;
  type: string;
  linked: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  provider: string | null;
  connectionActive: boolean;
  needsReconsent: boolean;
}

export interface StatusResponse {
  configured: boolean;
  accounts: StatusAccount[];
}

export type LinkState = 'connected' | 'reconnect' | 'unlinked';

export function linkState(a: StatusAccount): LinkState {
  if (!a.linked) return 'unlinked';
  return a.needsReconsent ? 'reconnect' : 'connected';
}

/** "Just now", "12 minutes ago", "3 hours ago", "Yesterday", "4 days ago", or a date. */
export function syncedAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Never synced';
  const then = new Date(iso);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return gbDate(then, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** For use mid-sentence: "5 hours ago", "yesterday", "on 28 Sept 2026", "never". */
export function syncedWhen(iso: string | null, now: Date = new Date()): string {
  const s = syncedAgo(iso, now);
  if (!iso) return 'never';
  return /^\d{1,2} \w+ \d{4}$/.test(s) ? `on ${s}` : s.charAt(0).toLowerCase() + s.slice(1);
}

/** Counts and the most recent sync across linked accounts. */
export function summarise(accounts: StatusAccount[]) {
  const linked = accounts.filter((a) => a.linked);
  const reconnect = linked.filter((a) => a.needsReconsent);
  const lastSyncAt = linked.reduce<string | null>(
    (latest, a) => (a.lastSyncAt && (!latest || a.lastSyncAt > latest) ? a.lastSyncAt : latest),
    null
  );
  return { linked: linked.length, reconnect: reconnect.length, unlinked: accounts.length - linked.length, lastSyncAt };
}
