import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isEnableBankingConfigured } from '@/lib/enable-banking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/enable-banking/status
 * Per-account Enable Banking link + sync status for the settings/sync UI.
 */
export async function GET() {
  try {
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select(
        'id, name, type, sync_enabled, last_sync_at, enable_banking_account_uid, enable_banking_session_id',
      )
      .order('sort_order', { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sessionIds = Array.from(
      new Set((accounts ?? []).map((a) => a.enable_banking_session_id).filter(Boolean) as string[]),
    );
    const sessionById = new Map<string, { valid_until: string; status: string; aspsp_name: string | null }>();
    if (sessionIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('enable_banking_sessions')
        .select('id, valid_until, status, aspsp_name')
        .in('id', sessionIds);
      for (const s of sessions ?? []) {
        sessionById.set(s.id, { valid_until: s.valid_until, status: s.status, aspsp_name: s.aspsp_name });
      }
    }

    const now = Date.now();
    const result = (accounts ?? []).map((a) => {
      const session = a.enable_banking_session_id ? sessionById.get(a.enable_banking_session_id) : undefined;
      const sessionValid = session ? session.status === 'active' && new Date(session.valid_until).getTime() > now : false;
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        linked: Boolean(a.enable_banking_account_uid),
        syncEnabled: a.sync_enabled,
        lastSyncAt: a.last_sync_at,
        aspsp: session?.aspsp_name ?? null,
        sessionValid,
        sessionValidUntil: session?.valid_until ?? null,
        needsReconsent: Boolean(a.enable_banking_account_uid) && !sessionValid,
      };
    });

    return NextResponse.json({ configured: isEnableBankingConfigured(), accounts: result });
  } catch (error) {
    console.error('GET /api/enable-banking/status error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
