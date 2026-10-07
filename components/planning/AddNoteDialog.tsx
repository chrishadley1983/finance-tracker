'use client';

import { useEscape } from './useEscape';
import { useState, useEffect } from 'react';
import type { PlanningNote, CreatePlanningNote, UpdatePlanningNote, PlanningSectionWithNotes } from '@/lib/validations/planning';

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreatePlanningNote | UpdatePlanningNote) => Promise<void>;
  sectionId?: string | null;
  sections?: PlanningSectionWithNotes[];
  note?: PlanningNote | null;
  isLoading?: boolean;
}

export function AddNoteDialog({
  open,
  onOpenChange,
  onSave,
  sectionId,
  sections,
  note,
  isLoading,
}: AddNoteDialogProps) {
  const [content, setContent] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!note;

  useEffect(() => {
    if (note) {
      setContent(note.content);
      setSelectedSectionId(note.section_id);
      setIsPinned(note.is_pinned);
      setTagsInput(note.tags?.join(', ') || '');
    } else {
      setContent('');
      setSelectedSectionId(sectionId || '');
      setIsPinned(false);
      setTagsInput('');
    }
    setError(null);
  }, [note, sectionId, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError('Note content is required');
      return;
    }

    if (!selectedSectionId && !sectionId) {
      setError('Please select a section');
      return;
    }

    // Parse tags from comma-separated input
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      await onSave({
        section_id: selectedSectionId || sectionId!,
        content: content.trim(),
        is_pinned: isPinned,
        tags: tags.length > 0 ? tags : null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  useEscape(open, () => onOpenChange(false));

  if (!open) return null;

  const effectiveSectionId = selectedSectionId || sectionId;
  const currentSection = sections?.find((s) => s.id === effectiveSectionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40" aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div role="dialog" aria-modal="true" aria-labelledby="note-dialog-title" className="relative border border-line bg-surface rounded-md shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 id="note-dialog-title" className="text-base font-semibold text-ink">
            {isEditing ? 'Edit note' : 'Add a note'}
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

          {/* Section Selector (only show if no sectionId provided or editing) */}
          {(!sectionId || isEditing) && sections && sections.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">
                Section
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink focus:ring-2 focus:ring-accent focus:border-accent"
              >
                <option value="">Select a section...</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.icon ? `${section.icon} ` : ''}{section.name}
                    {section.year_label ? ` (${section.year_label})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Current section indicator */}
          {currentSection && sectionId && !isEditing && (
            <div className="flex items-center gap-2 text-sm text-ink-3">
              <span>Adding to:</span>
              <span
                className="px-2 py-1 rounded font-medium"
                style={{ backgroundColor: `${currentSection.colour || '#6366f1'}20`, color: currentSection.colour || '#6366f1' }}
              >
                {currentSection.icon && `${currentSection.icon} `}
                {currentSection.name}
              </span>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Note
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your note..."
              rows={4}
              className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink focus:ring-2 focus:ring-accent focus:border-accent resize-none"
              autoFocus
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Tags
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., urgent, review-2025 (comma-separated)"
              className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <p className="mt-1 text-xs text-ink-3">
              Separate multiple tags with commas
            </p>
          </div>

          {/* Pin toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPinned ? 'bg-accent' : 'bg-line-2'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
                  isPinned ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-ink-2">
              Pin to top of section
            </span>
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
              {isLoading ? 'Saving...' : isEditing ? 'Save note' : 'Add note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
