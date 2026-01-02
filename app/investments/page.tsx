'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  InvestmentAccountList,
  AddAccountDialog,
  AddValuationDialog,
  ValuationHistory,
  BulkImportDialog,
} from '@/components/investments';
import {
  type InvestmentAccount,
  type InvestmentSummary,
  type InvestmentProvider,
  type InvestmentType,
  type ValuationWithChange,
  INVESTMENT_TYPE_LABELS,
} from '@/lib/types/investment';

export default function InvestmentsPage() {
  // State
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddValuation, setShowAddValuation] = useState<{ accountId: string; accountName: string } | null>(null);
  const [showHistory, setShowHistory] = useState<{ accountId: string; accountName: string } | null>(null);
  const [showBulkImport, setShowBulkImport] = useState<{ accountId: string; accountName: string } | null>(null);
  const [editingValuation, setEditingValuation] = useState<ValuationWithChange | null>(null);

  // Fetch data
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/investments');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAccounts(data.accounts);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/investments/summary');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSummary(data.summary);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchAccounts(), fetchSummary()]);
    setIsLoading(false);
  }, [fetchAccounts, fetchSummary]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Handlers
  const handleAddAccount = async (data: {
    name: string;
    investmentProvider: InvestmentProvider;
    investmentType: InvestmentType;
    accountReference?: string;
  }) => {
    const response = await fetch('/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create account');
    }

    await fetchAll();
  };

  const handleEditAccount = (account: InvestmentAccount) => {
    // For now, just show a simple edit - could expand to full dialog
    const newName = prompt('Edit account name:', account.name);
    if (newName && newName !== account.name) {
      fetch(`/api/investments/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      }).then(() => fetchAll());
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Delete this account and all its valuations?')) return;

    const response = await fetch(`/api/investments/${accountId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      await fetchAll();
    }
  };

  const handleAddValuation = async (data: { date: string; value: number; notes?: string }) => {
    if (!showAddValuation) return;

    const response = await fetch(`/api/investments/${showAddValuation.accountId}/valuations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add valuation');
    }

    await fetchAll();
  };

  const handleDeleteValuation = async (valuationId: string) => {
    if (!showHistory) return;

    const response = await fetch(
      `/api/investments/${showHistory.accountId}/valuations/${valuationId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error('Failed to delete valuation');
    }

    await fetchAll();
  };

  const handleEditValuation = (valuation: ValuationWithChange) => {
    // Simple inline edit
    const newValue = prompt('Edit value:', valuation.value.toString());
    if (newValue && showHistory) {
      const numericValue = parseFloat(newValue.replace(/[£,]/g, ''));
      if (!isNaN(numericValue) && numericValue > 0) {
        fetch(`/api/investments/${showHistory.accountId}/valuations/${valuation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: numericValue }),
        }).then(() => {
          fetchAll();
          // Refresh history view
          setShowHistory({ ...showHistory });
        });
      }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investments</h1>
          <p className="text-gray-500">Track your investment portfolio valuations</p>
        </div>
        <button
          onClick={() => setShowAddAccount(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {/* Summary Cards */}
      {summary && summary.accountCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Total Value</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.totalValue)}
            </p>
          </div>

          {/* By Type */}
          {summary.byType.slice(0, 3).map((item) => (
            <div
              key={item.type}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500 mb-1">{item.label}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(item.value)}
              </p>
              <p className="text-xs text-gray-400">
                {item.count} account{item.count !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Account List */}
      <InvestmentAccountList
        accounts={accounts}
        isLoading={isLoading}
        onAddValuation={(accountId) => {
          const account = accounts.find((a) => a.id === accountId);
          if (account) {
            setShowAddValuation({ accountId, accountName: account.name });
          }
        }}
        onViewHistory={(accountId) => {
          const account = accounts.find((a) => a.id === accountId);
          if (account) {
            setShowHistory({ accountId, accountName: account.name });
          }
        }}
        onEdit={handleEditAccount}
        onDelete={handleDeleteAccount}
        onAddAccount={() => setShowAddAccount(true)}
      />

      {/* Dialogs */}
      <AddAccountDialog
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSubmit={handleAddAccount}
      />

      {showAddValuation && (
        <AddValuationDialog
          isOpen={true}
          accountId={showAddValuation.accountId}
          accountName={showAddValuation.accountName}
          onClose={() => setShowAddValuation(null)}
          onSubmit={handleAddValuation}
        />
      )}

      {showHistory && (
        <ValuationHistory
          isOpen={true}
          accountId={showHistory.accountId}
          accountName={showHistory.accountName}
          onClose={() => setShowHistory(null)}
          onEdit={handleEditValuation}
          onDelete={handleDeleteValuation}
          onBulkImport={() => {
            setShowBulkImport({
              accountId: showHistory.accountId,
              accountName: showHistory.accountName,
            });
          }}
        />
      )}

      {showBulkImport && (
        <BulkImportDialog
          isOpen={true}
          accountId={showBulkImport.accountId}
          accountName={showBulkImport.accountName}
          onClose={() => setShowBulkImport(null)}
          onSuccess={() => {
            fetchAll();
            // Refresh history if open
            if (showHistory) {
              setShowHistory({ ...showHistory });
            }
          }}
        />
      )}
    </div>
  );
}
