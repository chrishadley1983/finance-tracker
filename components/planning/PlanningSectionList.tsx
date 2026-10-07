'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PlanningSection } from './PlanningSection';
import { noteMatches } from './order';
import { EmptyState, SkeletonRows } from '@/components/ui/Notice';
import type { PlanningNote, PlanningSectionWithNotes } from '@/lib/validations/planning';

interface PlanningSectionListProps {
  sections: PlanningSectionWithNotes[];
  searchQuery?: string;
  isLoading?: boolean;
  onReorder: (items: { id: string; display_order: number }[]) => void;
  onAddNote: (sectionId: string) => void;
  onEditSection: (section: PlanningSectionWithNotes) => void;
  onDeleteSection: (section: PlanningSectionWithNotes) => void;
  onArchiveSection: (section: PlanningSectionWithNotes) => void;
  onEditNote: (note: PlanningNote) => void;
  onDeleteNote: (note: PlanningNote) => void;
  onTogglePinNote: (noteId: string, isPinned: boolean) => void;
  onMoveNote?: (sectionId: string, noteId: string, dir: -1 | 1) => void;
  /** Shown in the empty state (e.g. a "New section" button). */
  emptyAction?: React.ReactNode;
}

export function PlanningSectionList({
  sections,
  searchQuery,
  isLoading,
  onReorder,
  onAddNote,
  onEditSection,
  onDeleteSection,
  onArchiveSection,
  onEditNote,
  onDeleteNote,
  onTogglePinNote,
  onMoveNote,
  emptyAction,
}: PlanningSectionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const next = [...sections];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next.map((section, index) => ({ id: section.id, display_order: index })));
  };

  if (isLoading && sections.length === 0) {
    return (
      <div className="grid gap-8">
        {[0, 1].map((i) => (
          <div key={i} className="border-t-[1.5px] border-ink pt-3">
            <SkeletonRows rows={3} />
          </div>
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <EmptyState title="No notes yet" action={emptyAction}>
        Make a section for each topic (pensions, the house, this year&apos;s plan), then jot down the assumptions and decisions
        you want to remember.
      </EmptyState>
    );
  }

  const q = searchQuery?.trim().toLowerCase() ?? '';
  const filteredSections = q
    ? sections.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.notes.some((n) => noteMatches(n, q))
      )
    : sections;

  if (q && filteredSections.length === 0) {
    return <EmptyState title={`Nothing matches "${searchQuery?.trim()}"`}>Try a different word, or clear the search.</EmptyState>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={filteredSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className={`grid gap-6 ${isLoading ? 'opacity-60' : ''}`}>
          {filteredSections.map((section) => (
            <PlanningSection
              key={section.id}
              section={section}
              searchQuery={searchQuery}
              onAddNote={() => onAddNote(section.id)}
              onEditSection={() => onEditSection(section)}
              onDeleteSection={() => onDeleteSection(section)}
              onArchiveSection={() => onArchiveSection(section)}
              onEditNote={onEditNote}
              onDeleteNote={onDeleteNote}
              onTogglePinNote={onTogglePinNote}
              onMoveNote={onMoveNote}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
