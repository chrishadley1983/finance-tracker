import { ebFetch } from './client';
import type { EnableBankingSession } from './types';

/**
 * Exchange the authorization `code` (from the redirect callback) for a session.
 * The session lists the account uids the user consented to share.
 */
export async function createSession(code: string): Promise<EnableBankingSession> {
  return ebFetch<EnableBankingSession>('/sessions', {
    method: 'POST',
    body: { code },
  });
}

/** Fetch a session's current state (accounts, validity). */
export async function getSession(sessionId: string): Promise<EnableBankingSession> {
  return ebFetch<EnableBankingSession>(`/sessions/${encodeURIComponent(sessionId)}`);
}

/** Revoke a session (removes consent). */
export async function deleteSession(sessionId: string): Promise<void> {
  await ebFetch<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}
