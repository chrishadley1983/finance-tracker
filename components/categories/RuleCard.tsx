'use client';

interface CategoryMapping {
  id: string;
  pattern: string;
  match_type: string;
  category_id: string;
  confidence: number;
  is_system: boolean;
  notes: string | null;
  created_at: string;
  category?: {
    id: string;
    name: string;
  };
}

interface RuleCardProps {
  rule: CategoryMapping;
  onEdit: (rule: CategoryMapping) => void;
  onDelete: (rule: CategoryMapping) => void;
}

const matchTypeLabels: Record<string, string> = {
  exact: 'Exact match',
  contains: 'Contains',
  starts_with: 'Starts with',
  ends_with: 'Ends with',
  regex: 'Regex',
};

export function RuleCard({ rule, onEdit, onDelete }: RuleCardProps) {
  return (
    <div className="group flex items-start justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-sm font-mono text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
            {rule.pattern}
          </code>
          {rule.is_system && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
              System
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="capitalize">{matchTypeLabels[rule.match_type] || rule.match_type}</span>
          <span>→</span>
          <span className="text-slate-700 dark:text-slate-300">
            {rule.category?.name || 'Unknown category'}
          </span>
        </div>
        {rule.notes && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{rule.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
        <button
          onClick={() => onEdit(rule)}
          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Edit rule"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(rule)}
          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Delete rule"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export type { CategoryMapping };
