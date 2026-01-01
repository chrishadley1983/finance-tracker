import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a successful response', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('returns JSON content type', async () => {
    const response = await GET();
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('returns status as healthy', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  it('returns a valid ISO timestamp', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.timestamp).toBe('2025-01-01T12:00:00.000Z');
  });

  it('returns both required fields', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(Object.keys(data)).toHaveLength(2);
  });
});
