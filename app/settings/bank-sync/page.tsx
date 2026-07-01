'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { SyncButton, AccountLinkPanel } from '@/components/enable-banking';

interface StatusAccount {
  id: string;
  name: string;
  type: string;
  linked: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  aspsp: string | null;
  sessionValid: boolean;
  sessionValidUntil: string | null;
  needsReconsent: boolean;
}

interface StatusResponse {
  configured: boolean;
  accounts: StatusAccount[];
}

interface LinkResponse {
  session: {
    id: string;
    aspsp: string | null;
    country: string | null;
    status: string;
    validUntil: string | null;
  };
  ebAccounts: Array<{
    uid: string;
    name: string;
    product: string | null;
    currency: string | null;
    iban: string | null;
  }>;
  financeAccounts: Array<{
    id: string;
    name: string;
    type: string;
    enable_banking_account_uid: string | null;
  }>;
}

interface SyncResultRow {
  accountId: string;
  accountName: string;
  imported: number;
  alreadyPresent: number;
  pendingSkipped: number;
  fetched: number;
  dateRange: { from: string; to: string };
  ebBalance: { amount: number; currency: string; type: string } | null;
  error?: string;
}

interface SyncTotals {
  imported: number;
  alreadyPresent: number;
  pendingSkipped: number;
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return 'Never synced';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return formatDate(dateString) || 'Unknown';
}

export default function BankSyncPage() {
  return (
    <Suspense
      fallback={
        <AppLayout title="Bank Sync">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        </AppLayout>
      }
    >
      <BankSyncPageContent />
    </Suspense>
  );
}

function BankSyncPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
      const response = await fetch('/api/enable-banking/status');
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
    const ebStatus = searchParams.get('status');

    if (ebStatus === 'error') {
      setUrlErrorMessage(searchParams.get('message') || 'Something went wrong connecting your bank account.');
      return;
    }

    if (ebStatus === 'linked') {
      const sessionRowId = searchParams.get('session');
      if (!sessionRowId) return;

      setLinkLoading(true);
      setLinkError(null);
      fetch(`/api/enable-banking/link?session=${encodeURIComponent(sessionRowId)}`)
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
      const response = await fetch('/api/enable-banking/auth/start', {
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
      const response = await fetch('/api/enable-banking/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financeAccountId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink account');
      }
      fetchStatus();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to unlink account');
    }
  };

  const handleSyncAll = async () => {
    setGlobalSyncLoading(true);
    setGlobalSyncError(null);
    setGlobalSyncResults(null);
    setGlobalSyncTotals(null);
    try {
      const response = await fetch('/api/enable-banking/sync', {
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

  return (
    <AppLayout title="Bank Sync">
      <div className="max-w-3xl mx-auto space-y-6">
        <p className="text-sm text-slate-500">
          Connect your bank via Open Banking (Enable Banking) to automatically import transactions.
        </p>

        {/* Not configured banner */}
        {!statusLoading && status && !status.configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-amber-800">Enable Banking is not configured</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Bank sync isn&apos;t set up for this app yet. Ask an admin to configure Enable Banking credentials.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* URL error banner (redirect from consent flow) */}
        {urlErrorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Couldn&apos;t connect your bank</h3>
                <p className="text-sm text-red-700 mt-1">{urlErrorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Connect action */}
        {status?.configured && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Connect a bank account</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Start a secure Open Banking connection with your bank (defaults to HSBC).
                </p>
              </div>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isConnecting && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {isConnecting ? 'Redirecting…' : 'Connect HSBC account'}
              </button>
            </div>
            {connectError && <p className="text-sm text-red-600 mt-3">{connectError}</p>}
          </div>
        )}

        {/* Account mapping panel, shown after returning from the consent flow */}
        {linkLoading && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" />
            <p className="text-sm text-slate-500">Loading accounts from your bank…</p>
          </div>
        )}
        {linkError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{linkError}</p>
          </div>
        )}
        {linkSuccessMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm text-emerald-800">{linkSuccessMessage}</p>
          </div>
        )}
        {linkData && (
          <AccountLinkPanel
            sessionRowId={linkData.session.id}
            aspsp={linkData.session.aspsp}
            ebAccounts={linkData.ebAccounts}
            financeAccounts={linkData.financeAccounts}
            onLinked={handleLinked}
          />
        )}

        {/* Sync all */}
        {status?.configured && linkedAccounts.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sync all accounts</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Fetch the latest transactions for every linked account.
                </p>
              </div>
              <button
                onClick={handleSyncAll}
                disabled={globalSyncLoading}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {globalSyncLoading && (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                )}
                {globalSyncLoading ? 'Syncing…' : 'Sync all now'}
              </button>
            </div>

            {globalSyncError && <p className="text-sm text-red-600 mt-3">{globalSyncError}</p>}

            {globalSyncTotals && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-700">
                  Imported <span className="font-semibold">{globalSyncTotals.imported}</span> ·{' '}
                  <span className="font-semibold">{globalSyncTotals.alreadyPresent}</span> already up to date
                  {globalSyncTotals.pendingSkipped > 0 && (
                    <>
                      {' '}
                      · <span className="font-semibold">{globalSyncTotals.pendingSkipped}</span> pending skipped
                    </>
                  )}
                </p>
                {globalSyncResults && globalSyncResults.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {globalSyncResults.map((r) => (
                      <li key={r.accountId} className="text-xs text-slate-600 flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-700">{r.accountName}</span>
                        {r.error ? (
                          <span className="text-red-600">{r.error}</span>
                        ) : (
                          <span>
                            {r.imported} imported · {r.alreadyPresent} already present
                            {r.pendingSkipped > 0 && ` · ${r.pendingSkipped} pending skipped`}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Account list */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Accounts</h2>

          {statusLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          )}

          {statusError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
              <p className="text-sm text-red-700">{statusError}</p>
            </div>
          )}

          {!statusLoading && !statusError && status && status.accounts.length === 0 && (
            <p className="text-sm text-slate-500">No accounts found.</p>
          )}

          {!statusLoading && !statusError && status && status.accounts.length > 0 && (
            <div className="space-y-3">
              {orderedAccounts.map((account) => (
                <div key={account.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                      {account.linked ? (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {account.aspsp || 'Linked'} · Last synced: {formatRelativeTime(account.lastSyncAt)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">Not linked</p>
                      )}
                      {account.linked && (
                        <p className="text-xs mt-1">
                          {account.needsReconsent ? (
                            <span className="text-red-600 font-medium">Consent expired — reconnect</span>
                          ) : (
                            <span className="text-emerald-700">
                              Consent valid until {formatDate(account.sessionValidUntil) || 'unknown'}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {account.linked && (
                      <div className="flex items-center gap-2">
                        <SyncButton
                          accountId={account.id}
                          label="Sync now"
                          className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        />
                        <button
                          onClick={() => handleUnlink(account.id)}
                          className="text-xs px-2.5 py-1.5 text-red-600 border border-red-200 rounded hover:bg-red-50"
                        >
                          Unlink
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
