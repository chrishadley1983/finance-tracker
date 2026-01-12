'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface WealthSnapshot {
  id: string;
  date: string;
  balance: number;
  notes: string | null;
}

interface WealthSnapshotModalProps {
  isOpen: boolean;
  accountId: string;
  accountName: string;
  accountType: string;
  onClose: () => void;
  onUpdate?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function WealthSnapshotModal({
  isOpen,
  accountId,
  accountName,
  accountType,
  onClose,
  onUpdate,
}: WealthSnapshotModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [snapshots, setSnapshots] = useState<WealthSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newBalance, setNewBalance] = useState('');

  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch snapshots for the last 2 years
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const fromDate = twoYearsAgo.toISOString().split('T')[0];

      const response = await fetch(
        `/api/accounts/${accountId}/snapshots?from=${fromDate}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch snapshots');
      }
      const data = await response.json();
      setSnapshots(data.snapshots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
    }
  }, [isOpen, fetchSnapshots]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  const handleStartEdit = (snapshot: WealthSnapshot) => {
    setEditingId(snapshot.id);
    setEditValue(snapshot.balance.toString());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleSaveEdit = async (snapshotId: string) => {
    const newBalance = parseFloat(editValue);
    if (isNaN(newBalance)) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/snapshots/${snapshotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBalance }),
      });

      if (!response.ok) {
        throw new Error('Failed to update snapshot');
      }

      // Update local state
      setSnapshots((prev) =>
        prev.map((s) =>
          s.id === snapshotId ? { ...s, balance: newBalance } : s
        )
      );
      setEditingId(null);
      setEditValue('');
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/snapshots/${snapshotId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete snapshot');
      }

      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSnapshot = async () => {
    if (!newDate || !newBalance) return;

    const balance = parseFloat(newBalance);
    if (isNaN(balance)) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, balance }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add snapshot');
      }

      const data = await response.json();
      setSnapshots((prev) => [...prev, data.snapshot].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      setIsAdding(false);
      setNewDate('');
      setNewBalance('');
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add snapshot');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Prepare chart data (sorted ascending for chart)
  const chartData = [...snapshots]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((s) => ({
      date: s.date,
      formattedDate: formatChartDate(s.date),
      balance: s.balance,
    }));

  const typeLabel = {
    pension: 'Pension',
    investment: 'Investment',
    isa: 'ISA',
    property: 'Property',
  }[accountType] || 'Account';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-modal-title"
        tabIndex={-1}
        className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden focus:outline-none flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2
              id="snapshot-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              {accountName}
            </h2>
            <p className="text-sm text-gray-500">{typeLabel} Value History</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse text-gray-400">Loading...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <>
              {/* Chart */}
              {chartData.length > 1 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Value Over Time</h3>
                  <div className="h-48 bg-gray-50 rounded-lg p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="formattedDate"
                          stroke="#9ca3af"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={11}
                          tickLine={false}
                          tickFormatter={(value) =>
                            value >= 1000 ? `£${(value / 1000).toFixed(0)}k` : `£${value}`
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                          formatter={(value) => [formatCurrency(Number(value)), 'Value']}
                          labelFormatter={(label) => String(label)}
                        />
                        <Line
                          type="monotone"
                          dataKey="balance"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
                          activeDot={{ r: 5, fill: '#10b981' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Snapshots Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Valuations</h3>
                  <button
                    onClick={() => setIsAdding(true)}
                    disabled={isAdding}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                  >
                    + Add Valuation
                  </button>
                </div>

                {/* Add form */}
                {isAdding && (
                  <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex items-center">
                        <span className="text-gray-500 mr-1">£</span>
                        <input
                          type="number"
                          step="0.01"
                          value={newBalance}
                          onChange={(e) => setNewBalance(e.target.value)}
                          placeholder="0.00"
                          className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        onClick={handleAddSnapshot}
                        disabled={isSaving || !newDate || !newBalance}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsAdding(false);
                          setNewDate('');
                          setNewBalance('');
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {snapshots.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No valuations recorded. Add a valuation to track this account&apos;s value over time.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {snapshots.map((snapshot) => (
                          <tr key={snapshot.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-sm text-gray-900">
                              {formatDate(snapshot.date)}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right">
                              {editingId === snapshot.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-gray-500">£</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-28 px-2 py-1 text-sm border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit(snapshot.id);
                                      if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                  />
                                </div>
                              ) : (
                                <span className={snapshot.balance >= 0 ? 'text-gray-900' : 'text-red-600'}>
                                  {formatCurrency(snapshot.balance)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {editingId === snapshot.id ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleSaveEdit(snapshot.id)}
                                    disabled={isSaving}
                                    className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                                    title="Save"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                    title="Cancel"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleStartEdit(snapshot)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(snapshot.id)}
                                    className="p-1 text-gray-400 hover:text-red-600"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
