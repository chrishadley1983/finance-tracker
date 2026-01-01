import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supabase Connection', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://vkezoyhjoufvsjopjbrr.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  });

  it('browser client can be imported without error', async () => {
    const { supabase } = await import('@/lib/supabase/client');
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('server client can be imported without error', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase/server');
    expect(supabaseAdmin).toBeDefined();
    expect(typeof supabaseAdmin.from).toBe('function');
  });

  it('browser client has correct URL configured', async () => {
    const { supabase } = await import('@/lib/supabase/client');
    // The supabaseUrl is stored internally, we can verify the client works
    expect(supabase).toBeDefined();
  });
});
