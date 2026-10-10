// @ts-check
/**
 * Loader for plan/assumptions.json — the single home for planning numbers.
 *
 * Pure: takes the parsed JSON, returns a nested value object plus a report.
 * No filesystem access here, so the same module runs in Node scripts, vitest,
 * and the Next.js bundle (which imports the JSON directly). Node callers use
 * `readAssumptionsFile()` at the bottom.
 *
 * Rules enforced (see plan/README.md):
 *  - every non-DERIVED entry has value, status, source, asOf, reviewBy
 *  - DERIVED entries carry a formula only; the loader computes the value and a
 *    hand-typed value is rejected outright — this is what kills the
 *    "hard-coded derivative drifts from its inputs" class of error
 *  - keys are dotted paths; the loader builds the nested object
 *  - freshness: anything past reviewBy is reported (AMBER ≤ 90 days, RED after)
 */

const STATUSES = new Set(['FACT', 'CHECK', 'GUESS', 'DECISION', 'DERIVED']);
const CADENCES = new Set(['monthly', 'quarterly', 'tax-year', 'annual', 'event', 'none']);
const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_OR_DATE_RE = /^\d{4}-\d{2}(-\d{2})?$/;

/**
 * @typedef {{ value?: unknown, unit?: string, status: string, source?: string, asOf?: string,
 *   reviewBy?: string, cadence?: string, triggers?: string[], formula?: string,
 *   derivedBy?: 'loader'|'engine', note?: string, history?: Array<{value: unknown, asOf: string, supersededOn: string, why?: string}> }} Entry
 * @typedef {{ schemaVersion: number, preparedOn: string, moneyBasis?: string, entries: Record<string, Entry>,
 *   knownLimitations: Array<{id: string, text: string, raised: string, fixBy?: string, impact?: string}> }} AssumptionsFile
 * @typedef {{ key: string, message: string }} Problem
 * @typedef {{ key: string, reviewBy: string, daysOver: number, level: 'AMBER'|'RED', status: string }} Stale
 */

/** Validate structure (a hand-rolled subset of the JSON Schema, so no dependency). */
export function validateAssumptions(/** @type {AssumptionsFile} */ file) {
  /** @type {Problem[]} */
  const problems = [];
  const bad = (/** @type {string} */ key, /** @type {string} */ message) => problems.push({ key, message });
  if (!file || typeof file !== 'object') return [{ key: '$', message: 'not an object' }];
  if (file.schemaVersion !== 1) bad('$.schemaVersion', 'must be 1');
  if (!DATE_RE.test(String(file.preparedOn))) bad('$.preparedOn', 'must be YYYY-MM-DD');
  if (!file.entries || typeof file.entries !== 'object') return [...problems, { key: '$.entries', message: 'missing' }];
  if (!Array.isArray(file.knownLimitations)) bad('$.knownLimitations', 'must be an array');
  for (const [key, e] of Object.entries(file.entries)) {
    if (!KEY_RE.test(key)) bad(key, 'key must be dotted lowerCamel segments');
    if (!e || typeof e !== 'object') { bad(key, 'entry must be an object'); continue; }
    if (!STATUSES.has(e.status)) bad(key, `status must be one of ${Array.from(STATUSES).join('/')}`);
    if (e.cadence !== undefined && !CADENCES.has(e.cadence)) bad(key, `cadence must be one of ${Array.from(CADENCES).join('/')}`);
    if (e.status === 'DERIVED') {
      if (typeof e.formula !== 'string' || !e.formula.trim()) bad(key, 'DERIVED needs a formula');
      if ('value' in e) bad(key, 'DERIVED must not carry a hand-typed value');
      if (e.derivedBy !== undefined && e.derivedBy !== 'loader' && e.derivedBy !== 'engine') bad(key, "derivedBy must be 'loader' or 'engine'");
    } else {
      if (!('value' in e)) bad(key, 'value is required');
      if (typeof e.source !== 'string' || e.source.length < 3) bad(key, 'source is required');
      if (!MONTH_OR_DATE_RE.test(String(e.asOf))) bad(key, 'asOf must be YYYY-MM or YYYY-MM-DD');
      if (!DATE_RE.test(String(e.reviewBy))) bad(key, 'reviewBy must be YYYY-MM-DD');
      if (e.status === 'DECISION' && !/decisions\.md/.test(String(e.source))) bad(key, 'DECISION source must reference plan/decisions.md');
      if ('formula' in e) bad(key, 'only DERIVED entries may have a formula');
    }
    if (e.history) for (const h of e.history) if (!h || !('value' in h) || !h.asOf || !DATE_RE.test(String(h.supersededOn))) bad(key, 'history rows need value, asOf, supersededOn');
  }
  for (const lim of file.knownLimitations ?? []) {
    if (!lim.id || !/^[a-z0-9-]+$/.test(lim.id)) bad('$.knownLimitations', 'limitation ids are kebab-case');
    if (!lim.text || lim.text.length < 20) bad(`$.knownLimitations.${lim.id}`, 'text too short');
    if (!DATE_RE.test(String(lim.raised))) bad(`$.knownLimitations.${lim.id}`, 'raised must be YYYY-MM-DD');
  }
  return problems;
}

/**
 * Evaluate a DERIVED formula over resolved keys. Supported: sum(a,b,…), a+b, a-b,
 * a*b, a/b (single operator, any number of operands for sum), numeric literals.
 * @param {string} formula
 * @param {(key: string) => number} get
 */
export function evalFormula(formula, get) {
  const f = formula.trim();
  const term = (/** @type {string} */ t) => { t = t.trim(); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : get(t); };
  const m = /^sum\((.*)\)$/.exec(f);
  if (m) return m[1].split(',').map(term).reduce((s, x) => s + x, 0);
  if (/^[A-Za-z0-9_.-]+$/.test(f)) return term(f); // a bare key or literal (alias)
  for (const op of ['+', '-', '*', '/']) {
    const parts = f.split(op).map((s) => s.trim());
    if (parts.length === 2 && parts.every((p) => p.length)) {
      const [a, b] = parts.map(term);
      return op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
    }
  }
  throw new Error(`unsupported formula: ${formula}`);
}

/**
 * Resolve every value (computing loader-DERIVED entries) and build the nested object.
 * @param {AssumptionsFile} file
 * @returns {{ values: Record<string, any>, flat: Record<string, unknown>, engineDerived: string[] }}
 */
export function resolveAssumptions(file) {
  /** @type {Record<string, unknown>} */
  const flat = {};
  /** @type {string[]} */
  const engineDerived = [];
  const entries = file.entries;
  const resolving = new Set();
  const get = (/** @type {string} */ key) => {
    if (key in flat) return /** @type {number} */ (flat[key]);
    const e = entries[key];
    if (!e) throw new Error(`formula references unknown key ${key}`);
    if (e.status !== 'DERIVED') { flat[key] = e.value; return /** @type {number} */ (e.value); }
    if (e.derivedBy === 'engine') throw new Error(`formula references engine-derived key ${key}`);
    if (resolving.has(key)) throw new Error(`circular formula at ${key}`);
    resolving.add(key);
    const v = evalFormula(/** @type {string} */ (e.formula), get);
    resolving.delete(key);
    flat[key] = v;
    return v;
  };
  for (const [key, e] of Object.entries(entries)) {
    if (e.status === 'DERIVED' && e.derivedBy === 'engine') { engineDerived.push(key); continue; }
    get(key);
  }
  /** @type {Record<string, any>} */
  const values = {};
  for (const [key, v] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = values;
    for (const p of parts.slice(0, -1)) node = node[p] ??= {};
    node[parts[parts.length - 1]] = v;
  }
  return { values, flat, engineDerived };
}

/**
 * Entries past their reviewBy date.
 * @param {AssumptionsFile} file
 * @param {Date} [today]
 * @returns {Stale[]}
 */
export function freshness(file, today = new Date()) {
  /** @type {Stale[]} */
  const out = [];
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (const [key, e] of Object.entries(file.entries)) {
    if (!e.reviewBy) continue;
    const [y, m, d] = e.reviewBy.split('-').map(Number);
    const daysOver = Math.floor((t0 - Date.UTC(y, m - 1, d)) / 86_400_000);
    if (daysOver > 0) out.push({ key, reviewBy: e.reviewBy, daysOver, level: daysOver > 90 ? 'RED' : 'AMBER', status: e.status });
  }
  return out.sort((a, b) => b.daysOver - a.daysOver);
}

/**
 * Validate + resolve, throwing on any structural problem. This is what every
 * consumer calls; a broken assumptions file must fail loudly, never fall back.
 * @param {AssumptionsFile} file
 */
export function buildAssumptions(file) {
  const problems = validateAssumptions(file);
  if (problems.length) {
    throw new Error('plan/assumptions.json is invalid:\n' + problems.map((p) => `  ${p.key}: ${p.message}`).join('\n'));
  }
  const { values, flat, engineDerived } = resolveAssumptions(file);
  return { values, flat, engineDerived, entries: file.entries, knownLimitations: file.knownLimitations, preparedOn: file.preparedOn, moneyBasis: file.moneyBasis };
}

/** Node-only convenience: read and build from disk. */
export async function readAssumptionsFile(/** @type {string=} */ path) {
  const fs = await import(/* webpackIgnore: true */ 'node:fs');
  const url = await import(/* webpackIgnore: true */ 'node:url');
  const p = path ?? url.fileURLToPath(new URL('../assumptions.json', import.meta.url));
  return buildAssumptions(JSON.parse(fs.readFileSync(p, 'utf8')));
}
