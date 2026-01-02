import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the categorisation engine
vi.mock('@/lib/categorisation', () => ({
  categoriseMultiple: vi.fn(),
  calculateStats: vi.fn(),
}));

import { POST } from '@/app/api/import/categorise/route';
import { categoriseMultiple, calculateStats } from '@/lib/categorisation';
import { NextRequest } from 'next/server';

describe('POST /api/import/categorise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: object): NextRequest {
    return new NextRequest('http://localhost/api/import/categorise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 400 when sessionId is missing', async () => {
    const request = createRequest({ transactions: [] });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Session ID is required');
  });

  it('returns 400 when transactions is missing', async () => {
    const request = createRequest({ sessionId: 'test-session' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Transactions array is required');
  });

  it('returns empty results for empty transactions array', async () => {
    const request = createRequest({
      sessionId: 'test-session',
      transactions: [],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.results).toEqual([]);
    expect(data.stats.total).toBe(0);
    expect(categoriseMultiple).not.toHaveBeenCalled();
  });

  it('categorises transactions and returns results', async () => {
    const mockResults = [
      {
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        source: 'rule_exact' as const,
        confidence: 1.0,
        matchDetails: 'Exact match: TESCO',
      },
      {
        categoryId: 'cat-shopping',
        categoryName: 'Shopping',
        source: 'similar' as const,
        confidence: 0.75,
        matchDetails: 'Similar to AMAZON UK',
      },
    ];

    const mockStats = {
      total: 2,
      categorised: 2,
      uncategorised: 0,
      bySource: {
        rule_exact: 1,
        rule_pattern: 0,
        similar: 1,
        ai: 0,
        none: 0,
      },
      highConfidence: 1,
      lowConfidence: 0,
      aiUsed: 0,
    };

    vi.mocked(categoriseMultiple).mockResolvedValue(mockResults);
    vi.mocked(calculateStats).mockReturnValue(mockStats);

    const request = createRequest({
      sessionId: 'test-session',
      transactions: [
        { date: '2024-01-15', description: 'TESCO', amount: -50, rowNumber: 1, rawData: {} },
        { date: '2024-01-16', description: 'AMAZON UK', amount: -25, rowNumber: 2, rawData: {} },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.results).toHaveLength(2);
    expect(data.results[0].categoryName).toBe('Groceries');
    expect(data.results[1].categoryName).toBe('Shopping');
    expect(data.stats.categorised).toBe(2);
  });

  it('passes transactions to categoriseMultiple correctly', async () => {
    vi.mocked(categoriseMultiple).mockResolvedValue([]);
    vi.mocked(calculateStats).mockReturnValue({
      total: 0,
      categorised: 0,
      uncategorised: 0,
      bySource: { rule_exact: 0, rule_pattern: 0, similar: 0, ai: 0, none: 0 },
      highConfidence: 0,
      lowConfidence: 0,
      aiUsed: 0,
    });

    const transactions = [
      { date: '2024-01-15', description: 'TESCO', amount: -50, reference: 'ref-1', rowNumber: 1, rawData: {} },
    ];

    const request = createRequest({
      sessionId: 'test-session',
      transactions,
    });

    await POST(request);

    expect(categoriseMultiple).toHaveBeenCalledWith([
      {
        date: '2024-01-15',
        description: 'TESCO',
        amount: -50,
        reference: 'ref-1',
      },
    ]);
  });

  it('returns 500 on categorisation error', async () => {
    vi.mocked(categoriseMultiple).mockRejectedValue(new Error('Categorisation failed'));

    const request = createRequest({
      sessionId: 'test-session',
      transactions: [
        { date: '2024-01-15', description: 'TESCO', amount: -50, rowNumber: 1, rawData: {} },
      ],
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to categorise transactions');
  });

  it('handles mixed categorisation results', async () => {
    const mockResults = [
      {
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        source: 'rule_exact' as const,
        confidence: 1.0,
        matchDetails: 'Exact match',
      },
      {
        categoryId: null,
        categoryName: null,
        source: 'none' as const,
        confidence: 0,
        matchDetails: 'No match found',
      },
      {
        categoryId: 'cat-shopping',
        categoryName: 'Shopping',
        source: 'ai' as const,
        confidence: 0.6,
        matchDetails: 'AI suggestion',
        alternatives: [
          { categoryId: 'cat-other', categoryName: 'Other', confidence: 0.3 },
        ],
      },
    ];

    const mockStats = {
      total: 3,
      categorised: 2,
      uncategorised: 1,
      bySource: { rule_exact: 1, rule_pattern: 0, similar: 0, ai: 1, none: 1 },
      highConfidence: 1,
      lowConfidence: 0,
      aiUsed: 1,
    };

    vi.mocked(categoriseMultiple).mockResolvedValue(mockResults);
    vi.mocked(calculateStats).mockReturnValue(mockStats);

    const request = createRequest({
      sessionId: 'test-session',
      transactions: [
        { date: '2024-01-15', description: 'TESCO', amount: -50, rowNumber: 1, rawData: {} },
        { date: '2024-01-16', description: 'UNKNOWN', amount: -25, rowNumber: 2, rawData: {} },
        { date: '2024-01-17', description: 'AMAZON', amount: -30, rowNumber: 3, rawData: {} },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.results).toHaveLength(3);
    expect(data.stats.categorised).toBe(2);
    expect(data.stats.uncategorised).toBe(1);
    expect(data.stats.aiUsed).toBe(1);
  });
});
