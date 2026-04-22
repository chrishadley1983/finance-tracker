import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supabase Connection', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://vkezoyhjoufvsjopjbrr.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  });

  it('browser client can be created without error', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('server client can be imported without error', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase/server');
    expect(supabaseAdmin).toBeDefined();
    expect(typeof supabaseAdmin.from).toBe('function');
  });

  it('browser client is functional', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    expect(supabase).toBeDefined();
  });
});
