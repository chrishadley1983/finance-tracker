import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { bulkImportNotesSchema } from '@/lib/validations/planning';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notes } = bulkImportNotesSchema.parse(body);

    if (notes.length === 0) {
      return NextResponse.json({ error: 'No notes to import' }, { status: 400 });
    }

    // Group notes by section to calculate display_order
    const notesBySection = new Map<string, typeof notes>();
    for (const note of notes) {
      const existing = notesBySection.get(note.section_id) || [];
      existing.push(note);
      notesBySection.set(note.section_id, existing);
    }

    // Get max display_order for each section
    const sectionIds = Array.from(notesBySection.keys());
    const { data: existingOrders } = await supabaseAdmin
      .from('planning_notes')
      .select('section_id, display_order')
      .in('section_id', sectionIds)
      .order('display_order', { ascending: false });

    // Build max order map
    const maxOrderMap = new Map<string, number>();
    for (const row of existingOrders || []) {
      if (!maxOrderMap.has(row.section_id)) {
        maxOrderMap.set(row.section_id, row.display_order);
      }
    }

    // Prepare notes with display_order
    const notesToInsert = [];
    for (const [sectionId, sectionNotes] of Array.from(notesBySection)) {
      let currentOrder = (maxOrderMap.get(sectionId) ?? -1) + 1;
      for (const note of sectionNotes) {
        notesToInsert.push({
          section_id: note.section_id,
          content: note.content,
          tags: note.tags || null,
          display_order: currentOrder++,
        });
      }
    }

    // Insert all notes
    const { data, error } = await supabaseAdmin
      .from('planning_notes')
      .insert(notesToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        imported: data?.length || 0,
        notes: data,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/planning-notes/bulk error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
