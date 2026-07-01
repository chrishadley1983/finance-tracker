import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { tlLinkAccountSchema, tlUnlinkAccountSchema } from '@/lib/validations/truelayer';
import type { TrueLayerAccount, TrueLayerCard } from '@/lib/truelayer';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

/** GET /api/truelayer/link?connection=<rowId> — TL accounts + finance accounts to map. */
export async function GET(request: NextRequest) {
  const connectionRowId = request.nextUrl.searchParams.get('connection');
  if (!connectionRowId) return NextResponse.json({ error: 'Missing connection id' }, { status: 400 });

  const { data: conn, error } = await supabaseAdmin
    .from('truelayer_connections')
    .select('id, provider_name, status, raw')
    .eq('id', connectionRowId)
    .single();
  if (error || !conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

  const raw = (conn.raw ?? {}) as { accounts?: TrueLayerAccount[]; cards?: TrueLayerCard[] };
  const tlAccounts = [
    ...(raw.accounts ?? []).map((a) => ({
      uid: a.account_id,
      name: a.display_name ?? 'Account',
      kind: 'account' as const,
      currency: a.currency,
      detail: a.account_number?.sort_code
        ? `${a.account_number.sort_code} ${a.account_number.number ?? ''}`.trim()
        : (a.account_number?.iban ?? null),
    })),
    ...(raw.cards ?? []).map((c) => ({
      uid: c.account_id,
      name: c.display_name ?? 'Card',
      kind: 'card' as const,
      currency: c.currency,
      detail: c.partial_card_number ? `•••• ${c.partial_card_number}` : null,
    })),
  ];

  const { data: financeAccounts } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type, truelayer_account_id')
    .order('sort_order', { ascending: true });

  return NextResponse.json({
    connection: { id: conn.id, provider: conn.provider_name, status: conn.status },
    tlAccounts,
    financeAccounts: financeAccounts ?? [],
  });
}

/** POST /api/truelayer/link — link a TL account to a finance account, enable sync. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionRowId, financeAccountId, truelayerAccountId } = tlLinkAccountSchema.parse(body);

    const { data: conn } = await supabaseAdmin
      .from('truelayer_connections')
      .select('id, status')
      .eq('id', connectionRowId)
      .single();
    if (!conn || conn.status !== 'active') {
      return NextResponse.json({ error: 'Connection is not active' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('accounts')
      .update({
        truelayer_account_id: truelayerAccountId,
        truelayer_connection_id: connectionRowId,
        sync_enabled: true,
      })
      .eq('id', financeAccountId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('POST /api/truelayer/link error:', error);
    return NextResponse.json({ error: 'Failed to link account' }, { status: 500 });
  }
}

/** DELETE /api/truelayer/link — unlink and disable sync. */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { financeAccountId } = tlUnlinkAccountSchema.parse(body);
    const { error } = await supabaseAdmin
      .from('accounts')
      .update({ truelayer_account_id: null, truelayer_connection_id: null, sync_enabled: false })
      .eq('id', financeAccountId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('DELETE /api/truelayer/link error:', error);
    return NextResponse.json({ error: 'Failed to unlink account' }, { status: 500 });
  }
}
