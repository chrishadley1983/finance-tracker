/**
 * TrueLayer OAuth2 + Data API client.
 *
 * Required env:
 *   TRUELAYER_CLIENT_ID
 *   TRUELAYER_CLIENT_SECRET
 * Optional:
 *   TRUELAYER_ENV = "live" (default) | "sandbox"
 */
import { TrueLayerError, type TrueLayerTokens } from './types';

function hosts() {
  const sandbox = (process.env.TRUELAYER_ENV ?? 'live').toLowerCase() === 'sandbox';
  return {
    auth: sandbox ? 'https://auth.truelayer-sandbox.com' : 'https://auth.truelayer.com',
    api: sandbox ? 'https://api.truelayer-sandbox.com' : 'https://api.truelayer.com',
  };
}

export function trueLayerHosts() {
  return hosts();
}

export function isTrueLayerConfigured(): boolean {
  return Boolean(process.env.TRUELAYER_CLIENT_ID && process.env.TRUELAYER_CLIENT_SECRET);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new TrueLayerError(`Missing env var ${name}`, 500, 'CONFIG');
  return v;
}

async function tokenRequest(params: Record<string, string>): Promise<TrueLayerTokens> {
  const { auth } = hosts();
  const res = await fetch(`${auth}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new TrueLayerError(`Token request failed (${res.status})`, res.status, 'TOKEN', text.slice(0, 300));
  }
  return JSON.parse(text) as TrueLayerTokens;
}

/** Exchange an authorization code for access + refresh tokens. */
export function exchangeCode(code: string, redirectUri: string): Promise<TrueLayerTokens> {
  return tokenRequest({
    grant_type: 'authorization_code',
    client_id: requireEnv('TRUELAYER_CLIENT_ID'),
    client_secret: requireEnv('TRUELAYER_CLIENT_SECRET'),
    redirect_uri: redirectUri,
    code,
  });
}

/** Use a refresh token to obtain a fresh access token. */
export function refreshAccessToken(refreshToken: string): Promise<TrueLayerTokens> {
  return tokenRequest({
    grant_type: 'refresh_token',
    client_id: requireEnv('TRUELAYER_CLIENT_ID'),
    client_secret: requireEnv('TRUELAYER_CLIENT_SECRET'),
    refresh_token: refreshToken,
  });
}

/** Authenticated GET against the Data API. */
export async function dataFetch<T>(path: string, accessToken: string): Promise<T> {
  const { api } = hosts();
  const res = await fetch(`${api}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const text = await res.text();
  if (res.status === 401) {
    throw new TrueLayerError('Access token expired or invalid', 401, 'TOKEN_EXPIRED', text.slice(0, 300));
  }
  if (!res.ok) {
    throw new TrueLayerError(`Data API ${res.status} on ${path}`, res.status, 'API', text.slice(0, 300));
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
