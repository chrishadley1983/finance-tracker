import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { EXPORT_TABLES, pages, stamp } from '@/lib/export';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export/all.json
 * Streams a JSON backup: { exportedAt, tables: { accounts: [...], ... } }.
 * Bank connection tokens and import/AI caches are not included.
 */
export async function GET() {
  // Check the database answers before committing to a 200 stream.
  const probe = await supabaseAdmin.from('accounts').select('id', { count: 'exact', head: true });
  if (probe.error) {
    console.error('GET /api/export/all.json error:', probe.error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        write(`{"exportedAt":${JSON.stringify(new Date().toISOString())},"tables":{`);
        for (let t = 0; t < EXPORT_TABLES.length; t++) {
          const table = EXPORT_TABLES[t];
          write(`${t ? ',' : ''}${JSON.stringify(table)}:[`);
          let n = 0;
          const iterator = pages((from, to) =>
            supabaseAdmin.from(table).select('*').order('id', { ascending: true }).range(from, to)
          );
          for await (const rows of iterator) {
            for (const row of rows) write(`${n++ ? ',' : ''}${JSON.stringify(row)}`);
          }
          write(']');
        }
        write('}}');
        controller.close();
      } catch (error) {
        console.error('GET /api/export/all.json stream error:', error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="finance-backup-${stamp()}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
