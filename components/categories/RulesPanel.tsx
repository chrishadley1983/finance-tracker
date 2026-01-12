'use client';

import { useState, useEffect, useCallback } from 'react';
import { CategoryWithStats } from '@/lib/types/category';
import { RuleCard, CategoryMapping } from './RuleCard';
import { RuleDialog } from './RuleDialog';

interface RulesPanelProps {
  categories: CategoryWithStats[];
  selectedCategoryId: string | null;
}

export function RulesPanel({ categories, selectedCategoryId }: RulesPanelProps) {
  const [rules, setRules] = useState<CategoryMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<CategoryMapping | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = selectedCategoryId
        ? `/api/categories/rules?categoryId=${selectedCategoryId}`
        : '/api/categories/rules';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch rules');
      }

      const data = await response.json();
      // API returns { rules: [...] }, extract the array
      setRules(Array.isArray(data) ? data : (data.rules || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleAddRule = () => {
    setEditingRule(null);
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: CategoryMapping) => {
    setEditingRule(rule);
    setIsDialogOpen(true);
  };

  const handleDeleteRule = async (rule: CategoryMapping) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/categories/rules/${rule.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }

      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const handleSaveRule = async (data: {
    pattern: string;
    match_type: string;
    category_id: string;
    notes: string;
  }) => {
    const url = editingRule
      ? `/api/categories/rules/${editingRule.id}`
      : '/api/categories/rules';
    const method = editingRule ? 'PUT' : 'POST';

    // Convert to API expected format (camelCase)
    const apiData = {
      pattern: data.pattern,
      matchType: data.match_type,
      categoryId: data.category_id,
      notes: data.notes,
    };

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save rule');
    }

    await fetchRules();
  };

  const handleTestRule = async (pattern: string, matchType: string): Promise<number> => {
    // Use the main rules endpoint with action: 'test'
    const response = await fetch('/api/categories/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test',
        pattern,
        matchType,
        categoryId: '00000000-0000-0000-0000-000000000000', // Dummy ID for test
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to test rule');
    }

    const data = await response.json();
    return data.totalMatched || 0;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Auto-Categorisation Rules
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={handleAddRule}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md
                   hover:bg-blue-700 transition-colors"
        >
          + Add Rule
        </button>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="p-3 mb-4 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse h-16 bg-slate-100 dark:bg-slate-700 rounded-lg" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 dark:text-slate-400">No rules configured</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Add rules to automatically categorise transactions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={handleEditRule}
                onDelete={handleDeleteRule}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rule dialog */}
      <RuleDialog
        rule={editingRule}
        categories={categories}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveRule}
        onTest={handleTestRule}
      />
    </div>
  );
}
