/**
 * Minimal in-memory stand-in for the supabase-js query builder, enough for
 * the categorisation modules' queries: select (with simple embedded
 * category joins), insert, update, delete, eq/neq/in/is/not/gte/gt/lt/lte,
 * order, range, limit, single, head counts and rpc.
 *
 *   const db = createFakeSupabase({ transactions: [...], categories: [...] });
 *   vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: db.client }));
 */

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

let idCounter = 0;
export function fakeId(prefix = 'id'): string {
  idCounter++;
  return `${prefix}-${String(idCounter).padStart(6, '0')}`;
}

function parseSelect(spec: string): { cols: string[] | null; embeds: { alias: string; fk: string; cols: string[] }[] } {
  const embeds: { alias: string; fk: string; cols: string[] }[] = [];
  const stripped = spec.replace(/([a-z_]+)(?::([a-z_]+))?\s*\(([^)]*)\)/gi, (_m, a: string, b: string | undefined, inner: string) => {
    const alias = a;
    const target = b ?? a;
    const fk = target === 'categories' ? 'category_id' : target === 'account' || target === 'accounts' ? 'account_id' : target;
    embeds.push({ alias, fk, cols: inner.split(',').map((c) => c.trim()).filter(Boolean) });
    return '';
  });
  const cols = stripped
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  return { cols: cols.includes('*') || cols.length === 0 ? null : cols, embeds };
}

export function createFakeSupabase(initial: Record<string, Row[]> = {}, rpcs: Record<string, (args: Row) => unknown> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(initial)) tables[k] = v.map((r) => ({ ...r }));
  const table = (name: string) => (tables[name] ??= []);

  function project(name: string, row: Row, spec: string | undefined): Row {
    if (!spec) return { ...row };
    const { cols, embeds } = parseSelect(spec);
    const out: Row = {};
    if (cols === null) Object.assign(out, row);
    else for (const c of cols) out[c] = row[c];
    for (const e of embeds) {
      const fkVal = row[e.fk];
      const targetTable = e.fk === 'account_id' ? 'accounts' : 'categories';
      const target = table(targetTable).find((t) => t.id === fkVal);
      if (!target) out[e.alias] = null;
      else {
        const o: Row = {};
        for (const c of e.cols) o[c] = target[c];
        out[e.alias] = o;
      }
    }
    void name;
    return out;
  }

  function builder(name: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
    let conflictCols: string[] = [];
    let selectSpec: string | undefined;
    let returning = false;
    let payload: Row | Row[] | null = null;
    let head = false;
    let wantCount = false;
    let single = false;
    const filters: Filter[] = [];
    let sorter: ((a: Row, b: Row) => number) | null = null;
    let from = 0;
    let to = Infinity;

    const cmp = (a: unknown, b: unknown) => (a === b ? 0 : (a as never) < (b as never) ? -1 : 1);

    const exec = () => {
      const rows = table(name);
      if (op === 'insert') {
        const list = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({
          id: r.id ?? fakeId(name),
          created_at: r.created_at ?? new Date().toISOString(),
          ...r,
        }));
        rows.push(...list);
        const data = returning ? list.map((r) => project(name, r, selectSpec)) : null;
        return { data: single ? data?.[0] ?? null : data, error: null, count: list.length };
      }
      if (op === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload!];
        const out: Row[] = [];
        for (const r of list) {
          const hit = conflictCols.length > 0 ? rows.find((x) => conflictCols.every((c) => x[c] === r[c])) : undefined;
          if (hit) {
            Object.assign(hit, r);
            out.push(hit);
          } else {
            const row = { id: r.id ?? fakeId(name), created_at: r.created_at ?? new Date().toISOString(), ...r };
            rows.push(row);
            out.push(row);
          }
        }
        const data = returning ? out.map((r) => project(name, r, selectSpec)) : null;
        return { data: single ? data?.[0] ?? null : data, error: null, count: out.length };
      }
      let matched = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        for (const r of matched) Object.assign(r, payload);
        const data = returning ? matched.map((r) => project(name, r, selectSpec)) : null;
        return { data: single ? data?.[0] ?? null : data, error: null, count: matched.length };
      }
      if (op === 'delete') {
        tables[name] = rows.filter((r) => !matched.includes(r));
        return { data: null, error: null, count: matched.length };
      }
      if (sorter) matched = [...matched].sort(sorter);
      const count = matched.length;
      const page = matched.slice(from, to === Infinity ? undefined : to + 1);
      if (head) return { data: null, error: null, count };
      const data = page.map((r) => project(name, r, selectSpec));
      if (single) {
        return data.length === 1
          ? { data: data[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'not found' } };
      }
      return { data, error: null, count: wantCount ? count : null };
    };

    const b = {
      select(spec?: string, opts?: { count?: string; head?: boolean }) {
        if (op === 'select') selectSpec = spec;
        else {
          returning = true;
          selectSpec = spec;
        }
        if (opts?.head) head = true;
        if (opts?.count) wantCount = true;
        return b;
      },
      insert(rows: Row | Row[]) {
        op = 'insert';
        payload = rows;
        return b;
      },
      upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
        op = 'upsert';
        payload = rows;
        conflictCols = (opts?.onConflict ?? '').split(',').map((c) => c.trim()).filter(Boolean);
        return b;
      },
      update(values: Row) {
        op = 'update';
        payload = values;
        return b;
      },
      delete() {
        op = 'delete';
        return b;
      },
      eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return b; },
      neq(c: string, v: unknown) { filters.push((r) => r[c] !== v && r[c] !== null && r[c] !== undefined); return b; },
      in(c: string, vs: unknown[]) { filters.push((r) => vs.includes(r[c])); return b; },
      /** PostgREST or(): comma-separated `col.is.null` / `col.eq.value` terms. */
      or(spec: string) {
        const terms = spec.split(',').map((t) => {
          const [col, op, ...rest] = t.split('.');
          const val = rest.join('.');
          return (r: Row) =>
            op === 'is' && val === 'null'
              ? r[col] === null || r[col] === undefined
              : op === 'eq'
                ? String(r[col]) === val
                : false;
        });
        filters.push((r) => terms.some((f) => f(r)));
        return b;
      },
      ilike(c: string, pattern: string) {
        const re = new RegExp(`^${pattern.split('%').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i');
        filters.push((r) => re.test(String(r[c] ?? '')));
        return b;
      },
      is(c: string, v: unknown) { filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)); return b; },
      not(c: string, o: string, v: unknown) {
        if (o === 'is') filters.push((r) => (v === null ? r[c] !== null && r[c] !== undefined : r[c] !== v));
        else if (o === 'eq') filters.push((r) => r[c] !== v);
        return b;
      },
      gte(c: string, v: unknown) { filters.push((r) => r[c] !== null && r[c] !== undefined && cmp(r[c], v) >= 0); return b; },
      gt(c: string, v: unknown) { filters.push((r) => r[c] !== null && r[c] !== undefined && cmp(r[c], v) > 0); return b; },
      lte(c: string, v: unknown) { filters.push((r) => r[c] !== null && r[c] !== undefined && cmp(r[c], v) <= 0); return b; },
      lt(c: string, v: unknown) { filters.push((r) => r[c] !== null && r[c] !== undefined && cmp(r[c], v) < 0); return b; },
      order(c: string, opts?: { ascending?: boolean }) {
        const dir = opts?.ascending === false ? -1 : 1;
        sorter = (a, z) => dir * cmp(a[c], z[c]);
        return b;
      },
      range(f: number, t: number) { from = f; to = t; return b; },
      limit(n: number) { to = from + n - 1; return b; },
      single() { single = true; return b; },
      maybeSingle() { single = true; return b; },
      then<T>(resolve: (v: ReturnType<typeof exec>) => T, reject?: (e: unknown) => T) {
        try {
          return Promise.resolve(resolve(exec()));
        } catch (e) {
          return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
        }
      },
    };
    return b;
  }

  const client = {
    from: (name: string) => builder(name),
    rpc: async (fn: string, args: Row) => {
      const impl = rpcs[fn];
      if (!impl) return { data: null, error: { message: `rpc ${fn} not faked` } };
      return { data: impl(args), error: null };
    },
  };

  return { client, tables, table };
}
