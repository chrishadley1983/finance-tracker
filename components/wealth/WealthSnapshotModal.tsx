'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateGB, formatGBP, formatGBPCompact, gbDate } from '@/lib/format';
import { axisProps, chart, gridProps, tooltipProps } from '@/lib/chart-theme';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { EmptyState, Notice, SkeletonRows } from '@/components/ui/Notice';

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

function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr);
  return gbDate(date, { month: 'short', year: '2-digit' });
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<WealthSnapshot | null>(null);

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
        throw new Error('Couldn’t load the valuations for this account.');
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
      // While the delete confirmation is open, Esc closes that instead.
      if (e.key === 'Escape' && !confirmDelete) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, confirmDelete]);

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
    setActionError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}/snapshots/${snapshotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBalance }),
      });

      if (!response.ok) {
        throw new Error('The change wasn’t saved. Try again.');
      }

      setSnapshots((prev) => prev.map((s) => (s.id === snapshotId ? { ...s, balance: newBalance } : s)));
      setEditingId(null);
      setEditValue('');
      onUpdate?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The change wasn’t saved. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    setIsSaving(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}/snapshots/${snapshotId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('The valuation wasn’t deleted. Try again.');
      }

      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      onUpdate?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The valuation wasn’t deleted. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSnapshot = async () => {
    if (!newDate || !newBalance) return;

    const balance = parseFloat(newBalance);
    if (isNaN(balance)) return;

    setIsSaving(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, balance }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'The valuation wasn’t added. Try again.');
      }

      const data = await response.json();
      setSnapshots((prev) => [...prev, data.snapshot].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setIsAdding(false);
      setNewDate('');
      setNewBalance('');
      onUpdate?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The valuation wasn’t added. Try again.');
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

  const typeLabel =
    {
      pension: 'Pension',
      investment: 'Investment',
      isa: 'ISA',
      property: 'Property',
    }[accountType] || 'Account';

  const iconButton = 'rounded-md p-1 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-modal-title"
        tabIndex={-1}
        className="relative mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-line bg-surface shadow-xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line-2 px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="snapshot-modal-title" className="truncate text-[15px] font-semibold text-ink">
              {accountName}
            </h2>
            <p className="text-[13px] text-ink-3">{typeLabel} valuations</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <SkeletonRows rows={6} />
          ) : error ? (
            <Notice tone="error" action={<Button size="sm" onClick={fetchSnapshots}>Try again</Button>}>
              {error}
            </Notice>
          ) : (
            <div className="grid gap-5">
              {actionError && <Notice tone="error">{actionError}</Notice>}

              {chartData.length > 1 && (
                <section>
                  <h3 className="mb-2 text-[13px] font-semibold text-ink">Value over time</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="formattedDate" {...axisProps} minTickGap={20} />
                        <YAxis {...axisProps} axisLine={false} width={52} tickFormatter={(v: number) => formatGBPCompact(v)} domain={['auto', 'auto']} />
                        <Tooltip
                          {...tooltipProps}
                          cursor={{ stroke: chart.grid }}
                          formatter={(value) => [formatGBP(Number(value), { pence: true }), 'Value']}
                          labelFormatter={(label) => String(label)}
                        />
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke={chart.accent}
                          strokeWidth={2}
                          fill={chart.accent}
                          fillOpacity={0.08}
                          dot={{ r: 2.5, fill: chart.accent, strokeWidth: 0 }}
                          activeDot={{ r: 4, fill: chart.accent, stroke: chart.surface }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-3">Each point is a recorded valuation from the last two years.</p>
                </section>
              )}

              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-semibold text-ink">Valuations</h3>
                  {!isAdding && (
                    <Button size="sm" variant="ghost" onClick={() => setIsAdding(true)}>
                      Add a valuation
                    </Button>
                  )}
                </div>

                {isAdding && (
                  <form
                    className="mb-3 flex flex-wrap items-end gap-2 rounded-[3px] border border-line bg-sunk p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddSnapshot();
                    }}
                  >
                    <label className="grid gap-1 text-[12.5px] text-ink-2">
                      Date
                      <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-8 w-auto py-1" required />
                    </label>
                    <label className="grid gap-1 text-[12.5px] text-ink-2">
                      Value (£)
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={newBalance}
                        onChange={(e) => setNewBalance(e.target.value)}
                        placeholder="0.00"
                        className="fig h-8 w-36 py-1 text-right"
                        required
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" variant="primary" loading={isSaving} disabled={!newDate || !newBalance}>
                        Save valuation
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAdding(false);
                          setNewDate('');
                          setNewBalance('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {snapshots.length === 0 ? (
                  <EmptyState title="No valuations yet">Add a valuation to track this account&apos;s value over time.</EmptyState>
                ) : (
                  <div className="overflow-hidden rounded-[3px] border border-line">
                    <table className="w-full text-[13px]">
                      <thead className="bg-sunk text-[11.5px] text-ink-3">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left font-medium">
                            Date
                          </th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">
                            Value
                          </th>
                          <th scope="col" className="w-20 px-3 py-2 text-right font-medium">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-2">
                        {snapshots.map((snapshot) => (
                          <tr key={snapshot.id} className="hover:bg-sunk">
                            <td className="whitespace-nowrap px-3 py-2 text-ink">{formatDateGB(snapshot.date)}</td>
                            <td className="px-3 py-2 text-right">
                              {editingId === snapshot.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  aria-label={`Value on ${formatDateGB(snapshot.date)}`}
                                  className="fig ml-auto h-8 w-32 py-1 text-right"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit(snapshot.id);
                                    if (e.key === 'Escape') {
                                      e.nativeEvent.stopImmediatePropagation();
                                      handleCancelEdit();
                                    }
                                  }}
                                />
                              ) : (
                                <span className="fig text-ink">{formatGBP(snapshot.balance, { pence: true })}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {editingId === snapshot.id ? (
                                  <>
                                    <button type="button" onClick={() => handleSaveEdit(snapshot.id)} disabled={isSaving} aria-label="Save" title="Save" className={`${iconButton} text-accent hover:bg-line-2`}>
                                      <Check className="h-4 w-4" aria-hidden />
                                    </button>
                                    <button type="button" onClick={handleCancelEdit} aria-label="Cancel" title="Cancel" className={`${iconButton} text-ink-3 hover:bg-line-2 hover:text-ink`}>
                                      <X className="h-4 w-4" aria-hidden />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(snapshot)}
                                      aria-label={`Edit valuation on ${formatDateGB(snapshot.date)}`}
                                      title="Edit"
                                      className={`${iconButton} text-ink-3 hover:bg-line-2 hover:text-ink`}
                                    >
                                      <Pencil className="h-4 w-4" aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDelete(snapshot)}
                                      disabled={isSaving}
                                      aria-label={`Delete valuation on ${formatDateGB(snapshot.date)}`}
                                      title="Delete"
                                      className={`${iconButton} text-ink-3 hover:bg-bad-soft hover:text-bad`}
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-line-2 px-5 py-3">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Delete this valuation?"
        message={
          confirmDelete
            ? `The ${formatGBP(confirmDelete.balance, { pence: true })} valuation on ${formatDateGB(confirmDelete.date)} will be removed. This can't be undone.`
            : ''
        }
        confirmLabel="Delete valuation"
        variant="danger"
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) handleDelete(target.id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
