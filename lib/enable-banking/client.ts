/**
 * Enable Banking API client.
 *
 * Handles RS256 JWT auth (signed with the application's private key), a small
 * in-memory token cache, and a fetch wrapper with retry/backoff on rate limits
 * and transient 5xx errors.
 *
 * Required env:
 *   ENABLE_BANKING_APP_ID       – application id (goes in the JWT `kid` header)
 *   ENABLE_BANKING_PRIVATE_KEY  – PKCS#8 PEM private key (RS256)
 */
import { SignJWT, importPKCS8 } from 'jose';
import { EnableBankingError } from './types';

export const ENABLE_BANKING_API_URL = 'https://api.enablebanking.com';

const TOKEN_TTL_SECONDS = 3600; // max 24h; keep short
const TOKEN_REFRESH_MARGIN = 120; // refresh 2 min before expiry

type ImportedKey = Awaited<ReturnType<typeof importPKCS8>>;

let cachedKey: ImportedKey | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new EnableBankingError(`Missing env var ${name}`, 500, 'CONFIG');
  return v;
}

/** Normalise a PEM that may have been stored with escaped newlines. */
function normalisePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

async function getPrivateKey(): Promise<ImportedKey> {
  if (cachedKey) return cachedKey;
  const pem = normalisePem(requireEnv('ENABLE_BANKING_PRIVATE_KEY'));
  cachedKey = await importPKCS8(pem, 'RS256');
  return cachedKey;
}

/** Generate (or reuse a cached) signed JWT for API authentication. */
export async function getAuthToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN > now) {
    return cachedToken.token;
  }
  const appId = requireEnv('ENABLE_BANKING_APP_ID');
  const key = await getPrivateKey();
  const exp = now + TOKEN_TTL_SECONDS;
  const token = await new SignJWT({})
    .setProtectedHeader({ typ: 'JWT', alg: 'RS256', kid: appId })
    .setIssuer('enablebanking.com')
    .setAudience('api.enablebanking.com')
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  cachedToken = { token, expiresAt: exp };
  return token;
}

/** Reset cached credentials (used by tests). */
export function _resetAuthCache(): void {
  cachedKey = null;
  cachedToken = null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FetchOptions extends Omit<RequestInit, 'body'> {
  /** JSON-serialisable body (objects are stringified) or a raw string. */
  body?: unknown;
  /** Max retry attempts on 429/5xx (default 3). */
  retries?: number;
}

/**
 * Authenticated fetch against the Enable Banking API. Serialises JSON bodies,
 * throws EnableBankingError on non-2xx, and retries 429/5xx with exponential
 * backoff (respecting Retry-After when present).
 */
export async function ebFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { retries = 3, body, headers, ...rest } = options;
  const token = await getAuthToken();

  const finalHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };
  let finalBody = body;
  if (body !== undefined && typeof body !== 'string') {
    finalBody = JSON.stringify(body);
    finalHeaders['Content-Type'] = 'application/json';
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${ENABLE_BANKING_API_URL}${path}`, {
        ...rest,
        body: finalBody as BodyInit | undefined,
        headers: finalHeaders,
      });
    } catch (e) {
      // Network error – retry with backoff.
      lastErr = e;
      if (attempt < retries) {
        await sleep(2 ** attempt * 500);
        continue;
      }
      throw new EnableBankingError(`Network error calling ${path}`, 0, 'NETWORK', e);
    }

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    const errBody = await res.text().catch(() => '');
    let parsed: unknown;
    try {
      parsed = errBody ? JSON.parse(errBody) : undefined;
    } catch {
      parsed = errBody;
    }

    // Retry transient failures.
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
      await sleep(wait);
      continue;
    }

    const code =
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error?: unknown }).error)
        : undefined) ?? String(res.status);
    throw new EnableBankingError(`Enable Banking API ${res.status} on ${path}`, res.status, code, parsed);
  }

  throw new EnableBankingError(`Enable Banking API failed on ${path}`, 0, 'UNKNOWN', lastErr);
}

/** True when both required env vars are present (used by status/health checks). */
export function isEnableBankingConfigured(): boolean {
  return Boolean(process.env.ENABLE_BANKING_APP_ID && process.env.ENABLE_BANKING_PRIVATE_KEY);
}
