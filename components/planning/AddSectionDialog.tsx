'use client';

import { useState, useEffect } from 'react';
import type { PlanningSectionWithNotes, CreatePlanningSection, UpdatePlanningSection } from '@/lib/validations/planning';

const PRESET_COLOURS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#64748b', // Slate
  '#78716c', // Stone
];

const PRESET_ICONS = ['📋', '💰', '📈', '🏠', '💼', '🎯', '📊', '💡', '⚡', '🔥', '✨', '📝'];

interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreatePlanningSection | UpdatePlanningSection) => Promise<void>;
  section?: PlanningSectionWithNotes | null;
  isLoading?: boolean;
}

export function AddSectionDialog({
  open,
  onOpenChange,
  onSave,
  section,
  isLoading,
}: AddSectionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [yearLabel, setYearLabel] = useState('');
  const [colour, setColour] = useState('#6366f1');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!section;

  useEffect(() => {
    if (section) {
      setName(section.name);
      setDescription(section.description || '');
      setYearLabel(section.year_label || '');
      setColour(section.colour || '#6366f1');
      setIcon(section.icon || '');
    } else {
      setName('');
      setDescription('');
      setYearLabel('');
      setColour('#6366f1');
      setIcon('');
    }
    setError(null);
  }, [section, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Section name is required');
      return;
    }

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        year_label: yearLabel.trim() || null,
        colour: colour || null,
        icon: icon || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save section');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isEditing ? 'Edit Section' : 'Add Section'}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Section Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Financial Goals"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Year Label */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Year/Period
            </label>
            <input
              type="text"
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
              placeholder="e.g., 2024/25"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Colour */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Colour
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColour(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    colour === c
                      ? 'border-slate-900 dark:border-slate-100 scale-110'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIcon('')}
                className={`w-8 h-8 rounded border text-sm transition-all ${
                  icon === ''
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                }`}
              >
                -
              </button>
              {PRESET_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-8 h-8 rounded border text-lg transition-all ${
                    icon === i
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Preview
            </label>
            <div
              className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border-l-4"
              style={{ borderLeftColor: colour }}
            >
              <div className="flex items-center gap-2">
                {icon && <span className="text-lg">{icon}</span>}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {name || 'Section Name'}
                </span>
                {yearLabel && (
                  <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-600 rounded">
                    {yearLabel}
                  </span>
                )}
              </div>
              {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
