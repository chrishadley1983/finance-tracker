import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createPlanningSectionSchema } from '@/lib/validations/planning';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const includeNotes = searchParams.get('includeNotes') === 'true';

    // Fetch sections
    let query = supabaseAdmin
      .from('planning_sections')
      .select('*')
      .order('display_order');

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data: sections, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch notes separately if requested
    if (includeNotes && sections && sections.length > 0) {
      const sectionIds = sections.map(s => s.id);
      const { data: notes } = await supabaseAdmin
        .from('planning_notes')
        .select('*')
        .in('section_id', sectionIds)
        .order('display_order');

      // Group notes by section_id
      const notesBySection = new Map<string, typeof notes>();
      for (const note of notes || []) {
        const existing = notesBySection.get(note.section_id) || [];
        existing.push(note);
        notesBySection.set(note.section_id, existing);
      }

      // Add notes to sections
      const sectionsWithNotes = sections.map(section => ({
        ...section,
        notes: notesBySection.get(section.id) || [],
      }));

      return NextResponse.json({ sections: sectionsWithNotes });
    }

    return NextResponse.json({ sections: sections || [] });
  } catch (error) {
    console.error('GET /api/planning-sections error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createPlanningSectionSchema.parse(body);

    // Get max display_order to add new section at the end
    const { data: maxOrderData } = await supabaseAdmin
      .from('planning_sections')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from('planning_sections')
      .insert({
        ...validated,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/planning-sections error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
