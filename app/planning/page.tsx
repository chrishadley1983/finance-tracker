'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  PlanningSectionList,
  AddSectionDialog,
  AddNoteDialog,
  ImportDialog,
  PlanningFilters,
} from '@/components/planning';
import type {
  PlanningNote,
  PlanningSectionWithNotes,
  CreatePlanningSection,
  UpdatePlanningSection,
  CreatePlanningNote,
  UpdatePlanningNote,
} from '@/lib/validations/planning';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ParsedSection {
  name: string;
  notes: string[];
  isNew: boolean;
  existingSectionId?: string;
}

export default function PlanningPage() {
  const [sections, setSections] = useState<PlanningSectionWithNotes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Dialog state
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<PlanningSectionWithNotes | null>(null);
  const [deletingSection, setDeletingSection] = useState<PlanningSectionWithNotes | null>(null);
  const [addNoteToSectionId, setAddNoteToSectionId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<PlanningNote | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch sections with notes
  const fetchSections = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL('/api/planning-sections', window.location.origin);
      url.searchParams.set('includeNotes', 'true');
      if (showArchived) {
        url.searchParams.set('includeArchived', 'true');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch sections');
      }

      const data = await response.json();
      setSections(data.sections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load planning notes');
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  // Section handlers
  const handleCreateSection = async (data: CreatePlanningSection | UpdatePlanningSection) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/planning-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create section');
      }

      await fetchSections();
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSection = async (data: CreatePlanningSection | UpdatePlanningSection) => {
    if (!editingSection) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/planning-sections/${editingSection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update section');
      }

      await fetchSections();
      setEditingSection(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!deletingSection) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/planning-sections/${deletingSection.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete section');
      }

      await fetchSections();
      setDeletingSection(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveSection = async (section: PlanningSectionWithNotes) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/planning-sections/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: !section.is_archived }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update section');
      }

      await fetchSections();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReorderSections = async (items: { id: string; display_order: number }[]) => {
    // Optimistic update
    const reorderedSections = items.map((item) => {
      const section = sections.find((s) => s.id === item.id)!;
      return { ...section, display_order: item.display_order };
    }).sort((a, b) => a.display_order - b.display_order);
    setSections(reorderedSections);

    try {
      const response = await fetch('/api/planning-sections/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        // Revert on error
        await fetchSections();
      }
    } catch {
      await fetchSections();
    }
  };

  // Note handlers
  const handleCreateNote = async (data: CreatePlanningNote | UpdatePlanningNote) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/planning-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create note');
      }

      await fetchSections();
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNote = async (data: CreatePlanningNote | UpdatePlanningNote) => {
    if (!editingNote) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/planning-notes/${editingNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update note');
      }

      await fetchSections();
      setEditingNote(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/planning-notes/${noteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete note');
      }

      await fetchSections();
    } catch (err) {
      console.error('Delete note error:', err);
    }
  };

  const handleTogglePinNote = async (noteId: string, isPinned: boolean) => {
    try {
      const response = await fetch(`/api/planning-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: isPinned }),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      await fetchSections();
    } catch (err) {
      console.error('Toggle pin error:', err);
    }
  };

  // Import handler
  const handleImport = async ({ sections: parsedSections }: { sections: ParsedSection[] }) => {
    setIsSaving(true);
    try {
      // First, create any new sections
      const sectionIdMap = new Map<string, string>();

      for (const parsed of parsedSections) {
        if (parsed.isNew) {
          const response = await fetch('/api/planning-sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: parsed.name }),
          });

          if (!response.ok) {
            throw new Error(`Failed to create section: ${parsed.name}`);
          }

          const newSection = await response.json();
          sectionIdMap.set(parsed.name, newSection.id);
        } else if (parsed.existingSectionId) {
          sectionIdMap.set(parsed.name, parsed.existingSectionId);
        }
      }

      // Now bulk import all notes
      const notesToImport = parsedSections.flatMap((parsed) => {
        const sectionId = sectionIdMap.get(parsed.name);
        if (!sectionId) return [];

        return parsed.notes.map((content) => ({
          section_id: sectionId,
          content,
        }));
      });

      if (notesToImport.length > 0) {
        const response = await fetch('/api/planning-notes/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: notesToImport }),
        });

        if (!response.ok) {
          throw new Error('Failed to import notes');
        }
      }

      await fetchSections();
    } finally {
      setIsSaving(false);
    }
  };

  // Stats
  const totalNotes = sections.reduce((sum, s) => sum + s.notes.length, 0);
  const pinnedNotes = sections.reduce(
    (sum, s) => sum + s.notes.filter((n) => n.is_pinned).length,
    0
  );

  return (
    <AppLayout title="Planning Notes">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track your financial planning assumptions, principles, and notes
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-slate-500 dark:text-slate-400">Sections</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {sections.filter((s) => !s.is_archived).length}
            </div>
            {sections.some((s) => s.is_archived) && (
              <div className="text-xs text-slate-400">
                {sections.filter((s) => s.is_archived).length} archived
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-slate-500 dark:text-slate-400">Total Notes</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalNotes}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm">
            <div className="text-sm text-slate-500 dark:text-slate-400">Pinned</div>
            <div className="text-2xl font-bold text-amber-500">{pinnedNotes}</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
            <button
              onClick={fetchSections}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <PlanningFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
          onAddSection={() => setIsAddSectionOpen(true)}
          onImport={() => setIsImportOpen(true)}
        />

        {/* Section List */}
        <PlanningSectionList
          sections={sections}
          searchQuery={searchQuery}
          isLoading={isLoading}
          onReorder={handleReorderSections}
          onAddNote={setAddNoteToSectionId}
          onEditSection={setEditingSection}
          onDeleteSection={setDeletingSection}
          onArchiveSection={handleArchiveSection}
          onEditNote={setEditingNote}
          onDeleteNote={handleDeleteNote}
          onTogglePinNote={handleTogglePinNote}
        />

        {/* Add Section Dialog */}
        <AddSectionDialog
          open={isAddSectionOpen}
          onOpenChange={setIsAddSectionOpen}
          onSave={handleCreateSection}
          isLoading={isSaving}
        />

        {/* Edit Section Dialog */}
        <AddSectionDialog
          open={!!editingSection}
          onOpenChange={(open) => !open && setEditingSection(null)}
          section={editingSection}
          onSave={handleUpdateSection}
          isLoading={isSaving}
        />

        {/* Delete Section Dialog */}
        {deletingSection && (
          <ConfirmDialog
            isOpen={!!deletingSection}
            title="Delete Section"
            message={
              deletingSection.notes.length > 0
                ? `This section contains ${deletingSection.notes.length} note${deletingSection.notes.length !== 1 ? 's' : ''}. You must delete or move them first, or archive the section instead.`
                : `Are you sure you want to delete "${deletingSection.name}"? This action cannot be undone.`
            }
            confirmLabel={deletingSection.notes.length > 0 ? 'Close' : 'Delete'}
            variant={deletingSection.notes.length > 0 ? 'default' : 'danger'}
            onConfirm={deletingSection.notes.length > 0 ? () => setDeletingSection(null) : handleDeleteSection}
            onCancel={() => setDeletingSection(null)}
          />
        )}

        {/* Add Note Dialog */}
        <AddNoteDialog
          open={!!addNoteToSectionId}
          onOpenChange={(open) => !open && setAddNoteToSectionId(null)}
          sectionId={addNoteToSectionId}
          sections={sections}
          onSave={handleCreateNote}
          isLoading={isSaving}
        />

        {/* Edit Note Dialog */}
        <AddNoteDialog
          open={!!editingNote}
          onOpenChange={(open) => !open && setEditingNote(null)}
          note={editingNote}
          sections={sections}
          onSave={handleUpdateNote}
          isLoading={isSaving}
        />

        {/* Import Dialog */}
        <ImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          sections={sections}
          onImport={handleImport}
          isLoading={isSaving}
        />
      </div>
    </AppLayout>
  );
}
