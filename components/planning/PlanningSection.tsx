'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlanningNoteCard } from './PlanningNoteCard';
import type { PlanningNote, PlanningSectionWithNotes } from '@/lib/validations/planning';

interface PlanningSectionProps {
  section: PlanningSectionWithNotes;
  searchQuery?: string;
  onAddNote: () => void;
  onEditSection: () => void;
  onDeleteSection: () => void;
  onArchiveSection: () => void;
  onEditNote: (note: PlanningNote) => void;
  onDeleteNote: (noteId: string) => void;
  onTogglePinNote: (noteId: string, isPinned: boolean) => void;
}

export function PlanningSection({
  section,
  searchQuery,
  onAddNote,
  onEditSection,
  onDeleteSection,
  onArchiveSection,
  onEditNote,
  onDeleteNote,
  onTogglePinNote,
}: PlanningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Filter and sort notes
  const filteredNotes = searchQuery
    ? section.notes.filter((n) =>
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : section.notes;

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    // Pinned first
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    // Then by display_order
    return a.display_order - b.display_order;
  });

  const noteCount = section.notes.length;
  const filteredCount = filteredNotes.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      {/* Section Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        style={{ borderLeft: `4px solid ${section.colour || '#6366f1'}` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>

          {/* Expand/collapse */}
          <button
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Icon and name */}
          {section.icon && <span className="text-xl">{section.icon}</span>}

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {section.name}
              </h3>
              {section.year_label && (
                <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                  {section.year_label}
                </span>
              )}
              {section.is_archived && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                  Archived
                </span>
              )}
            </div>
            {section.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {searchQuery && filteredCount !== noteCount
              ? `${filteredCount} of ${noteCount}`
              : noteCount}{' '}
            note{noteCount !== 1 ? 's' : ''}
          </span>

          {/* Action menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNote();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Add note
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSection();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Edit section
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveSection();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {section.is_archived ? 'Unarchive' : 'Archive'} section
                  </button>
                  <hr className="my-1 border-slate-200 dark:border-slate-700" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSection();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete section
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notes List */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          {sortedNotes.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {sortedNotes.map((note) => (
                <PlanningNoteCard
                  key={note.id}
                  note={note}
                  onEdit={() => onEditNote(note)}
                  onDelete={() => onDeleteNote(note.id)}
                  onTogglePin={() => onTogglePinNote(note.id, !note.is_pinned)}
                  highlightText={searchQuery}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
              {searchQuery ? (
                <p>No notes match your search</p>
              ) : (
                <>
                  <p>No notes in this section</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNote();
                    }}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Add your first note
                  </button>
                </>
              )}
            </div>
          )}

          {/* Add note button at bottom */}
          {sortedNotes.length > 0 && !searchQuery && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={onAddNote}
                className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded transition-colors"
              >
                + Add note
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
