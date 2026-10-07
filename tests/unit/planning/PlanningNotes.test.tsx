import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { moveNote, sortNotes, canMove, noteMatches } from '@/components/planning/order';
import type { PlanningNote, PlanningSectionWithNotes } from '@/lib/validations/planning';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/planning',
  useSearchParams: () => search,
}));

import { PlanningNotes } from '@/components/planning/PlanningNotes';

const S1 = '10000000-0000-4000-8000-000000000001';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const note = (n: number, order: number, extra: Partial<PlanningNote> = {}): PlanningNote => ({
  id: id(n),
  section_id: S1,
  content: `Note ${n}`,
  display_order: order,
  is_pinned: false,
  tags: null,
  created_at: '2026-03-01T10:00:00.000Z',
  updated_at: '2026-03-01T10:00:00.000Z',
  ...extra,
});
const section = (notes: PlanningNote[]): PlanningSectionWithNotes => ({
  id: S1,
  name: 'Principles',
  description: null,
  year_label: null,
  colour: '#14b8a6',
  icon: null,
  display_order: 0,
  is_archived: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  notes,
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

type Handler = (url: string, init?: RequestInit) => { ok: boolean; body: unknown } | undefined;
function serve(sections: PlanningSectionWithNotes[], handler: Handler = () => undefined) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const custom = handler(url, init);
    if (custom) return { ok: custom.ok, json: async () => custom.body };
    if (url.startsWith('/api/planning-sections?')) return { ok: true, json: async () => ({ sections }) };
    return { ok: true, json: async () => ({ success: true }) };
  });
}

const renderPage = () =>
  render(
    <ToastProvider>
      <PlanningNotes />
    </ToastProvider>
  );

const rowText = () =>
  within(screen.getByRole('list', { name: 'Notes in Principles' }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('p')?.textContent);

describe('note ordering helpers', () => {
  const notes = [note(1, 0), note(2, 1, { is_pinned: true }), note(3, 2), note(4, 3)];

  it('sorts pinned notes first, then by display order', () => {
    expect(sortNotes(notes).map((n) => n.content)).toEqual(['Note 2', 'Note 1', 'Note 3', 'Note 4']);
  });

  it('moves a note within its group and renumbers the section', () => {
    expect(moveNote(notes, id(3), -1)).toEqual([
      { id: id(2), display_order: 0 },
      { id: id(3), display_order: 1 },
      { id: id(1), display_order: 2 },
      { id: id(4), display_order: 3 },
    ]);
  });

  it('will not move a note across the pinned boundary or off the ends', () => {
    expect(moveNote(notes, id(1), -1)).toBeNull();
    expect(moveNote(notes, id(4), 1)).toBeNull();
    expect(canMove(notes, id(1))).toEqual({ up: false, down: true });
  });

  it('matches content and tags case-insensitively', () => {
    expect(noteMatches({ content: 'Fill both ISAs', tags: null }, 'isa')).toBe(true);
    expect(noteMatches({ content: 'x', tags: ['Pension'] }, 'pens')).toBe(true);
    expect(noteMatches({ content: 'x', tags: null }, 'pens')).toBe(false);
  });
});

describe('PlanningNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = new URLSearchParams();
  });
  afterEach(cleanup);

  it('opens with a summary sentence and the notes grouped by section', async () => {
    serve([section([note(1, 0), note(2, 1, { is_pinned: true })])]);
    renderPage();
    expect(await screen.findByText('Principles')).toBeInTheDocument();
    expect(screen.getByText(/notes? in/)).toHaveTextContent('2 notes in 1 section, 1 pinned.');
    expect(rowText()).toEqual(['Pinned: Note 2', 'Note 1']);
  });

  it('moves a note down and saves the new order through the reorder API', async () => {
    serve([section([note(1, 0), note(2, 1), note(3, 2)])]);
    renderPage();
    await screen.findByText('Note 1');

    fireEvent.click(screen.getByRole('button', { name: 'Move down: Note 1' }));

    expect(rowText()).toEqual(['Note 2', 'Note 1', 'Note 3']);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/planning-notes/reorder', expect.objectContaining({ method: 'POST' })));
    const call = mockFetch.mock.calls.find((c) => c[0] === '/api/planning-notes/reorder')!;
    expect(JSON.parse(call[1].body)).toEqual({
      items: [
        { id: id(2), display_order: 0 },
        { id: id(1), display_order: 1 },
        { id: id(3), display_order: 2 },
      ],
    });
    // First note can't move up; last can't move down.
    expect(screen.getByRole('button', { name: 'Move up: Note 2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move down: Note 3' })).toBeDisabled();
  });

  it('puts the order back and shows a toast when the reorder fails', async () => {
    serve([section([note(1, 0), note(2, 1)])], (url) =>
      url === '/api/planning-notes/reorder' ? { ok: false, body: { error: 'Failed to reorder some notes' } } : undefined
    );
    renderPage();
    await screen.findByText('Note 1');
    fireEvent.click(screen.getByRole('button', { name: 'Move up: Note 2' }));

    expect(await screen.findByText('Failed to reorder some notes')).toBeInTheDocument();
    expect(rowText()).toEqual(['Note 1', 'Note 2']);
  });

  it('hides the move buttons while searching', async () => {
    search = new URLSearchParams('q=Note 1');
    serve([section([note(1, 0), note(2, 1)])]);
    renderPage();
    await screen.findByRole('list', { name: 'Notes in Principles' });
    expect(screen.queryByRole('button', { name: /^Move/ })).not.toBeInTheDocument();
    expect(rowText()).toEqual(['Note 1']);
  });

  it('shows pin failures as an error toast and reverts', async () => {
    serve([section([note(1, 0)])], (url, init) =>
      url === `/api/planning-notes/${id(1)}` && init?.method === 'PATCH' ? { ok: false, body: { error: 'Database unavailable' } } : undefined
    );
    renderPage();
    await screen.findByText('Note 1');
    fireEvent.click(screen.getByRole('button', { name: 'Pin: Note 1' }));
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin: Note 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('confirms in-app before deleting, then offers Undo', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    serve([section([note(1, 0)])]);
    renderPage();
    await screen.findByText('Note 1');

    fireEvent.click(screen.getByRole('button', { name: 'Delete: Note 1' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Delete this note?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete note' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(`/api/planning-notes/${id(1)}`, expect.objectContaining({ method: 'DELETE' })));
    expect(await screen.findByText('Note deleted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('shows delete failures as an error toast', async () => {
    serve([section([note(1, 0)])], (url, init) =>
      init?.method === 'DELETE' ? { ok: false, body: { error: 'Could not delete the note' } } : undefined
    );
    renderPage();
    await screen.findByText('Note 1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Note 1' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete note' }));
    expect(await screen.findByText('Could not delete the note')).toBeInTheDocument();
  });

  it('keeps the archived toggle in the URL', async () => {
    serve([section([])]);
    renderPage();
    await screen.findByText('Principles');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived sections' }));
    expect(replace).toHaveBeenCalledWith('/planning?archived=1', { scroll: false });
  });

  it('shows an empty state with a way to start', async () => {
    serve([]);
    renderPage();
    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New section' }).length).toBeGreaterThan(0);
  });
});
