'use client';

import { useState, useEffect } from 'react';
import { CategoryWithStats } from '@/lib/types/category';
import { CategoryMapping } from './RuleCard';

interface RuleFormData {
  pattern: string;
  match_type: string;
  category_id: string;
  notes: string;
}

interface RuleDialogProps {
  rule: CategoryMapping | null;
  categories: CategoryWithStats[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: RuleFormData) => Promise<void>;
  onTest?: (pattern: string, matchType: string) => Promise<number>;
}

const matchTypes = [
  { value: 'exact', label: 'Exact match', description: 'Matches the full description exactly' },
  { value: 'contains', label: 'Contains', description: 'Matches if description contains this text' },
  { value: 'starts_with', label: 'Starts with', description: 'Matches if description starts with this text' },
  { value: 'ends_with', label: 'Ends with', description: 'Matches if description ends with this text' },
  { value: 'regex', label: 'Regex', description: 'Uses regular expression matching' },
];

export function RuleDialog({
  rule,
  categories,
  isOpen,
  onClose,
  onSave,
  onTest,
}: RuleDialogProps) {
  const [formData, setFormData] = useState<RuleFormData>({
    pattern: '',
    match_type: 'contains',
    category_id: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rule) {
      setFormData({
        pattern: rule.pattern,
        match_type: rule.match_type,
        category_id: rule.category_id,
        notes: rule.notes || '',
      });
    } else {
      setFormData({
        pattern: '',
        match_type: 'contains',
        category_id: '',
        notes: '',
      });
    }
    setError(null);
    setTestResult(null);
  }, [rule, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!onTest || !formData.pattern) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const count = await onTest(formData.pattern, formData.match_type);
      setTestResult(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test rule');
    } finally {
      setIsTesting(false);
    }
  };

  // Group categories by their group for easier selection
  const groupedCategories = categories.reduce((acc, cat) => {
    const groupName = cat.group_name || 'Ungrouped';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(cat);
    return acc;
  }, {} as Record<string, CategoryWithStats[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {rule ? 'Edit Rule' : 'New Rule'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}

            {/* Pattern */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pattern
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, pattern: e.target.value }));
                    setTestResult(null);
                  }}
                  placeholder="e.g., AMAZON, Netflix"
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                           bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                           font-mono text-sm
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {onTest && (
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={!formData.pattern || isTesting}
                    className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400
                             border border-blue-300 dark:border-blue-700 rounded-md
                             hover:bg-blue-50 dark:hover:bg-blue-900/20
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isTesting ? 'Testing...' : 'Test'}
                  </button>
                )}
              </div>
              {testResult !== null && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Matches {testResult} transaction{testResult !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Match type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Match Type
              </label>
              <select
                value={formData.match_type}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, match_type: e.target.value }));
                  setTestResult(null);
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {matchTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {matchTypes.find(t => t.value === formData.match_type)?.description}
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a category...</option>
                {Object.entries(groupedCategories).map(([groupName, cats]) => (
                  <optgroup key={groupName} label={groupName}>
                    {cats.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Description of this rule"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                       border border-slate-300 dark:border-slate-600 rounded-md
                       hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isSubmitting || !formData.category_id}
            >
              {isSubmitting ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
