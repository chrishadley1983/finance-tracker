import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { linkAccountSchema, unlinkAccountSchema } from '@/lib/validations/enable-banking';
import type { EnableBankingAccountRef } from '@/lib/enable-banking';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/enable-banking/link?session=<rowId>
 * Returns the EB accounts on a session plus our finance accounts, so the UI
 * can map one to the other.
 */
export async function GET(request: NextRequest) {
  const sessionRowId = request.nextUrl.searchParams.get('session');
  if (!sessionRowId) {
    return NextResponse.json({ error: 'Missing session id' }, { status: 400 });
  }
  const { data: session, error } = await supabaseAdmin
    .from('enable_banking_sessions')
    .select('id, aspsp_name, aspsp_country, status, valid_until, raw')
    .eq('id', sessionRowId)
    .single();
  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const raw = (session.raw ?? {}) as { accounts?: EnableBankingAccountRef[] };
  const ebAccounts = (raw.accounts ?? []).map((a) => ({
    uid: a.uid,
    name: a.name ?? a.product ?? 'Account',
    product: a.product ?? null,
    currency: a.currency ?? null,
    iban: a.account_id?.iban ?? null,
  }));

  const { data: financeAccounts } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type, enable_banking_account_uid')
    .order('sort_order', { ascending: true });

  return NextResponse.json({
    session: {
      id: session.id,
      aspsp: session.aspsp_name,
      country: session.aspsp_country,
      status: session.status,
      validUntil: session.valid_until,
    },
    ebAccounts,
    financeAccounts: financeAccounts ?? [],
  });
}

/**
 * POST /api/enable-banking/link
 * Links an EB account uid to one of our finance accounts and enables sync.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionRowId, financeAccountId, ebAccountUid } = linkAccountSchema.parse(body);

    // Ensure the session exists & is active.
    const { data: session } = await supabaseAdmin
      .from('enable_banking_sessions')
      .select('id, status')
      .eq('id', sessionRowId)
      .single();
    if (!session || session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('accounts')
      .update({
        enable_banking_account_uid: ebAccountUid,
        enable_banking_session_id: sessionRowId,
        sync_enabled: true,
      })
      .eq('id', financeAccountId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('POST /api/enable-banking/link error:', error);
    return NextResponse.json({ error: 'Failed to link account' }, { status: 500 });
  }
}

/** DELETE /api/enable-banking/link — unlink an account and disable sync. */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { financeAccountId } = unlinkAccountSchema.parse(body);
    const { error } = await supabaseAdmin
      .from('accounts')
      .update({ enable_banking_account_uid: null, enable_banking_session_id: null, sync_enabled: false })
      .eq('id', financeAccountId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('DELETE /api/enable-banking/link error:', error);
    return NextResponse.json({ error: 'Failed to unlink account' }, { status: 500 });
  }
}
