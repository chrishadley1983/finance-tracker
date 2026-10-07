'use client';

import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, GripVertical, MoreHorizontal, Plus } from 'lucide-react';
import { PlanningNoteCard } from './PlanningNoteCard';
import { canMove, noteMatches, sortNotes } from './order';
import { Chip } from '@/components/ui/Chip';
import type { PlanningNote, PlanningSectionWithNotes } from '@/lib/validations/planning';

interface PlanningSectionProps {
  section: PlanningSectionWithNotes;
  searchQuery?: string;
  onAddNote: () => void;
  onEditSection: () => void;
  onDeleteSection: () => void;
  onArchiveSection: () => void;
  onEditNote: (note: PlanningNote) => void;
  onDeleteNote: (note: PlanningNote) => void;
  onTogglePinNote: (noteId: string, isPinned: boolean) => void;
  onMoveNote?: (sectionId: string, noteId: string, dir: -1 | 1) => void;
}

const menuItem = 'block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-sunk focus:bg-sunk focus:outline-none';

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
  onMoveNote,
}: PlanningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  useEffect(() => {
    if (!showMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showMenu]);

  const searching = Boolean(searchQuery?.trim());
  const sectionMatches =
    searching &&
    (section.name.toLowerCase().includes(searchQuery!.trim().toLowerCase()) ||
      Boolean(section.description?.toLowerCase().includes(searchQuery!.trim().toLowerCase())));
  const ordered = sortNotes(section.notes);
  const visible = searching && !sectionMatches ? ordered.filter((n) => noteMatches(n, searchQuery!)) : ordered;
  const noteCount = section.notes.length;
  const listId = `section-notes-${section.id}`;

  const run = (fn: () => void) => () => {
    setShowMenu(false);
    fn();
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={section.name}
      className={`border-t-[1.5px] border-ink ${isDragging ? 'relative z-10 bg-surface opacity-80 shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-1 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder section ${section.name}`}
          title="Drag to reorder (or focus and use the arrow keys)"
          className="mt-0.5 hidden h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-3 hover:text-ink active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-accent sm:inline-flex"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={listId}
          className="flex min-w-0 flex-1 items-start gap-1.5 rounded-md py-0.5 text-left focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronRight
            className={`mt-0.5 h-4 w-4 shrink-0 text-ink-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-[14px] font-semibold text-ink">
                {section.icon && <span className="mr-1" aria-hidden="true">{section.icon}</span>}
                {section.name}
              </h2>
              {section.year_label && <Chip>{section.year_label}</Chip>}
              {section.is_archived && <Chip tone="warn">Archived</Chip>}
            </span>
            {section.description && <span className="mt-0.5 block text-[13px] text-ink-3">{section.description}</span>}
          </span>
        </button>

        <span className="mt-1 shrink-0 text-xs text-ink-3">
          <span className="fig">{searching && visible.length !== noteCount ? `${visible.length} of ${noteCount}` : noteCount}</span>{' '}
          note{noteCount !== 1 ? 's' : ''}
        </span>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            aria-haspopup="menu"
            aria-expanded={showMenu}
            aria-label={`Actions for ${section.name}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          {showMenu && (
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-line bg-surface py-1 shadow-lg">
              <button type="button" role="menuitem" className={menuItem} onClick={run(onAddNote)}>
                Add note
              </button>
              <button type="button" role="menuitem" className={menuItem} onClick={run(onEditSection)}>
                Edit section
              </button>
              <button type="button" role="menuitem" className={menuItem} onClick={run(onArchiveSection)}>
                {section.is_archived ? 'Unarchive' : 'Archive'} section
              </button>
              <div className="my-1 border-t border-line-2" />
              <button type="button" role="menuitem" className={`${menuItem} text-bad`} onClick={run(onDeleteSection)}>
                Delete section
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div id={listId} className="pb-3 sm:pl-[3.25rem]">
          {visible.length > 0 ? (
            <ul aria-label={`Notes in ${section.name}`}>
              {visible.map((note) => {
                const moves = canMove(section.notes, note.id);
                return (
                  <PlanningNoteCard
                    key={note.id}
                    note={note}
                    onEdit={() => onEditNote(note)}
                    onDelete={() => onDeleteNote(note)}
                    onTogglePin={() => onTogglePinNote(note.id, !note.is_pinned)}
                    onMoveUp={!searching && onMoveNote ? () => onMoveNote(section.id, note.id, -1) : undefined}
                    onMoveDown={!searching && onMoveNote ? () => onMoveNote(section.id, note.id, 1) : undefined}
                    canMoveUp={moves.up}
                    canMoveDown={moves.down}
                    highlightText={searchQuery}
                  />
                );
              })}
            </ul>
          ) : (
            <p className="py-2 text-sm text-ink-3">{searching ? 'No notes in this section match your search.' : 'No notes in this section yet.'}</p>
          )}
          {!searching && (
            <button
              type="button"
              onClick={onAddNote}
              className="mt-1 inline-flex items-center gap-1 rounded-md px-1 py-1 text-[13px] text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add note
            </button>
          )}
        </div>
      )}
    </section>
  );
}
