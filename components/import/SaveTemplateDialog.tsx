'use client';

import { useState, useCallback } from 'react';
import type { ColumnMapping } from '@/lib/validations/import';

// =============================================================================
// TYPES
// =============================================================================

export interface SaveTemplateDialogProps {
  isOpen: boolean;
  mapping: ColumnMapping;
  headers: string[];
  dateFormat?: string;
  decimalSeparator?: '.' | ',';
  hasHeader?: boolean;
  skipRows?: number;
  onSave: (template: SaveTemplateData) => Promise<void>;
  onClose: () => void;
}

export interface SaveTemplateData {
  name: string;
  provider: string;
  columnMapping: ColumnMapping;
  dateFormat: string;
  decimalSeparator: '.' | ',';
  hasHeader: boolean;
  skipRows: number;
  amountInSingleColumn: boolean;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  sampleHeaders: string[];
  notes?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SaveTemplateDialog({
  isOpen,
  mapping,
  headers,
  dateFormat = 'DD/MM/YYYY',
  decimalSeparator = '.',
  hasHeader = true,
  skipRows = 0,
  onSave,
  onClose,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!provider.trim()) {
      setError('Provider/bank name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const amountInSingleColumn = !!mapping.amount;

      const templateData: SaveTemplateData = {
        name: name.trim(),
        provider: provider.trim(),
        columnMapping: mapping,
        dateFormat,
        decimalSeparator,
        hasHeader,
        skipRows,
        amountInSingleColumn,
        amountColumn: mapping.amount || undefined,
        debitColumn: mapping.debit || undefined,
        creditColumn: mapping.credit || undefined,
        sampleHeaders: headers,
        notes: notes.trim() || undefined,
      };

      await onSave(templateData);

      // Reset form
      setName('');
      setProvider('');
      setNotes('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSubmitting(false);
    }
  }, [name, provider, notes, mapping, headers, dateFormat, decimalSeparator, hasHeader, skipRows, onSave, onClose]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setName('');
      setProvider('');
      setNotes('');
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  // Build mapping summary for display
  const mappingSummary = [
    mapping.date && `Date: ${mapping.date}`,
    mapping.description && `Description: ${mapping.description}`,
    mapping.amount && `Amount: ${mapping.amount}`,
    mapping.debit && `Debit: ${mapping.debit}`,
    mapping.credit && `Credit: ${mapping.credit}`,
    mapping.reference && `Reference: ${mapping.reference}`,
    mapping.balance && `Balance: ${mapping.balance}`,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Save as Template</h2>
          <p className="text-sm text-slate-500 mt-1">
            Save this column mapping for future imports from the same source.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Template Name */}
            <div>
              <label htmlFor="template-name" className="block text-sm font-medium text-slate-700 mb-1">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                id="template-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Barclays Current Account"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={100}
                autoFocus
              />
            </div>

            {/* Provider */}
            <div>
              <label htmlFor="template-provider" className="block text-sm font-medium text-slate-700 mb-1">
                Bank / Provider <span className="text-red-500">*</span>
              </label>
              <input
                id="template-provider"
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g., Barclays"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={100}
              />
            </div>

            {/* Mapping Summary */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Column Mapping</h3>
              <ul className="text-sm text-slate-600 space-y-1">
                {mappingSummary.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-2">
                Format: {dateFormat} | Decimal: {decimalSeparator === '.' ? 'Period (.)' : 'Comma (,)'}
              </p>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="template-notes" className="block text-sm font-medium text-slate-700 mb-1">
                Notes <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="template-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this template..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                maxLength={500}
              />
              <p className="text-xs text-slate-400 mt-1">{notes.length}/500</p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save Template
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
