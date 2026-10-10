import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { csvLine, isIsoDate, pages, stamp } from '@/lib/export';

export const dynamic = 'force-dynamic';

const HEADER = ['Date', 'Description', 'Amount', 'Account', 'Category', 'Needs review', 'Validated', 'Id'];

interface Row {
  id: string;
  date: string;
  description: string;
  amount: number;
  needs_review: boolean | null;
  is_validated: boolean;
  account: { name: string } | null;
  category: { name: string } | null;
}

/**
 * GET /api/export/transactions.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Streams every matching transaction as a CSV attachment, oldest first.
 */
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from') || null;
  const to = request.nextUrl.searchParams.get('to') || null;
  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) {
    return NextResponse.json({ error: 'Dates must be in YYYY-MM-DD format' }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ error: 'The start date is after the end date' }, { status: 400 });
  }

  const fetchPage = (start: number, end: number) => {
    let q = supabaseAdmin
      .from('transactions')
      .select('id, date, description, amount, needs_review, is_validated, account:accounts(name), category:categories(name)');
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);
    return q.order('date', { ascending: true }).order('id', { ascending: true }).range(start, end);
  };

  const iterator = pages(fetchPage);
  let first: IteratorResult<Record<string, unknown>[]>;
  try {
    // Read the first page before responding so a database error is a clean 500.
    first = await iterator.next();
  } catch (error) {
    console.error('GET /api/export/transactions.csv error:', error);
    return NextResponse.json({ error: 'Failed to export transactions' }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const toLines = (rows: Record<string, unknown>[]) =>
    (rows as unknown as Row[])
      .map((r) =>
        csvLine([
          r.date,
          r.description,
          Number(r.amount).toFixed(2),
          r.account?.name ?? '',
          r.category?.name ?? '',
          r.needs_review ? 'yes' : 'no',
          r.is_validated ? 'yes' : 'no',
          r.id,
        ])
      )
      .join('');

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('\uFEFF' + csvLine(HEADER)));
        if (!first.done) controller.enqueue(encoder.encode(toLines(first.value)));
        for await (const rows of iterator) controller.enqueue(encoder.encode(toLines(rows)));
        controller.close();
      } catch (error) {
        console.error('GET /api/export/transactions.csv stream error:', error);
        controller.error(error);
      }
    },
  });

  const range = from || to ? `-${from ?? 'start'}-to-${to ?? stamp()}` : `-${stamp()}`;
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions${range}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
