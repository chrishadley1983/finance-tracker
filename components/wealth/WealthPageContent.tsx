'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Tabs, useUrlTab, type TabDef } from '@/components/ui/Tabs';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import type { NetWorthHistory, NetWorthSummary as NetWorthSummaryType } from '@/lib/types/fire';
import { NetWorthSummary } from './NetWorthSummary';
import { NetWorthChart } from './NetWorthChart';
import { AccountBalances } from './AccountBalances';
import { CoastFireCard } from './CoastFireCard';
import { MonthlySnapshotForm } from './MonthlySnapshotForm';
import { SnapshotHistoryTable } from './SnapshotHistoryTable';
import { monthKey, monthLabel, parseMonthParam } from './net-worth-helpers';

export type WealthTab = 'overview' | 'balances' | 'history';

export const WEALTH_TABS: readonly TabDef<WealthTab>[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'balances', label: 'Monthly balances' },
  { id: 'history', label: 'History' },
];

async function getJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? `${body.error}.` : `The server couldn't load ${what}.`);
  }
  return res.json();
}

/** Keeps a tab mounted once it has been opened, so switching back doesn't refetch or flicker. */
function TabPanel({ id, active, visited, children }: { id: WealthTab; active: boolean; visited: boolean; children: ReactNode }) {
  if (!visited) return null;
  return (
    <div role="tabpanel" id={`wealth-panel-${id}`} aria-label={WEALTH_TABS.find((t) => t.id === id)?.label} hidden={!active}>
      {children}
    </div>
  );
}

export function WealthPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tab, setTab] = useUrlTab(WEALTH_TABS, 'overview');
  const month = parseMonthParam(params?.get('month'));

  const [visited, setVisited] = useState<Set<WealthTab>>(() => new Set([tab]));
  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab)));
  }, [tab]);

  const [summary, setSummary] = useState<NetWorthSummaryType | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [history, setHistory] = useState<NetWorthHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  // Bumped when balances change, so other mounted tabs refetch.
  const [keys, setKeys] = useState({ coast: 0, balances: 0, history: 0 });

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(await getJson<NetWorthSummaryType>('/api/wealth/net-worth', 'your net worth'));
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      // One fetch of everything; the chart's period buttons filter it locally.
      setHistory(await getJson<NetWorthHistory>('/api/wealth/history?period=all', 'your history'));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadHistory();
  }, [loadSummary, loadHistory]);

  /** Balances changed on one tab: refresh everything else that shows them. */
  const balancesChanged = useCallback(
    (from: 'balances' | 'history') => {
      loadSummary();
      loadHistory();
      setKeys((k) => ({
        coast: k.coast + 1,
        balances: from === 'balances' ? k.balances : k.balances + 1,
        history: from === 'history' ? k.history : k.history + 1,
      }));
    },
    [loadSummary, loadHistory]
  );

  const setMonth = useCallback(
    (m: string) => {
      const next = new URLSearchParams(params?.toString() ?? '');
      next.set('tab', 'balances');
      next.set('month', m);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  const monthHref = useCallback((m: string) => (m ? `${pathname}?tab=balances&month=${m}` : `${pathname}?tab=balances`), [pathname]);

  return (
    <div className="grid gap-5 pb-6">
      <Tabs tabs={WEALTH_TABS} active={tab} onChange={setTab} label="Net worth views" />

      <TabPanel id="overview" active={tab === 'overview'} visited={visited.has('overview')}>
        <div className="grid gap-8">
          {summaryError ? (
            <Notice tone="error" action={<Button size="sm" onClick={loadSummary}>Try again</Button>}>
              Couldn&apos;t load your net worth. {summaryError}
            </Notice>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <NetWorthSummary data={summary} history={history?.snapshots ?? []} isLoading={summaryLoading} />
              <Link href={monthHref('')} className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm text-ink hover:bg-sunk">
                Enter {monthLabel(monthKey(new Date())).split(' ')[0]}&apos;s balances
              </Link>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <NetWorthChart history={history?.snapshots ?? null} isLoading={historyLoading} error={historyError} onRetry={loadHistory} />

            <div className="grid content-start gap-8">
              <Panel title="By account type" action={<span>largest first</span>}>
                <AccountBalances data={summary} isLoading={summaryLoading} />
              </Panel>
              <Panel title="Coast FIRE">
                <CoastFireCard refreshKey={keys.coast} />
              </Panel>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel id="balances" active={tab === 'balances'} visited={visited.has('balances')}>
        <MonthlySnapshotForm month={month} onMonthChange={setMonth} refreshKey={keys.balances} onSaveComplete={() => balancesChanged('balances')} />
      </TabPanel>

      <TabPanel id="history" active={tab === 'history'} visited={visited.has('history')}>
        <SnapshotHistoryTable refreshKey={keys.history} onChange={() => balancesChanged('history')} monthHref={monthHref} />
      </TabPanel>
    </div>
  );
}
