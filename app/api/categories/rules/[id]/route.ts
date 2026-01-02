import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRule, updateRule, deleteRule } from '@/lib/categorisation/rules-manager';

// =============================================================================
// SCHEMAS
// =============================================================================

const updateRuleSchema = z.object({
  pattern: z.string().min(1).max(500).optional(),
  categoryId: z.string().uuid().optional(),
  matchType: z.enum(['exact', 'contains', 'regex']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().max(1000).nullable().optional().transform(val => val === null ? undefined : val),
});

// =============================================================================
// GET /api/categories/rules/[id]
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const rule = await getRule(id);

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('GET /api/categories/rules/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// PATCH /api/categories/rules/[id]
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateRuleSchema.parse(body);

    // Check if rule exists
    const existing = await getRule(id);
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Prevent modification of system rules (except notes)
    if (existing.is_system) {
      const allowedFields = ['notes'];
      const attemptedFields = Object.keys(validated);
      const disallowedFields = attemptedFields.filter((f) => !allowedFields.includes(f));

      if (disallowedFields.length > 0) {
        return NextResponse.json(
          { error: 'Cannot modify system rule fields: ' + disallowedFields.join(', ') },
          { status: 403 }
        );
      }
    }

    const rule = await updateRule(id, validated);

    if (!rule) {
      return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('PATCH /api/categories/rules/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// DELETE /api/categories/rules/[id]
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if rule exists
    const existing = await getRule(id);
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Prevent deletion of system rules
    if (existing.is_system) {
      return NextResponse.json({ error: 'Cannot delete system rule' }, { status: 403 });
    }

    const success = await deleteRule(id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/categories/rules/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
