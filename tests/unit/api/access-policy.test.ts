import { describe, it, expect, vi } from 'vitest';
import {
  apiAuthMode,
  decideApiAccess,
  isPublicApiPath,
  safeEqual,
  validApiKeys,
  type ApiAccessInput,
} from '@/lib/api/access-policy';

const AGENT = 'agent-key-0123456789abcdef';
const EXTRA = 'extra-key-0123456789abcdef';
const CRON = 'cron-secret-0123456789abcdef';
const env = { FINANCE_AGENT_KEY: AGENT, FINANCE_API_KEYS: ` ${EXTRA} , `, CRON_SECRET: CRON };

function input(over: Partial<ApiAccessInput> = {}): ApiAccessInput {
  return {
    path: '/api/transactions',
    apiKey: null,
    authorization: null,
    hasUser: async () => false,
    env,
    ...over,
  };
}

describe('decideApiAccess', () => {
  it('refuses an anonymous read or write', async () => {
    expect(await decideApiAccess(input())).toEqual({ allow: false, reason: 'no_credentials' });
    expect(await decideApiAccess(input({ path: '/api/truelayer/sync' }))).toEqual({
      allow: false,
      reason: 'no_credentials',
    });
  });

  it('allows a logged-in browser session', async () => {
    expect(await decideApiAccess(input({ hasUser: async () => true }))).toEqual({
      allow: true,
      reason: 'session',
    });
  });

  it("allows Peter's agent key and any extra configured key", async () => {
    expect(await decideApiAccess(input({ apiKey: AGENT }))).toEqual({ allow: true, reason: 'api_key' });
    expect(await decideApiAccess(input({ apiKey: EXTRA }))).toEqual({ allow: true, reason: 'api_key' });
  });

  it('refuses a wrong key even when a session is present, without looking the user up', async () => {
    const hasUser = vi.fn(async () => true);
    expect(await decideApiAccess(input({ apiKey: 'nope', hasUser }))).toEqual({
      allow: false,
      reason: 'bad_api_key',
    });
    expect(await decideApiAccess(input({ apiKey: '', hasUser }))).toEqual({ allow: false, reason: 'bad_api_key' });
    expect(hasUser).not.toHaveBeenCalled();
  });

  it('allows the cron bearer and skips the Supabase lookup', async () => {
    const hasUser = vi.fn(async () => false);
    expect(
      await decideApiAccess(input({ path: '/api/truelayer/cron', authorization: `Bearer ${CRON}`, hasUser }))
    ).toEqual({ allow: true, reason: 'cron_bearer' });
    expect(hasUser).not.toHaveBeenCalled();
  });

  it('a wrong bearer falls through to the session check', async () => {
    expect(await decideApiAccess(input({ authorization: 'Bearer wrong' }))).toEqual({
      allow: false,
      reason: 'no_credentials',
    });
    expect(await decideApiAccess(input({ authorization: 'Bearer wrong', hasUser: async () => true }))).toEqual({
      allow: true,
      reason: 'session',
    });
  });

  it('never accepts empty or short configured secrets', async () => {
    const weak = { FINANCE_AGENT_KEY: '', FINANCE_API_KEYS: 'short,,', CRON_SECRET: '' };
    expect(await decideApiAccess(input({ env: weak, apiKey: '' }))).toEqual({ allow: false, reason: 'bad_api_key' });
    expect(await decideApiAccess(input({ env: weak, apiKey: 'short' }))).toEqual({
      allow: false,
      reason: 'bad_api_key',
    });
    expect(await decideApiAccess(input({ env: weak, authorization: 'Bearer ' }))).toEqual({
      allow: false,
      reason: 'no_credentials',
    });
  });

  it('lets the public paths through with no credentials', async () => {
    for (const path of [
      '/api/health',
      '/api/auth/callback',
      '/api/auth/logout',
      '/api/truelayer/callback',
      '/api/enable-banking/callback/',
    ]) {
      expect(await decideApiAccess(input({ path }))).toEqual({ allow: true, reason: 'public' });
    }
  });
});

describe('isPublicApiPath', () => {
  it('matches exact paths only, not prefixes or look-alikes', () => {
    expect(isPublicApiPath('/api/truelayer/callback')).toBe(true);
    expect(isPublicApiPath('/api/truelayer/callbackx')).toBe(false);
    expect(isPublicApiPath('/api/truelayer/callback/extra')).toBe(false);
    expect(isPublicApiPath('/api/truelayer/cron')).toBe(false);
    expect(isPublicApiPath('/api/auth')).toBe(false);
  });
});

describe('helpers', () => {
  it('safeEqual compares whole strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });

  it('validApiKeys trims, dedupes and drops short keys', () => {
    expect(validApiKeys({ FINANCE_AGENT_KEY: AGENT, FINANCE_API_KEYS: `${AGENT}, ${EXTRA},x` })).toEqual([
      AGENT,
      EXTRA,
    ]);
  });

  it('apiAuthMode enforces unless explicitly audit', () => {
    expect(apiAuthMode('audit')).toBe('audit');
    expect(apiAuthMode(' AUDIT ')).toBe('audit');
    expect(apiAuthMode('enforce')).toBe('enforce');
    expect(apiAuthMode(undefined)).toBe('enforce');
    expect(apiAuthMode('off')).toBe('enforce');
  });
});
