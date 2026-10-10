'use client';

import { ArrowDown, ArrowUp, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import type { PlanningNote } from '@/lib/validations/planning';
import { formatDateGB } from '@/lib/format';

interface PlanningNoteCardProps {
  note: PlanningNote;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  /** Move within the section; omitted while searching (order is not meaningful then). */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  highlightText?: string;
}

const iconButton =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30';

/** One note in a section list: text, tags and dates, with pin / move / edit / delete. */
export function PlanningNoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  highlightText,
}: PlanningNoteCardProps) {
  const renderContent = () => {
    const q = highlightText?.trim();
    if (!q) return note.content;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return note.content.split(regex).map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="rounded-sm bg-warn-soft px-0.5 text-ink">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const edited = note.updated_at !== note.created_at;
  const short = note.content.length > 40 ? `${note.content.slice(0, 40)}...` : note.content;

  return (
    <li
      data-note-id={note.id}
      className="group grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 border-b border-line-2 py-2.5 last:border-b-0 sm:grid-cols-[1rem_minmax(0,1fr)_auto]"
    >
      <span className="pt-1 text-ink-3" aria-hidden="true">
        {note.is_pinned ? <Pin className="h-3.5 w-3.5 text-ink-2" /> : <span className="ml-1 mt-1.5 block h-1 w-1 rounded-full bg-ink-3" />}
      </span>

      <div className="min-w-0">
        <p className="whitespace-pre-wrap break-words text-sm text-ink">
          {note.is_pinned && <span className="sr-only">Pinned: </span>}
          {renderContent()}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span>
            {edited ? 'Edited' : 'Added'} {formatDateGB(edited ? note.updated_at : note.created_at)}
          </span>
          {note.tags && note.tags.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <span key={tag} className="rounded bg-line-2 px-1.5 py-px text-[11.5px] text-ink-2">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="col-start-2 mt-1 flex items-center gap-0.5 sm:col-start-auto sm:mt-0 sm:self-start sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {onMoveUp && (
          <button type="button" data-move="up" className={iconButton} onClick={onMoveUp} disabled={!canMoveUp} aria-label={`Move up: ${short}`} title="Move up">
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            data-move="down"
            className={iconButton}
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move down: ${short}`}
            title="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className={iconButton}
          onClick={onTogglePin}
          aria-pressed={note.is_pinned}
          aria-label={`${note.is_pinned ? 'Unpin' : 'Pin'}: ${short}`}
          title={note.is_pinned ? 'Unpin' : 'Pin to top'}
        >
          {note.is_pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        <button type="button" className={iconButton} onClick={onEdit} aria-label={`Edit: ${short}`} title="Edit">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${iconButton} hover:text-bad`}
          onClick={onDelete}
          aria-label={`Delete: ${short}`}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
