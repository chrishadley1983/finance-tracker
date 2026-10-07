/**
 * Who may call `/api/*` — the pure decision behind `middleware.ts`.
 *
 * Edge-safe (no `node:crypto`): the middleware runs on the Edge runtime.
 *
 * A request is allowed when ANY of these holds:
 * - the path is public (health check, OAuth callbacks, logout);
 * - `x-api-key` matches FINANCE_AGENT_KEY or one of FINANCE_API_KEYS (comma-separated) —
 *   Peter's finance-categorise job, Hadley API, Claude Code skills;
 * - `Authorization: Bearer <CRON_SECRET>` — `scripts/sync-truelayer.ts` and the cron routes;
 * - a logged-in Supabase session (the browser) whose email is in FINANCE_ALLOWED_EMAILS.
 *   The Supabase project is shared with other apps and has other users, so "logged in"
 *   alone is not enough. Unset allowlist = any user (so a missing env var can't lock Chris out).
 *
 * A present-but-wrong `x-api-key` is refused even with a session, matching
 * `requireAgentOrUser` (a misconfigured agent should fail loudly, not ride a cookie).
 *
 * `API_AUTH_MODE=audit` logs would-be denials and lets them through (rollout and
 * rollback lever); anything else, including unset, enforces.
 */

export const PUBLIC_API_PATHS: readonly string[] = [
  '/api/health',
  '/api/auth/callback', // Supabase login callback
  '/api/auth/logout', // only clears the session cookie
  '/api/truelayer/callback', // bank OAuth redirect (validates its own state)
];

export type ApiAuthMode = 'audit' | 'enforce';

export type ApiAccessReason =
  | 'public'
  | 'api_key'
  | 'cron_bearer'
  | 'session'
  | 'bad_api_key'
  | 'no_credentials';

export interface ApiAccessInput {
  path: string;
  apiKey: string | null;
  authorization: string | null;
  /** Is there an ALLOWED signed-in user (see isAllowedEmail)? Called lazily: only when no key or
   *  bearer decides it. */
  hasUser: () => Promise<boolean>;
  env: {
    FINANCE_AGENT_KEY?: string;
    FINANCE_API_KEYS?: string;
    CRON_SECRET?: string;
  };
}

export interface ApiAccessDecision {
  allow: boolean;
  reason: ApiAccessReason;
}

export function apiAuthMode(raw: string | undefined): ApiAuthMode {
  return raw?.trim().toLowerCase() === 'audit' ? 'audit' : 'enforce';
}

export function isPublicApiPath(path: string): boolean {
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return PUBLIC_API_PATHS.includes(p);
}

/** Length-safe constant-time string comparison (no early exit on the first difference). */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Is this signed-in user allowed into the finance app? Unset/empty allowlist = any user. */
export function isAllowedEmail(email: string | null | undefined, allowlistRaw: string | undefined): boolean {
  const allow = (allowlistRaw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return true;
  return Boolean(email) && allow.includes((email as string).trim().toLowerCase());
}

export function validApiKeys(env: ApiAccessInput['env']): string[] {
  const keys = [env.FINANCE_AGENT_KEY ?? '', ...(env.FINANCE_API_KEYS ?? '').split(',')]
    .map((k) => k.trim())
    .filter((k) => k.length >= 16); // never accept a short or empty configured key
  return Array.from(new Set(keys));
}

export async function decideApiAccess(input: ApiAccessInput): Promise<ApiAccessDecision> {
  if (isPublicApiPath(input.path)) return { allow: true, reason: 'public' };

  if (input.apiKey !== null) {
    const ok = validApiKeys(input.env).some((k) => safeEqual(input.apiKey as string, k));
    return ok ? { allow: true, reason: 'api_key' } : { allow: false, reason: 'bad_api_key' };
  }

  const secret = input.env.CRON_SECRET?.trim();
  if (secret && secret.length >= 16 && input.authorization !== null) {
    if (safeEqual(input.authorization, `Bearer ${secret}`)) return { allow: true, reason: 'cron_bearer' };
  }

  if (await input.hasUser()) return { allow: true, reason: 'session' };
  return { allow: false, reason: 'no_credentials' };
}
