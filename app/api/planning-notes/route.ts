import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createPlanningNoteSchema } from '@/lib/validations/planning';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('section_id');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('planning_notes')
      .select('*, section:planning_sections(id, name, colour)')
      .order('display_order');

    if (sectionId) {
      query = query.eq('section_id', sectionId);
    }

    if (search) {
      query = query.ilike('content', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: data });
  } catch (error) {
    console.error('GET /api/planning-notes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createPlanningNoteSchema.parse(body);

    // Get max display_order for this section
    const { data: maxOrderData } = await supabaseAdmin
      .from('planning_notes')
      .select('display_order')
      .eq('section_id', validated.section_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from('planning_notes')
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
    console.error('POST /api/planning-notes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
