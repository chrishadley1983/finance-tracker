import type { PlanningNote } from '@/lib/validations/planning';

/** Display order within a section: pinned notes first, then display_order, then oldest first. */
export function sortNotes<T extends Pick<PlanningNote, 'is_pinned' | 'display_order' | 'created_at'>>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });
}

/**
 * Move a note one place up (-1) or down (+1) within its section. Notes only
 * move within their own group (pinned or unpinned). Returns the full new
 * order as reorder items (display_order 0..n-1), or null if it can't move.
 */
export function moveNote(
  notes: PlanningNote[],
  noteId: string,
  dir: -1 | 1
): { id: string; display_order: number }[] | null {
  const ordered = sortNotes(notes);
  const i = ordered.findIndex((n) => n.id === noteId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ordered.length) return null;
  if (ordered[i].is_pinned !== ordered[j].is_pinned) return null;
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  return ordered.map((n, idx) => ({ id: n.id, display_order: idx }));
}

/** Whether a note can move up/down (used to disable the buttons). */
export function canMove(notes: PlanningNote[], noteId: string): { up: boolean; down: boolean } {
  return { up: moveNote(notes, noteId, -1) !== null, down: moveNote(notes, noteId, 1) !== null };
}

/** Case-insensitive match on note content and tags. */
export function noteMatches(note: Pick<PlanningNote, 'content' | 'tags'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return note.content.toLowerCase().includes(q) || (note.tags ?? []).some((t) => t.toLowerCase().includes(q));
}
