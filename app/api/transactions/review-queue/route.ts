import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

interface ReviewQueueTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string;
  accountName: string;
  needsReview: boolean;
  createdAt: string;
}

interface ReviewQueueStats {
  total: number;
  uncategorised: number;
  flagged: number;
}

// =============================================================================
// GET - List transactions needing review with stats
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const filter = searchParams.get('filter') || 'all'; // 'all', 'uncategorised', 'flagged'

    // Build base query for review queue
    let query = supabaseAdmin
      .from('transactions')
      .select(`
        *,
        categories(name),
        accounts(name)
      `, { count: 'exact' });

    // Apply filter
    if (filter === 'uncategorised') {
      query = query.is('category_id', null);
    } else if (filter === 'flagged') {
      query = query.eq('needs_review', true);
    } else {
      // 'all' - show uncategorised OR flagged
      query = query.or('category_id.is.null,needs_review.eq.true');
    }

    // Get total count before pagination
    const countQuery = supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .or('category_id.is.null,needs_review.eq.true');

    const { count: totalCount } = await countQuery;

    // Get uncategorised count
    const { count: uncategorisedCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .is('category_id', null);

    // Get flagged count
    const { count: flaggedCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('needs_review', true);

    // Apply pagination and ordering
    const { data: transactions, error, count } = await query
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching review queue:', error);
      return NextResponse.json(
        { error: 'Failed to fetch review queue' },
        { status: 500 }
      );
    }

    const result: ReviewQueueTransaction[] = (transactions || []).map((t: TransactionRow & { categories: { name: string } | null; accounts: { name: string } | null }) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.amount >= 0 ? 'income' : 'expense',
      categoryId: t.category_id,
      categoryName: t.categories?.name || null,
      accountId: t.account_id,
      accountName: t.accounts?.name || 'Unknown',
      needsReview: t.needs_review,
      createdAt: t.created_at || '',
    }));

    const stats: ReviewQueueStats = {
      total: totalCount || 0,
      uncategorised: uncategorisedCount || 0,
      flagged: flaggedCount || 0,
    };

    return NextResponse.json({
      transactions: result,
      stats,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
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
      categoryId?: string;
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

    const updates: Record<string, unknown> = {};

    if (categoryId !== undefined) {
      // Verify category exists if provided
      if (categoryId !== null) {
        const { data: category, error: catError } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('id', categoryId)
          .single();

        if (catError || !category) {
          return NextResponse.json(
            { error: 'Category not found' },
            { status: 404 }
          );
        }
      }
      updates.category_id = categoryId;
      // When categorising, also clear the review flag
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
