'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PlanningSectionList } from './PlanningSectionList';
import { AddSectionDialog } from './AddSectionDialog';
import { AddNoteDialog } from './AddNoteDialog';
import { ImportDialog } from './ImportDialog';
import { PlanningFilters } from './PlanningFilters';
import { moveNote } from './order';
import { PageIntro } from '@/components/ui/PageIntro';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type {
  PlanningNote,
  PlanningSectionWithNotes,
  CreatePlanningSection,
  UpdatePlanningSection,
  CreatePlanningNote,
  UpdatePlanningNote,
} from '@/lib/validations/planning';

interface ParsedSection {
  name: string;
  notes: string[];
  isNew: boolean;
  existingSectionId?: string;
}

async function send(url: string, method: string, body?: unknown, fallback = 'Something went wrong') {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallback);
  return data;
}

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** The Notes page: sections of planning notes with search, pin, reorder and archive. */
export function PlanningNotes() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();

  // Search and the archived toggle live in the URL so a refresh keeps them.
  const urlQuery = params?.get('q') ?? '';
  const showArchived = params?.get('archived') === '1';
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params?.toString() ?? '');
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );
  // Debounce URL writes while typing.
  useEffect(() => {
    if (searchQuery === urlQuery) return;
    const t = setTimeout(() => setParam('q', searchQuery.trim() ? searchQuery : null), 250);
    return () => clearTimeout(t);
  }, [searchQuery, urlQuery, setParam]);

  const [sections, setSections] = useState<PlanningSectionWithNotes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<PlanningSectionWithNotes | null>(null);
  const [deletingSection, setDeletingSection] = useState<PlanningSectionWithNotes | null>(null);
  const [deletingNote, setDeletingNote] = useState<PlanningNote | null>(null);
  const [addNoteToSectionId, setAddNoteToSectionId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<PlanningNote | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const fetchSections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ includeNotes: 'true' });
      if (showArchived) qs.set('includeArchived', 'true');
      const res = await fetch(`/api/planning-sections?${qs}`);
      if (!res.ok) throw new Error('Could not load your notes');
      const data = await res.json();
      setSections(data.sections || []);
    } catch (err) {
      setError(errText(err, 'Could not load your notes'));
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  // ---- Sections -----------------------------------------------------------

  const handleCreateSection = async (data: CreatePlanningSection | UpdatePlanningSection) => {
    setIsSaving(true);
    try {
      await send('/api/planning-sections', 'POST', data, 'Could not create the section');
      await fetchSections();
      toast({ message: 'Section added', tone: 'success' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSection = async (data: CreatePlanningSection | UpdatePlanningSection) => {
    if (!editingSection) return;
    setIsSaving(true);
    try {
      await send(`/api/planning-sections/${editingSection.id}`, 'PATCH', data, 'Could not save the section');
      await fetchSections();
      setEditingSection(null);
      toast({ message: 'Section saved', tone: 'success' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!deletingSection) return;
    const section = deletingSection;
    setDeletingSection(null);
    try {
      await send(`/api/planning-sections/${section.id}`, 'DELETE', undefined, 'Could not delete the section');
      await fetchSections();
      toast({ message: `Deleted "${section.name}"` });
    } catch (err) {
      toast({ message: errText(err, 'Could not delete the section'), tone: 'error' });
    }
  };

  const setArchived = async (section: PlanningSectionWithNotes, archived: boolean, withUndo: boolean) => {
    try {
      await send(`/api/planning-sections/${section.id}`, 'PATCH', { is_archived: archived }, 'Could not update the section');
      await fetchSections();
      toast({
        message: archived ? `Archived "${section.name}"` : `Restored "${section.name}"`,
        action: withUndo ? { label: 'Undo', onClick: () => setArchived(section, !archived, false) } : undefined,
      });
    } catch (err) {
      toast({ message: errText(err, 'Could not update the section'), tone: 'error' });
    }
  };

  const handleReorderSections = async (items: { id: string; display_order: number }[]) => {
    const before = sectionsRef.current;
    const byId = new Map(before.map((s) => [s.id, s]));
    setSections(
      items
        .map((item) => ({ ...byId.get(item.id)!, display_order: item.display_order }))
        .sort((a, b) => a.display_order - b.display_order)
    );
    try {
      await send('/api/planning-sections/reorder', 'POST', { items }, 'Could not save the new order');
    } catch (err) {
      setSections(before);
      toast({ message: errText(err, 'Could not save the new order'), tone: 'error' });
    }
  };

  // ---- Notes --------------------------------------------------------------

  const handleCreateNote = async (data: CreatePlanningNote | UpdatePlanningNote) => {
    setIsSaving(true);
    try {
      await send('/api/planning-notes', 'POST', data, 'Could not add the note');
      await fetchSections();
      toast({ message: 'Note added', tone: 'success' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNote = async (data: CreatePlanningNote | UpdatePlanningNote) => {
    if (!editingNote) return;
    setIsSaving(true);
    try {
      await send(`/api/planning-notes/${editingNote.id}`, 'PATCH', data, 'Could not save the note');
      await fetchSections();
      setEditingNote(null);
      toast({ message: 'Note saved', tone: 'success' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!deletingNote) return;
    const note = deletingNote;
    setDeletingNote(null);
    try {
      await send(`/api/planning-notes/${note.id}`, 'DELETE', undefined, 'Could not delete the note');
      await fetchSections();
      toast({
        message: 'Note deleted',
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await send(
                '/api/planning-notes',
                'POST',
                { section_id: note.section_id, content: note.content, is_pinned: note.is_pinned, tags: note.tags },
                'Could not restore the note'
              );
              await fetchSections();
            } catch (err) {
              toast({ message: errText(err, 'Could not restore the note'), tone: 'error' });
            }
          },
        },
      });
    } catch (err) {
      toast({ message: errText(err, 'Could not delete the note'), tone: 'error' });
    }
  };

  const patchNoteLocally = (noteId: string, patch: Partial<PlanningNote>) =>
    setSections((list) => list.map((s) => ({ ...s, notes: s.notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)) })));

  const handleTogglePinNote = async (noteId: string, isPinned: boolean) => {
    const before = sectionsRef.current;
    patchNoteLocally(noteId, { is_pinned: isPinned });
    try {
      await send(`/api/planning-notes/${noteId}`, 'PATCH', { is_pinned: isPinned }, 'Could not update the note');
      toast({ message: isPinned ? 'Pinned to the top of its section' : 'Unpinned' });
    } catch (err) {
      setSections(before);
      toast({ message: errText(err, isPinned ? 'Could not pin the note' : 'Could not unpin the note'), tone: 'error' });
    }
  };

  const handleMoveNote = async (sectionId: string, noteId: string, dir: -1 | 1) => {
    const before = sectionsRef.current;
    const section = before.find((s) => s.id === sectionId);
    if (!section) return;
    const items = moveNote(section.notes, noteId, dir);
    if (!items) return;
    const order = new Map(items.map((i) => [i.id, i.display_order]));
    setSections((list) =>
      list.map((s) => (s.id === sectionId ? { ...s, notes: s.notes.map((n) => ({ ...n, display_order: order.get(n.id) ?? n.display_order })) } : s))
    );
    // Keep keyboard focus on the button that was pressed, now in its new row.
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>(`[data-note-id="${noteId}"] [data-move="${dir < 0 ? 'up' : 'down'}"]`);
      (btn && !btn.disabled ? btn : document.querySelector<HTMLButtonElement>(`[data-note-id="${noteId}"] button`))?.focus();
    });
    try {
      await send('/api/planning-notes/reorder', 'POST', { items }, 'Could not save the new order');
    } catch (err) {
      setSections(before);
      toast({ message: errText(err, 'Could not save the new order'), tone: 'error' });
    }
  };

  // ---- Import -------------------------------------------------------------

  const handleImport = async ({ sections: parsedSections }: { sections: ParsedSection[] }) => {
    setIsSaving(true);
    try {
      const sectionIdMap = new Map<string, string>();
      for (const parsed of parsedSections) {
        if (parsed.isNew) {
          const created = await send('/api/planning-sections', 'POST', { name: parsed.name }, `Could not create section: ${parsed.name}`);
          sectionIdMap.set(parsed.name, created.id);
        } else if (parsed.existingSectionId) {
          sectionIdMap.set(parsed.name, parsed.existingSectionId);
        }
      }
      const notesToImport = parsedSections.flatMap((parsed) => {
        const sectionId = sectionIdMap.get(parsed.name);
        return sectionId ? parsed.notes.map((content) => ({ section_id: sectionId, content })) : [];
      });
      if (notesToImport.length > 0) {
        await send('/api/planning-notes/bulk', 'POST', { notes: notesToImport }, 'Could not import the notes');
      }
      await fetchSections();
      toast({ message: `Imported ${notesToImport.length} note${notesToImport.length === 1 ? '' : 's'}`, tone: 'success' });
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Render -------------------------------------------------------------

  const active = sections.filter((s) => !s.is_archived);
  const archivedCount = sections.length - active.length;
  const totalNotes = active.reduce((sum, s) => sum + s.notes.length, 0);
  const pinnedNotes = active.reduce((sum, s) => sum + s.notes.filter((n) => n.is_pinned).length, 0);

  const intro =
    isLoading && sections.length === 0 ? (
      'Loading your notes...'
    ) : active.length === 0 ? (
      'Keep the assumptions, principles and decisions behind your plan in one place.'
    ) : (
      <>
        <strong className="fig">{totalNotes}</strong> note{totalNotes === 1 ? '' : 's'} in{' '}
        <strong className="fig">{active.length}</strong> section{active.length === 1 ? '' : 's'}
        {pinnedNotes > 0 && (
          <>
            , <strong className="fig">{pinnedNotes}</strong> pinned
          </>
        )}
        {showArchived && archivedCount > 0 && `, plus ${archivedCount} archived section${archivedCount === 1 ? '' : 's'}`}.
      </>
    );

  return (
    <div className="grid max-w-4xl gap-6">
      <PageIntro
        actions={
          <>
            <Button onClick={() => setIsImportOpen(true)}>Import text</Button>
            <Button variant="primary" onClick={() => setIsAddSectionOpen(true)}>
              New section
            </Button>
          </>
        }
      >
        {intro}
      </PageIntro>

      <PlanningFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showArchived={showArchived}
        onToggleArchived={() => setParam('archived', showArchived ? null : '1')}
      />

      {error && (
        <Notice tone="error" action={<Button size="sm" onClick={fetchSections}>Try again</Button>}>
          {error}.
        </Notice>
      )}

      {!error && (
        <PlanningSectionList
          sections={sections}
          searchQuery={searchQuery}
          isLoading={isLoading}
          onReorder={handleReorderSections}
          onAddNote={setAddNoteToSectionId}
          onEditSection={setEditingSection}
          onDeleteSection={setDeletingSection}
          onArchiveSection={(s) => setArchived(s, !s.is_archived, true)}
          onEditNote={setEditingNote}
          onDeleteNote={setDeletingNote}
          onTogglePinNote={handleTogglePinNote}
          onMoveNote={handleMoveNote}
          emptyAction={
            <Button variant="primary" onClick={() => setIsAddSectionOpen(true)}>
              New section
            </Button>
          }
        />
      )}

      <AddSectionDialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen} onSave={handleCreateSection} isLoading={isSaving} />
      <AddSectionDialog
        open={!!editingSection}
        onOpenChange={(open) => !open && setEditingSection(null)}
        section={editingSection}
        onSave={handleUpdateSection}
        isLoading={isSaving}
      />

      {deletingSection && (
        <ConfirmDialog
          isOpen
          title={deletingSection.notes.length > 0 ? 'This section still has notes' : `Delete "${deletingSection.name}"?`}
          message={
            deletingSection.notes.length > 0
              ? `"${deletingSection.name}" has ${deletingSection.notes.length} note${deletingSection.notes.length !== 1 ? 's' : ''}. Delete or move them first, or archive the section instead.`
              : 'The section will be removed. This cannot be undone.'
          }
          confirmLabel={deletingSection.notes.length > 0 ? 'OK' : 'Delete section'}
          variant={deletingSection.notes.length > 0 ? 'default' : 'danger'}
          onConfirm={deletingSection.notes.length > 0 ? () => setDeletingSection(null) : handleDeleteSection}
          onCancel={() => setDeletingSection(null)}
        />
      )}

      {deletingNote && (
        <ConfirmDialog
          isOpen
          title="Delete this note?"
          message={deletingNote.content.length > 140 ? `${deletingNote.content.slice(0, 140)}...` : deletingNote.content}
          confirmLabel="Delete note"
          variant="danger"
          onConfirm={handleDeleteNote}
          onCancel={() => setDeletingNote(null)}
        />
      )}

      <AddNoteDialog
        open={!!addNoteToSectionId}
        onOpenChange={(open) => !open && setAddNoteToSectionId(null)}
        sectionId={addNoteToSectionId}
        sections={sections}
        onSave={handleCreateNote}
        isLoading={isSaving}
      />
      <AddNoteDialog
        open={!!editingNote}
        onOpenChange={(open) => !open && setEditingNote(null)}
        note={editingNote}
        sections={sections}
        onSave={handleUpdateNote}
        isLoading={isSaving}
      />
      <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} sections={sections} onImport={handleImport} isLoading={isSaving} />
    </div>
  );
}
