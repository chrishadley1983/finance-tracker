'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { PlanningSection } from './PlanningSection';
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
  onDeleteNote: (noteId: string) => void;
  onTogglePinNote: (noteId: string, isPinned: boolean) => void;
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
}: PlanningSectionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);

      // Calculate new order
      const reorderedSections = [...sections];
      const [movedSection] = reorderedSections.splice(oldIndex, 1);
      reorderedSections.splice(newIndex, 0, movedSection);

      // Create reorder items
      const items = reorderedSections.map((section, index) => ({
        id: section.id,
        display_order: index,
      }));

      onReorder(items);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="flex-1">
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
          No planning sections yet
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          Create sections to organize your financial planning notes and assumptions.
        </p>
      </div>
    );
  }

  // Filter sections based on search (show sections that have matching notes)
  const filteredSections = searchQuery
    ? sections.filter(
        (section) =>
          section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.notes.some((note) =>
            note.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : sections;

  if (searchQuery && filteredSections.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
          No results found
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          Try a different search term
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={filteredSections.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
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
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
