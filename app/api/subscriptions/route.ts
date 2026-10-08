import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { subscriptionSchema } from '@/lib/validations/subscriptions';
import {
  addDays,
  assessSubscription,
  cleanPattern,
  findUntracked,
  likePattern,
  summarise,
  type Charge,
  type SubscriptionRow,
  ukToday,
} from '@/lib/subscriptions/analysis';

export const dynamic = 'force-dynamic';

/** How far back to look for a subscription's charges (covers annual billing). */
const CHARGE_LOOKBACK_DAYS = 400;
/** How far back to look for repeating outgoings that nothing tracks. */
const UNTRACKED_LOOKBACK_DAYS = 180;
/** Enough for a weekly subscription's full lookback, so variable-amount 12-month totals are complete. */
const CHARGES_PER_SUBSCRIPTION = 60;
const PAGE = 1000;
const PARALLEL = 8;

async function chargesFor(pattern: string, since: string): Promise<Charge[]> {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('date, amount, description')
    .ilike('description', `%${likePattern(pattern)}%`)
    .lt('amount', 0)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(CHARGES_PER_SUBSCRIPTION);
  if (error) throw new Error(`charges for "${pattern}": ${error.message}`);
  return (data ?? []).map((t) => ({ date: t.date, amount: Number(t.amount), description: t.description }));
}

async function outgoingSince(since: string): Promise<Charge[]> {
  const rows: Charge[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('date, amount, description')
      .lt('amount', 0)
      .gte('date', since)
      .order('date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`outgoing transactions: ${error.message}`);
    const page = data ?? [];
    rows.push(...page.map((t) => ({ date: t.date, amount: Number(t.amount), description: t.description })));
    if (page.length < PAGE) return rows;
  }
}

/**
 * GET /api/subscriptions
 * Every subscription with its cost, last real charge and any problems found in the bank data,
 * plus repeating outgoings that look like untracked subscriptions.
 */
export async function GET() {
  try {
    const today = ukToday();

    const { data: subs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (subs ?? []) as SubscriptionRow[];
    const chargeSince = addDays(today, -CHARGE_LOOKBACK_DAYS);

    const charges = new Map<string, Charge[]>();
    for (let i = 0; i < rows.length; i += PARALLEL) {
      await Promise.all(
        rows.slice(i, i + PARALLEL).map(async (s) => {
          const pattern = cleanPattern(s.bank_description_pattern);
          charges.set(s.id, pattern ? await chargesFor(pattern, chargeSince) : []);
        }),
      );
    }

    const assessed = rows.map((s) => assessSubscription(s, charges.get(s.id) ?? [], today));

    const [outgoing, exclusions] = await Promise.all([
      outgoingSince(addDays(today, -UNTRACKED_LOOKBACK_DAYS)),
      supabaseAdmin.from('subscription_exclusions').select('description_pattern'),
    ]);
    if (exclusions.error) throw new Error(`exclusions: ${exclusions.error.message}`);

    const tracked = rows
      .map((s) => cleanPattern(s.bank_description_pattern))
      .filter((p): p is string => p !== null);
    const untracked = findUntracked(
      outgoing,
      tracked,
      (exclusions.data ?? []).map((e) => e.description_pattern),
    );

    return NextResponse.json({
      as_of: today,
      subscriptions: assessed,
      summary: summarise(assessed),
      untracked,
    });
  } catch (err) {
    console.error('Error in GET /api/subscriptions:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/subscriptions
 * Add a subscription.
 */
export async function POST(request: NextRequest) {
  try {
    const body = subscriptionSchema.parse(await request.json());
    const { data, error } = await supabaseAdmin.from('subscriptions').insert(body).select().single();
    if (error) {
      console.error('Error creating subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    console.error('Error in POST /api/subscriptions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
