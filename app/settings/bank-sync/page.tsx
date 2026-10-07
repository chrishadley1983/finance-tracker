'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { SyncButton, AccountLinkPanel } from '@/components/bank-sync';
import { linkState, summarise, syncedWhen, type StatusAccount, type StatusResponse } from '@/components/bank-sync/status';
import { PageIntro } from '@/components/ui/PageIntro';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice, EmptyState, SkeletonRows } from '@/components/ui/Notice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface LinkResponse {
  connection: {
    id: string;
    provider: string | null;
    status: string;
  };
  tlAccounts: Array<{
    uid: string;
    name: string;
    kind: 'account' | 'card';
    currency: string | null;
    detail: string | null;
  }>;
  financeAccounts: Array<{
    id: string;
    name: string;
    type: string;
    truelayer_account_id: string | null;
  }>;
}

interface SyncResultRow {
  accountId: string;
  accountName: string;
  imported: number;
  alreadyPresent: number;
  fetched: number;
  dateRange: { from: string; to: string };
  balance: { available: number; current: number; currency: string } | null;
  error?: string;
}

interface SyncTotals {
  imported: number;
  alreadyPresent: number;
}

const syncButtonClass =
  'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

export default function BankSyncPage() {
  return (
    <AppLayout title="Bank sync">
      <Suspense fallback={<SkeletonRows rows={5} />}>
        <BankSyncPageContent />
      </Suspense>
    </AppLayout>
  );
}

function BankSyncPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [unlinking, setUnlinking] = useState<StatusAccount | null>(null);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [linkData, setLinkData] = useState<LinkResponse | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccessMessage, setLinkSuccessMessage] = useState<string | null>(null);

  const [urlErrorMessage, setUrlErrorMessage] = useState<string | null>(null);

  const [globalSyncLoading, setGlobalSyncLoading] = useState(false);
  const [globalSyncError, setGlobalSyncError] = useState<string | null>(null);
  const [globalSyncResults, setGlobalSyncResults] = useState<SyncResultRow[] | null>(null);
  const [globalSyncTotals, setGlobalSyncTotals] = useState<SyncTotals | null>(null);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const response = await fetch('/api/truelayer/status');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load bank sync status');
      }
      setStatus(data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to load bank sync status');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle redirect back from the bank consent flow.
  useEffect(() => {
    const tlStatus = searchParams.get('status');

    if (tlStatus === 'error') {
      setUrlErrorMessage(searchParams.get('message') || 'Something went wrong connecting your bank account.');
      return;
    }

    if (tlStatus === 'linked') {
      const connectionRowId = searchParams.get('connection');
      if (!connectionRowId) return;

      setLinkLoading(true);
      setLinkError(null);
      fetch(`/api/truelayer/link?connection=${encodeURIComponent(connectionRowId)}`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.error || 'Failed to load account mapping');
          }
          setLinkData(data);
        })
        .catch((err) => {
          setLinkError(err instanceof Error ? err.message : 'Failed to load account mapping');
        })
        .finally(() => {
          setLinkLoading(false);
        });
    }
  }, [searchParams]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const response = await fetch('/api/truelayer/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start bank connection');
      }
      window.location.href = data.url;
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to start bank connection');
      setIsConnecting(false);
    }
  };

  // Called after each successful link. The mapping panel keeps its own
  // already-fetched data in memory, so clearing the URL params here doesn't
  // stop further mappings from working.
  const handleLinked = useCallback(() => {
    setLinkSuccessMessage('Account linked successfully.');
    fetchStatus();
    router.replace('/settings/bank-sync');
  }, [fetchStatus, router]);

  const handleUnlink = async (financeAccountId: string) => {
    try {
      const response = await fetch('/api/truelayer/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financeAccountId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink account');
      }
      fetchStatus();
      toast({ message: 'Account unlinked' });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Failed to unlink account', tone: 'error' });
    }
  };

  const handleSyncAll = async () => {
    setGlobalSyncLoading(true);
    setGlobalSyncError(null);
    setGlobalSyncResults(null);
    setGlobalSyncTotals(null);
    try {
      const response = await fetch('/api/truelayer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }
      setGlobalSyncTotals(data.totals);
      setGlobalSyncResults(data.results);
      fetchStatus();
    } catch (err) {
      setGlobalSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setGlobalSyncLoading(false);
    }
  };

  const linkedAccounts = status?.accounts.filter((a) => a.linked) ?? [];
  const unlinkedAccounts = status?.accounts.filter((a) => !a.linked) ?? [];
  const orderedAccounts = [...linkedAccounts, ...unlinkedAccounts];
  const summary = summarise(status?.accounts ?? []);
  const providers = Array.from(new Set(linkedAccounts.map((a) => a.provider).filter(Boolean))) as string[];

  const intro = statusLoading && !status ? (
    'Checking your bank connections...'
  ) : !status ? (
    'Connect your bank through Open Banking (TrueLayer) to bring in transactions automatically.'
  ) : summary.linked === 0 ? (
    'No accounts are linked yet. Connect your bank through Open Banking (TrueLayer) to bring in transactions automatically.'
  ) : (
    <>
      <strong className="fig">{summary.linked}</strong> of {status.accounts.length} accounts linked
      {providers.length > 0 ? ` to ${providers.join(' and ')}` : ''}.{' '}
      {summary.lastSyncAt ? `Last synced ${syncedWhen(summary.lastSyncAt)}.` : 'Not synced yet.'}
      {summary.reconnect > 0 && (
        <>
          {' '}
          <strong>{summary.reconnect}</strong> {summary.reconnect === 1 ? 'needs' : 'need'} reconnecting.
        </>
      )}
    </>
  );

  return (
    <div className="grid max-w-3xl gap-6">
      <PageIntro
        actions={
          status?.configured ? (
            <>
              {linkedAccounts.length > 0 && (
                <Button onClick={handleSyncAll} loading={globalSyncLoading}>
                  {globalSyncLoading ? 'Syncing...' : 'Sync all now'}
                </Button>
              )}
              <Button variant={linkedAccounts.length > 0 ? 'secondary' : 'primary'} onClick={handleConnect} loading={isConnecting}>
                {isConnecting ? 'Redirecting...' : linkedAccounts.length > 0 ? 'Connect another bank' : 'Connect a bank'}
              </Button>
            </>
          ) : undefined
        }
      >
        {intro}
      </PageIntro>

      {!statusLoading && status && !status.configured && (
        <Notice tone="warn">
          <p className="font-medium">Bank sync isn&apos;t set up</p>
          <p className="mt-0.5">TrueLayer credentials are missing for this app. You can still import statements from the Import page.</p>
        </Notice>
      )}

      {urlErrorMessage && (
        <Notice tone="error">
          <p className="font-medium">Couldn&apos;t connect your bank</p>
          <p className="mt-0.5">{urlErrorMessage}</p>
        </Notice>
      )}

      {connectError && <Notice tone="error">{connectError}</Notice>}

      {status?.configured && summary.reconnect > 0 && (
        <Notice
          tone="warn"
          action={
            <Button size="sm" onClick={handleConnect} loading={isConnecting}>
              Reconnect
            </Button>
          }
        >
          <p className="font-medium">
            {summary.reconnect === 1 ? 'One account needs' : `${summary.reconnect} accounts need`} reconnecting
          </p>
          <p className="mt-0.5">Bank consent runs out every 90 days. Reconnect to keep transactions syncing.</p>
        </Notice>
      )}

      {/* Account mapping panel, shown after returning from the consent flow */}
      {linkLoading && (
        <div className="grid gap-2" role="status">
          <p className="text-sm text-ink-2">Loading accounts from your bank...</p>
          <SkeletonRows rows={2} />
        </div>
      )}
      {linkError && <Notice tone="error">{linkError}</Notice>}
      {linkSuccessMessage && <Notice tone="success">{linkSuccessMessage}</Notice>}
      {linkData && (
        <AccountLinkPanel
          connectionRowId={linkData.connection.id}
          provider={linkData.connection.provider}
          tlAccounts={linkData.tlAccounts}
          financeAccounts={linkData.financeAccounts}
          onLinked={handleLinked}
        />
      )}

      {globalSyncError && <Notice tone="error">{globalSyncError}</Notice>}
      {globalSyncTotals && (
        <Notice tone="success">
          <p>
            Imported <span className="fig font-semibold">{globalSyncTotals.imported}</span>,{' '}
            <span className="fig">{globalSyncTotals.alreadyPresent}</span> already up to date.
          </p>
          {globalSyncResults && globalSyncResults.length > 0 && (
            <ul className="mt-1.5 grid gap-0.5 text-ink-2">
              {globalSyncResults.map((r) => (
                <li key={r.accountId} className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-ink">{r.accountName}</span>
                  {r.error ? (
                    <span className="text-bad">{r.error}</span>
                  ) : (
                    <span>
                      <span className="fig">{r.imported}</span> imported, <span className="fig">{r.alreadyPresent}</span> already there
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      <Panel title="Accounts" action={status ? `${summary.linked} linked` : undefined}>
        {statusLoading && !status ? (
          <SkeletonRows rows={4} />
        ) : statusError ? (
          <Notice tone="error" action={<Button size="sm" onClick={fetchStatus}>Try again</Button>}>
            {statusError}
          </Notice>
        ) : status && status.accounts.length === 0 ? (
          <EmptyState title="No accounts yet">Add your accounts on the Accounts page, then link them here.</EmptyState>
        ) : (
          <ul className={statusLoading ? 'opacity-60' : ''}>
            {orderedAccounts.map((account) => {
              const state = linkState(account);
              return (
                <li
                  key={account.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line-2 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium text-ink">{account.name}</span>
                      {/* Only problems get a chip; a working link is plain text below. */}
                      {state === 'reconnect' && <Chip tone="warn">Needs reconnecting</Chip>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {account.linked ? (
                        <>
                          {account.provider || 'Linked'} · {account.lastSyncAt ? `synced ${syncedWhen(account.lastSyncAt)}` : 'never synced'}
                        </>
                      ) : (
                        <>
                          Not linked · <span className="capitalize">{account.type}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {account.linked && (
                    <div className="flex items-start justify-end gap-1.5">
                      {state === 'reconnect' ? (
                        <Button size="sm" onClick={handleConnect} disabled={isConnecting}>
                          Reconnect
                        </Button>
                      ) : (
                        <SyncButton accountId={account.id} label="Sync now" className={syncButtonClass} onDone={() => fetchStatus()} />
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setUnlinking(account)}>
                        Unlink
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {unlinking && (
        <ConfirmDialog
          isOpen
          title={`Unlink ${unlinking.name}?`}
          message="New transactions will stop syncing for this account. Transactions already imported stay where they are. You can link it again at any time."
          confirmLabel="Unlink"
          variant="danger"
          onConfirm={() => {
            const a = unlinking;
            setUnlinking(null);
            handleUnlink(a.id);
          }}
          onCancel={() => setUnlinking(null)}
        />
      )}
    </div>
  );
}
