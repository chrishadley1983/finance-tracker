// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { generateKeyPair, exportPKCS8 } from 'jose';
import { getAuthToken, _resetAuthCache, isEnableBankingConfigured } from '@/lib/enable-banking/client';

let pkcs8: string;
const ORIGINAL_ENV = { ...process.env };

function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
}

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  pkcs8 = await exportPKCS8(privateKey);
});

beforeEach(() => {
  _resetAuthCache();
  process.env.ENABLE_BANKING_APP_ID = 'app-123';
  process.env.ENABLE_BANKING_PRIVATE_KEY = pkcs8;
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Enable Banking client auth', () => {
  it('isEnableBankingConfigured reflects env presence', () => {
    expect(isEnableBankingConfigured()).toBe(true);
    delete process.env.ENABLE_BANKING_APP_ID;
    expect(isEnableBankingConfigured()).toBe(false);
  });

  it('signs a valid RS256 JWT with kid header and EB claims', async () => {
    const token = await getAuthToken();
    const [h, p] = token.split('.');
    const header = decodeSegment(h);
    const claims = decodeSegment(p);
    expect(header.alg).toBe('RS256');
    expect(header.typ).toBe('JWT');
    expect(header.kid).toBe('app-123');
    expect(claims.iss).toBe('enablebanking.com');
    expect(claims.aud).toBe('api.enablebanking.com');
    expect((claims.exp as number) - (claims.iat as number)).toBe(3600);
  });

  it('caches the token across calls', async () => {
    const a = await getAuthToken();
    const b = await getAuthToken();
    expect(a).toBe(b);
  });

  it('accepts a private key stored with escaped newlines', async () => {
    _resetAuthCache();
    process.env.ENABLE_BANKING_PRIVATE_KEY = pkcs8.replace(/\n/g, '\\n');
    const token = await getAuthToken();
    expect(token.split('.')).toHaveLength(3);
  });
});
