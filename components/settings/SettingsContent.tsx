'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { PageIntro } from '@/components/ui/PageIntro';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, Input } from '@/components/ui/Field';
import { Notice, SkeletonRows } from '@/components/ui/Notice';
import { formatDateGB, MONTH_SHORT } from '@/lib/format';
import { ThemeSelector } from './ThemeSelector';
import { summarise, syncedWhen, type StatusResponse } from '@/components/bank-sync/status';

interface SettingsStats {
  counts: Record<'transactions' | 'accounts' | 'categories' | 'rules' | 'budgets' | 'snapshots' | 'subscriptions', number>;
  transactions: { first: string | null; last: string | null };
  about: { version: string; commit: string | null; environment: string | null };
}

const DATA_ROWS: { key: keyof SettingsStats['counts']; label: string; href: string }[] = [
  { key: 'transactions', label: 'Transactions', href: '/transactions' },
  { key: 'accounts', label: 'Accounts', href: '/accounts' },
  { key: 'categories', label: 'Categories', href: '/categories' },
  { key: 'rules', label: 'Category rules', href: '/categories' },
  { key: 'budgets', label: 'Budget lines', href: '/budgets' },
  { key: 'snapshots', label: 'Balance snapshots', href: '/wealth' },
  { key: 'subscriptions', label: 'Subscriptions', href: '/subscriptions' },
];

/** Secondary-button look for links (downloads and navigation). */
const linkButton =
  'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line bg-surface px-3.5 text-sm text-ink hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const n = (v: number) => v.toLocaleString('en-GB');
const monthYear = (iso: string) => {
  const [y, m] = iso.split('-');
  return `${MONTH_SHORT[Number(m) - 1]} ${y}`;
};

function useJson<T>(url: string, errorText: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || errorText);
      setData(body as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorText);
    } finally {
      setLoading(false);
    }
  }, [url, errorText]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, loading, reload: load };
}

export function SettingsContent() {
  const stats = useJson<SettingsStats>('/api/settings/stats', 'Could not load your data counts');
  const bank = useJson<StatusResponse>('/api/truelayer/status', 'Could not load bank connections');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rangeError = from && to && from > to ? 'The start date is after the end date.' : null;
  const csvHref = (() => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const s = qs.toString();
    return `/api/export/transactions.csv${s ? `?${s}` : ''}`;
  })();

  const s = stats.data;
  const span = s?.transactions.first && s.transactions.last ? `${monthYear(s.transactions.first)} to ${monthYear(s.transactions.last)}` : null;

  return (
    <div className="grid max-w-3xl gap-8">
      <PageIntro>
        {s ? (
          <>
            Your data covers <strong className="fig">{n(s.counts.transactions)}</strong> transactions across{' '}
            <strong className="fig">{n(s.counts.accounts)}</strong> accounts{span ? `, ${span}` : ''}. Theme, exports and bank
            connections are below.
          </>
        ) : (
          'Theme, your data, exports and bank connections.'
        )}
      </PageIntro>

      <Panel title="Appearance" action="Saved on this device">
        <div className="max-w-md">
          <ThemeSelector />
        </div>
      </Panel>

      <Panel title="Data">
        {stats.loading && !s ? (
          <SkeletonRows rows={4} />
        ) : stats.error ? (
          <Notice tone="error" action={<Button size="sm" onClick={stats.reload}>Try again</Button>}>
            {stats.error}.
          </Notice>
        ) : s ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
            {DATA_ROWS.map((row) => (
              <div key={row.key} className="flex items-baseline justify-between gap-3 border-b border-line-2 py-2 text-sm">
                <dt>
                  <Link href={row.href} className="text-ink-2 hover:text-ink hover:underline">
                    {row.label}
                  </Link>
                </dt>
                <dd className="fig text-ink">{n(s.counts[row.key])}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Panel>

      <Panel title="Export">
        <div className="grid gap-5">
          <div className="grid gap-3">
            <p className="text-sm text-ink-2">
              Transactions as a spreadsheet (CSV). Leave the dates empty to include everything.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <Field label="From" htmlFor="export-from">
                <Input id="export-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To" htmlFor="export-to">
                <Input id="export-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            {rangeError && <p className="text-xs text-bad">{rangeError}</p>}
            <div>
              {rangeError ? (
                <Button disabled>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download transactions CSV
                </Button>
              ) : (
                <a href={csvHref} download className={linkButton}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download transactions CSV
                </a>
              )}
            </div>
          </div>
          <div className="grid gap-3 border-t border-line-2 pt-5">
            <p className="text-sm text-ink-2">
              Everything as one JSON file: accounts, categories, rules, budgets, transactions, balances, subscriptions, notes
              and FIRE settings. Bank connection tokens are not included.
            </p>
            <div>
              <a href="/api/export/all.json" download className={linkButton}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download all data (JSON)
              </a>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Bank connections" action={<Link href="/settings/bank-sync" className="hover:text-ink hover:underline">Manage bank sync</Link>}>
        <BankSummary {...bank} />
      </Panel>

      <Panel title="About">
        {s ? (
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-3">
              <dt className="w-24 text-ink-3">Version</dt>
              <dd className="fig text-ink">{s.about.version}</dd>
            </div>
            {s.about.commit && (
              <div className="flex gap-3">
                <dt className="w-24 text-ink-3">Build</dt>
                <dd className="fig text-ink">{s.about.commit}</dd>
              </div>
            )}
            {s.about.environment && (
              <div className="flex gap-3">
                <dt className="w-24 text-ink-3">Environment</dt>
                <dd className="text-ink">{s.about.environment}</dd>
              </div>
            )}
            {s.transactions.last && (
              <div className="flex gap-3">
                <dt className="w-24 text-ink-3">Latest data</dt>
                <dd className="text-ink">{formatDateGB(s.transactions.last)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-ink-3">Hadley Finance Tracker</p>
        )}
      </Panel>
    </div>
  );
}

function BankSummary({ data, error, loading, reload }: ReturnType<typeof useJson<StatusResponse>>) {
  if (loading && !data) return <SkeletonRows rows={2} />;
  if (error) {
    return (
      <Notice tone="error" action={<Button size="sm" onClick={reload}>Try again</Button>}>
        {error}.
      </Notice>
    );
  }
  if (!data) return null;
  if (!data.configured) {
    return <p className="text-sm text-ink-2">Bank sync is not set up for this app yet. Transactions can still be imported from files.</p>;
  }
  const sum = summarise(data.accounts);
  if (sum.linked === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">No accounts are linked to your bank yet.</p>
        <Link href="/settings/bank-sync" className={linkButton}>
          Connect a bank
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-2">
        <span className="fig text-ink">{sum.linked}</span> of {data.accounts.length} accounts linked.{' '}
        {sum.lastSyncAt ? `Last synced ${syncedWhen(sum.lastSyncAt)}.` : 'Not synced yet.'}
      </p>
      {/* Normal states are plain text; only a problem gets a chip. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-ink-3">
        <span>{`${sum.linked - sum.reconnect} connected`}</span>
        {sum.unlinked > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{`${sum.unlinked} not linked`}</span>
          </>
        )}
        {sum.reconnect > 0 && <Chip tone="warn">{sum.reconnect} {sum.reconnect === 1 ? 'needs' : 'need'} reconnecting</Chip>}
      </div>
      {sum.reconnect > 0 && (
        <Notice tone="warn" action={<Link href="/settings/bank-sync" className="font-medium underline">Reconnect</Link>}>
          Your bank needs you to renew consent before new transactions can sync.
        </Notice>
      )}
    </div>
  );
}
