import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isTrueLayerConfigured } from '@/lib/truelayer';

export const dynamic = 'force-dynamic';

/** GET /api/truelayer/status — per-account TrueLayer link + sync status. */
export async function GET() {
  try {
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type, sync_enabled, last_sync_at, truelayer_account_id, truelayer_connection_id')
      .order('sort_order', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const connIds = Array.from(
      new Set((accounts ?? []).map((a) => a.truelayer_connection_id).filter(Boolean) as string[]),
    );
    const connById = new Map<string, { status: string; provider_name: string | null }>();
    if (connIds.length > 0) {
      const { data: conns } = await supabaseAdmin
        .from('truelayer_connections')
        .select('id, status, provider_name')
        .in('id', connIds);
      for (const c of conns ?? []) connById.set(c.id, { status: c.status, provider_name: c.provider_name });
    }

    const result = (accounts ?? []).map((a) => {
      const conn = a.truelayer_connection_id ? connById.get(a.truelayer_connection_id) : undefined;
      const active = conn?.status === 'active';
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        linked: Boolean(a.truelayer_account_id),
        syncEnabled: a.sync_enabled,
        lastSyncAt: a.last_sync_at,
        provider: conn?.provider_name ?? null,
        connectionActive: active,
        needsReconsent: Boolean(a.truelayer_account_id) && !active,
      };
    });

    return NextResponse.json({ configured: isTrueLayerConfigured(), accounts: result });
  } catch (error) {
    console.error('GET /api/truelayer/status error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
