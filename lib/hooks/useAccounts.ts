'use client';

import { createCachedResource, type CachedResourceResult } from './cachedResource';
import type { AccountWithStats } from '@/lib/types/account';

const resource = createCachedResource<AccountWithStats[]>('/api/accounts', (json) => {
  const accounts = (json as { accounts?: unknown } | null)?.accounts;
  return Array.isArray(accounts) ? (accounts as AccountWithStats[]) : [];
});

/**
 * Non-archived accounts (GET /api/accounts), fetched once per page load and
 * shared by every consumer.
 */
export function useAccounts(options?: { enabled?: boolean }): CachedResourceResult<AccountWithStats[]> {
  return resource.useResource(options);
}

/** Test helper: clear the module-level cache. */
export const __resetAccountsCache = resource.reset;
