'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AccountWithStats, Account, AccountType, CreateAccountInput, UpdateAccountInput } from '@/lib/types/account';
import {
  AccountFilters,
  AccountList,
  AccountDialog,
  DeleteAccountDialog,
  ReallocateDialog,
} from '@/components/accounts';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithStats | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountWithStats | null>(null);
  const [reallocatingAccount, setReallocatingAccount] = useState<AccountWithStats | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL('/api/accounts', window.location.origin);
      if (showArchived) {
        url.searchParams.set('includeArchived', 'true');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = account.name.toLowerCase().includes(query);
        const matchesProvider = account.provider?.toLowerCase().includes(query);
        if (!matchesName && !matchesProvider) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && account.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [accounts, searchQuery, typeFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const activeAccounts = accounts.filter((a) => !a.is_archived);
    const totalBalance = activeAccounts
      .filter((a) => a.include_in_net_worth)
      .reduce((sum, a) => sum + a.currentBalance, 0);
    const totalTransactions = activeAccounts.reduce((sum, a) => sum + a.transactionCount, 0);

    return {
      totalAccounts: activeAccounts.length,
      archivedAccounts: accounts.length - activeAccounts.length,
      totalBalance,
      totalTransactions,
    };
  }, [accounts]);

  // Handlers
  const handleCreateAccount = async (data: CreateAccountInput | UpdateAccountInput) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create account');
      }

      await fetchAccounts();
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAccount = async (data: CreateAccountInput | UpdateAccountInput) => {
    if (!editingAccount) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/accounts/${editingAccount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update account');
      }

      await fetchAccounts();
      setEditingAccount(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (force: boolean) => {
    if (!deletingAccount) return;

    setIsSaving(true);
    try {
      const url = new URL(`/api/accounts/${deletingAccount.id}`, window.location.origin);
      if (force) {
        url.searchParams.set('force', 'true');
      }

      const response = await fetch(url, { method: 'DELETE' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }

      await fetchAccounts();
      setDeletingAccount(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReallocate = async (targetAccountId: string) => {
    if (!reallocatingAccount) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/accounts/${reallocatingAccount.id}/reallocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAccountId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to move transactions');
      }

      await fetchAccounts();
      setReallocatingAccount(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async (account: AccountWithStats) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: !account.is_archived }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update account');
      }

      await fetchAccounts();
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        <p className="text-gray-600 mt-1">Manage your financial accounts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Active Accounts</div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalAccounts}</div>
          {stats.archivedAccounts > 0 && (
            <div className="text-xs text-gray-400">{stats.archivedAccounts} archived</div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Net Worth</div>
          <div className={`text-2xl font-bold ${stats.totalBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {formatCurrency(stats.totalBalance)}
          </div>
          <div className="text-xs text-gray-400">Included in net worth</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Transactions</div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.totalTransactions.toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Showing</div>
          <div className="text-2xl font-bold text-gray-900">{filteredAccounts.length}</div>
          <div className="text-xs text-gray-400">
            of {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={fetchAccounts}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <AccountFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
          onAddAccount={() => setIsAddDialogOpen(true)}
        />
      </div>

      {/* Account List */}
      <AccountList
        accounts={filteredAccounts}
        onEdit={setEditingAccount}
        onDelete={setDeletingAccount}
        onReallocate={setReallocatingAccount}
        onArchiveToggle={handleArchiveToggle}
        isLoading={isLoading}
      />

      {/* Add Account Dialog */}
      <AccountDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSave={handleCreateAccount}
        isLoading={isSaving}
      />

      {/* Edit Account Dialog */}
      <AccountDialog
        open={!!editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        account={editingAccount}
        onSave={handleUpdateAccount}
        isLoading={isSaving}
      />

      {/* Delete Account Dialog */}
      {deletingAccount && (
        <DeleteAccountDialog
          open={!!deletingAccount}
          onOpenChange={(open) => !open && setDeletingAccount(null)}
          account={deletingAccount}
          onConfirm={handleDeleteAccount}
          onReallocate={() => {
            setDeletingAccount(null);
            setReallocatingAccount(deletingAccount);
          }}
          isLoading={isSaving}
        />
      )}

      {/* Reallocate Dialog */}
      {reallocatingAccount && (
        <ReallocateDialog
          open={!!reallocatingAccount}
          onOpenChange={(open) => !open && setReallocatingAccount(null)}
          sourceAccount={reallocatingAccount}
          availableAccounts={accounts as Account[]}
          onConfirm={handleReallocate}
          isLoading={isSaving}
        />
      )}
    </div>
  );
}
