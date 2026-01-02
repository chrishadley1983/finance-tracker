import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/import/ai-suggest/route';
import { NextRequest } from 'next/server';

// Mock the supabase admin client
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

// Mock the AI mapper service
vi.mock('@/lib/import/ai-mapper', () => ({
  suggestColumnMapping: vi.fn(() =>
    Promise.resolve({
      mapping: {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        debit: null,
        credit: null,
        reference: null,
        balance: null,
      },
      dateFormat: 'YYYY-MM-DD',
      decimalSeparator: '.',
      amountStyle: 'single',
      confidence: 0.9,
      reasoning: 'Test reasoning',
      warnings: [],
    })
  ),
  generateHeadersHash: vi.fn(() => 'test-hash'),
  AIMappingError: class extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

describe('POST /api/import/ai-suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if sessionId is missing', async () => {
    const request = new NextRequest('http://localhost/api/import/ai-suggest', {
      method: 'POST',
      body: JSON.stringify({
        headers: ['Date', 'Amount'],
        sampleRows: [['2024-01-01', '100']],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('sessionId is required');
  });

  it('returns 400 if headers is missing', async () => {
    const request = new NextRequest('http://localhost/api/import/ai-suggest', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        sampleRows: [['2024-01-01', '100']],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('headers array is required');
  });

  it('returns 400 if headers is empty', async () => {
    const request = new NextRequest('http://localhost/api/import/ai-suggest', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        headers: [],
        sampleRows: [['2024-01-01', '100']],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('headers array is required');
  });

  it('returns 400 if sampleRows is missing', async () => {
    const request = new NextRequest('http://localhost/api/import/ai-suggest', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        headers: ['Date', 'Amount'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('sampleRows array is required');
  });

  it('returns 400 if sampleRows is empty', async () => {
    const request = new NextRequest('http://localhost/api/import/ai-suggest', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        headers: ['Date', 'Amount'],
        sampleRows: [],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('sampleRows array is required');
  });

  it('returns cached result if available', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase/server');

    // Mock cached result
    vi.mocked(supabaseAdmin.from).mockImplementation((table) => {
      if (table === 'ai_usage_tracking') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: { count: 5 }, error: null })),
              })),
            })),
          })),
        } as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === 'ai_mapping_cache') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: 'cache-id',
                    result: { mapping: { date: 'CachedDate' } },
                    hits: 2,
                  },
                  error: null,
                })
              ),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        } as ReturnType<typeof supabaseAdmin.from>;
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      } as ReturnType<typeof supabaseAdmin.from>;
    });

    const request = new NextRequest('http://localhost/api/import/ai-suggest', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        headers: ['Date', 'Amount'],
        sampleRows: [['2024-01-01', '100']],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.usedCache).toBe(true);
    expect(data.suggestion.mapping.date).toBe('CachedDate');
  });
});

describe('GET /api/import/ai-suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rate limit status', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase/server');

    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { count: 3 }, error: null })),
            })),
          })),
        })),
      } as ReturnType<typeof supabaseAdmin.from>;
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.dailyLimit).toBe(10);
    expect(data.used).toBe(3);
    expect(data.remaining).toBe(7);
  });

  it('returns 0 remaining when limit reached', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase/server');

    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { count: 15 }, error: null })),
            })),
          })),
        })),
      } as ReturnType<typeof supabaseAdmin.from>;
    });

    const response = await GET();
    const data = await response.json();

    expect(data.remaining).toBe(0);
    expect(data.used).toBe(15);
  });
});
