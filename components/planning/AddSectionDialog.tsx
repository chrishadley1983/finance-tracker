'use client';

import { useEscape } from './useEscape';
import { useState, useEffect } from 'react';
import type { PlanningSectionWithNotes, CreatePlanningSection, UpdatePlanningSection } from '@/lib/validations/planning';

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
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!section;

  useEffect(() => {
    if (section) {
      setName(section.name);
      setDescription(section.description || '');
      setYearLabel(section.year_label || '');
      setIcon(section.icon || '');
    } else {
      setName('');
      setDescription('');
      setYearLabel('');
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
        // Section colour is no longer shown; keep whatever is stored.
        colour: section?.colour ?? null,
        icon: icon || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save section');
    }
  };

  useEscape(open, () => onOpenChange(false));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40" aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div role="dialog" aria-modal="true" aria-labelledby="section-dialog-title" className="relative border border-line bg-surface rounded-md shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 id="section-dialog-title" className="text-base font-semibold text-ink">
            {isEditing ? 'Edit section' : 'New section'}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close" className="p-1 text-ink-3 hover:text-ink-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-bad-soft border border-bad/40 rounded-md text-sm text-bad">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Financial Goals"
              className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink focus:ring-2 focus:ring-accent focus:border-accent"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Year Label */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Year/Period
            </label>
            <input
              type="text"
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
              placeholder="e.g., 2024/25"
              className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIcon('')}
                className={`w-8 h-8 rounded border text-sm transition-all ${
                  icon === ''
                    ? 'border-accent bg-accent-soft '
                    : 'border-line hover:border-line'
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
                      ? 'border-accent bg-accent-soft '
                      : 'border-line hover:border-line'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-ink-2 mb-2">
              Preview
            </label>
            <div className="p-3 bg-sunk rounded-md">
              <div className="flex items-center gap-2">
                {icon && <span className="text-lg">{icon}</span>}
                <span className="font-semibold text-ink">
                  {name || 'Section name'}
                </span>
                {yearLabel && (
                  <span className="px-2 py-0.5 text-xs bg-line-2 rounded">
                    {yearLabel}
                  </span>
                )}
              </div>
              {description && (
                <p className="text-sm text-ink-3 mt-1">
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
              className="px-4 py-2 text-sm font-medium text-ink-2 bg-sunk rounded-md hover:bg-line-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-accent-ink bg-accent rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : isEditing ? 'Save section' : 'Add section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
