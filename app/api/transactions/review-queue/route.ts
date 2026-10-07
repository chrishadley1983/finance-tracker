import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { applyManualCategories, InvalidCategoryError } from '@/lib/categorisation/apply';
import { categoriseMultiple } from '@/lib/categorisation/engine';
import { merchantKey } from '@/lib/categorisation/normalise';
import { reasonFor, type ReviewRow, type Suggestion } from '@/lib/review/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ReviewQueueStats {
  total: number;
  uncategorised: number;
  flagged: number;
}

type Filter = 'all' | 'uncategorised' | 'flagged';

// =============================================================================
// GET - Transactions needing review, with a suggestion and reason for each
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
    const filter = (['all', 'uncategorised', 'flagged'].includes(searchParams.get('filter') ?? '')
      ? searchParams.get('filter')
      : 'all') as Filter;
    const search = (searchParams.get('search') || '').trim();

    let query = supabaseAdmin
      .from('transactions')
      .select(
        'id, date, description, amount, account_id, category_id, needs_review, is_validated, categorisation_source, categorisation_confidence, engine_source, categories(name), accounts(name)',
        { count: 'exact' }
      );
    if (filter === 'uncategorised') query = query.is('category_id', null);
    else if (filter === 'flagged') query = query.eq('needs_review', true).not('category_id', 'is', null);
    else query = query.or('category_id.is.null,needs_review.eq.true');
    if (search) query = query.ilike('description', `%${search.replace(/[%_]/g, '')}%`);

    const head = () => supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true });
    const [list, total, uncategorised, flagged] = await Promise.all([
      query.order('date', { ascending: false }).range(offset, offset + limit - 1),
      head().or('category_id.is.null,needs_review.eq.true'),
      head().is('category_id', null),
      head().eq('needs_review', true).not('category_id', 'is', null),
    ]);
    if (list.error) {
      console.error('Error fetching review queue:', list.error);
      return NextResponse.json({ error: 'Failed to fetch review queue' }, { status: 500 });
    }

    type Row = {
      id: string;
      date: string;
      description: string;
      amount: number;
      account_id: string;
      category_id: string | null;
      needs_review: boolean | null;
      is_validated: boolean;
      categorisation_source: 'manual' | 'rule' | 'ai' | 'import';
      categorisation_confidence: number | null;
      engine_source: string | null;
      categories: { name: string } | null;
      accounts: { name: string } | null;
    };
    const rows = (list.data ?? []) as unknown as Row[];

    // Suggestions for uncategorised rows from rules and past transactions only:
    // no AI calls, so opening the queue never costs anything.
    const uncat = rows.filter((r) => !r.category_id);
    const engine = uncat.length
      ? await categoriseMultiple(
          uncat.map((r) => ({ date: r.date, description: r.description, amount: r.amount, accountId: r.account_id })),
          { allowAI: false }
        ).catch((e) => {
          console.warn('Review queue suggestions failed:', e);
          return [];
        })
      : [];
    const suggested = new Map<string, Suggestion>();
    uncat.forEach((r, i) => {
      const s = engine[i];
      if (s?.categoryId) {
        suggested.set(r.id, {
          categoryId: s.categoryId,
          categoryName: s.categoryName ?? 'Unknown',
          confidence: s.confidence ?? null,
          source: s.source ?? null,
        });
      }
    });

    const transactions: ReviewRow[] = rows.map((t) => {
      const suggestion: Suggestion | null = t.category_id
        ? {
            categoryId: t.category_id,
            categoryName: t.categories?.name ?? 'Unknown',
            confidence: t.categorisation_confidence,
            source: t.engine_source,
          }
        : suggested.get(t.id) ?? null;
      const base = {
        id: t.id,
        date: t.date,
        description: t.description,
        amount: Number(t.amount),
        accountId: t.account_id,
        accountName: t.accounts?.name ?? 'Unknown',
        categoryId: t.category_id,
        categoryName: t.categories?.name ?? null,
        needsReview: t.needs_review ?? false,
        isValidated: t.is_validated ?? false,
        categorisationSource: t.categorisation_source,
        confidence: t.categorisation_confidence,
        engineSource: t.engine_source,
        merchant: merchantKey(t.description) || t.description.toLowerCase().trim(),
        suggestion,
      };
      return { ...base, reason: reasonFor(base) };
    });

    const stats: ReviewQueueStats = {
      total: total.count ?? 0,
      uncategorised: uncategorised.count ?? 0,
      flagged: flagged.count ?? 0,
    };

    return NextResponse.json({ transactions, stats, total: list.count ?? 0, limit, offset });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Bulk update transactions (categorise or clear flag)
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionIds, categoryId, clearFlag } = body as {
      transactionIds: string[];
      categoryId?: string | null;
      clearFlag?: boolean;
    };

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'transactionIds array is required' },
        { status: 400 }
      );
    }

    if (transactionIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 transactions per batch' },
        { status: 400 }
      );
    }

    // Categorising is a human decision: shared path (manual source, review
    // flag cleared, corrections recorded for the learning loop).
    if (categoryId) {
      try {
        const [result] = await applyManualCategories([{ transactionIds, categoryId }]);
        return NextResponse.json({ updated: result.applied });
      } catch (e) {
        if (e instanceof InvalidCategoryError) {
          return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }
        throw e;
      }
    }

    const updates: Record<string, unknown> = {};
    if (categoryId === null) {
      // Explicitly uncategorised by hand.
      updates.category_id = null;
      updates.categorisation_source = 'manual';
      updates.needs_review = false;
    }
    if (clearFlag === true) {
      updates.needs_review = false;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from('transactions')
      .update(updates)
      .in('id', transactionIds)
      .select('id');

    if (error) {
      console.error('Error updating transactions:', error);
      return NextResponse.json(
        { error: 'Failed to update transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      updated: updated?.length || 0,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
