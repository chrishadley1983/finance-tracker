import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { updatePlanningSectionSchema } from '@/lib/validations/planning';
import { ZodError } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeNotes = searchParams.get('includeNotes') === 'true';

    // Fetch section
    const { data: section, error } = await supabaseAdmin
      .from('planning_sections')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch notes separately if requested
    if (includeNotes) {
      const { data: notes } = await supabaseAdmin
        .from('planning_notes')
        .select('*')
        .eq('section_id', id)
        .order('display_order');

      return NextResponse.json({ ...section, notes: notes || [] });
    }

    return NextResponse.json(section);
  } catch (error) {
    console.error('GET /api/planning-sections/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updatePlanningSectionSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from('planning_sections')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('PATCH /api/planning-sections/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if section has notes
    const { count } = await supabaseAdmin
      .from('planning_notes')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: 'Section has notes',
          message: `This section contains ${count} note${count !== 1 ? 's' : ''}. Delete or move them first, or archive the section instead.`,
          note_count: count,
        },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin
      .from('planning_sections')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/planning-sections/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
