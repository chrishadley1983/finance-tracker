'use client';

import { useState } from 'react';

interface BulkImportDialogProps {
  isOpen: boolean;
  accountId: string;
  accountName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  date: string;
  value: number;
  notes?: string;
  error?: string;
}

export function BulkImportDialog({
  isOpen,
  accountId,
  accountName,
  onClose,
  onSuccess,
}: BulkImportDialogProps) {
  const [inputText, setInputText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; updated: number; errors: { date: string; error: string }[] } | null>(null);

  const parseInput = (text: string) => {
    const lines = text.trim().split('\n').filter((line) => line.trim());
    const rows: ParsedRow[] = [];

    for (const line of lines) {
      // Try tab-separated first, then comma
      const parts = line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.split(',').map((p) => p.trim());

      if (parts.length < 2) {
        rows.push({ date: line, value: 0, error: 'Invalid format' });
        continue;
      }

      const [dateStr, valueStr, ...notesArr] = parts;
      const notes = notesArr.join(', ').trim() || undefined;

      // Parse value - remove currency symbols and commas
      const cleanValue = valueStr.replace(/[£$,]/g, '');
      const value = parseFloat(cleanValue);

      if (isNaN(value) || value <= 0) {
        rows.push({ date: dateStr, value: 0, error: 'Invalid value' });
        continue;
      }

      rows.push({ date: dateStr, value, notes });
    }

    return rows;
  };

  const handleParse = () => {
    setError(null);
    setResult(null);

    if (!inputText.trim()) {
      setError('Please paste some data');
      return;
    }

    const rows = parseInput(inputText);
    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
      const rows = parseInput(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    const validRows = parsedRows.filter((r) => !r.error);
    if (validRows.length === 0) {
      setError('No valid rows to import');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/investments/${accountId}/valuations/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valuations: validRows.map((r) => ({
            date: r.date,
            value: r.value,
            notes: r.notes,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Import failed');
      }

      const data = await response.json();
      setResult(data);

      if (data.imported > 0 || data.updated > 0) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setInputText('');
    setParsedRows([]);
    setError(null);
    setResult(null);
    onClose();
  };

  const validCount = parsedRows.filter((r) => !r.error).length;
  const errorCount = parsedRows.filter((r) => r.error).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={handleClose}
        />

        {/* Dialog */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Import Historical Data
            </h2>
            <p className="text-sm text-gray-500">{accountName}</p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800 mb-1">Accepted formats:</p>
              <ul className="text-blue-700 list-disc list-inside space-y-0.5">
                <li>Tab or comma separated: <code>date, value, notes</code></li>
                <li>Date formats: DD/MM/YYYY, YYYY-MM-DD</li>
                <li>Values can include £ symbol and commas</li>
              </ul>
            </div>

            {/* Input */}
            {!result && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Paste from spreadsheet
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      setParsedRows([]);
                    }}
                    placeholder="31/01/2024&#9;42000&#10;29/02/2024&#9;43500&#10;31/03/2024&#9;45000"
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">or</span>
                  <label className="px-3 py-1.5 text-sm border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {parsedRows.length === 0 && (
                  <button
                    onClick={handleParse}
                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Preview Data
                  </button>
                )}
              </>
            )}

            {/* Preview */}
            {parsedRows.length > 0 && !result && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    Preview ({validCount} valid, {errorCount} errors)
                  </p>
                  <button
                    onClick={() => setParsedRows([])}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-right">Value</th>
                        <th className="px-3 py-2 text-left">Notes</th>
                        <th className="px-3 py-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedRows.map((row, i) => (
                        <tr
                          key={i}
                          className={row.error ? 'bg-red-50' : 'hover:bg-gray-50'}
                        >
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2 text-right">
                            {row.error ? '-' : `£${row.value.toLocaleString()}`}
                          </td>
                          <td className="px-3 py-2 text-gray-500 truncate max-w-32">
                            {row.notes || '-'}
                          </td>
                          <td className="px-3 py-2">
                            {row.error && (
                              <span className="text-red-600 text-xs">
                                {row.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-medium text-green-800">Import Complete</p>
                <ul className="text-sm text-green-700 mt-1">
                  <li>{result.imported} new valuations imported</li>
                  <li>{result.updated} existing valuations updated</li>
                  {result.errors.length > 0 && (
                    <li className="text-amber-700">
                      {result.errors.length} errors
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && parsedRows.length > 0 && validCount > 0 && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {isSubmitting ? 'Importing...' : `Import ${validCount} Valuations`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
