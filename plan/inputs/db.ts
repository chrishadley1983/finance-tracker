/**
 * The only place the plan tooling touches the database. Loads .env.local the
 * way Next does, then hands back the service-role client from lib/supabase/server.
 * Adapters take the client as an argument so they can be exercised with a stub.
 */
import { loadEnvConfig } from '@next/env';

export type Db = typeof import('../../lib/supabase/server')['supabaseAdmin'];

export async function getDb(): Promise<Db> {
  loadEnvConfig(process.cwd(), true);
  const mod = await import('../../lib/supabase/server');
  return mod.supabaseAdmin;
}

/** Page through a PostgREST query 1,000 rows at a time. */
export async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
