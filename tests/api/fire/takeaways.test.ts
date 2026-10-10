import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const create = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));
vi.mock('@/lib/ai-usage-audit', () => ({ logAiUsage: vi.fn(async () => {}), usageFields: () => ({}) }));

import { POST } from '@/app/api/fire/takeaways/route';

const body = {
  failSafeSwr: 3.4, medianSwr: 4.6, ernDynamicWr: 3.9, personalWr: 3.2, currentCape: 33, mcSurvivalRate: 0.94,
  config: { portfolio: 900000, annualSpend: 40000, horizonYears: 45, currentAge: 43 },
};
const req = () => new NextRequest('http://localhost/api/fire/takeaways', { method: 'POST', body: JSON.stringify(body) });

describe('POST /api/fire/takeaways', () => {
  beforeEach(() => {
    create.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('calls the Anthropic API (not a local CLI) and returns validated takeaways', async () => {
    const takeaways = [
      { tag: 'strong', title: 'Withdrawal rate is safe', body: 'Your 3.2% is below the 3.4% fail-safe.' },
      { tag: 'watch', title: 'CAPE is high', body: 'CAPE of 33 suggests lower returns.' },
      { tag: 'idea', title: 'Hold more cash', body: 'Two years of spending in cash smooths sequence risk.' },
      { tag: 'strong', title: 'High survival', body: '94% of simulations survive.' },
    ];
    create.mockResolvedValue({ id: 'msg_1', model: 'claude-sonnet-5', usage: {}, content: [{ type: 'text', text: JSON.stringify(takeaways) }] });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).takeaways).toHaveLength(4);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-sonnet-5', system: expect.stringContaining('UK-focused') }));
  });

  it('returns 503 with a clear message when no API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 503 when the API call fails', async () => {
    create.mockRejectedValue(new Error('overloaded'));
    expect((await POST(req())).status).toBe(503);
  });
});
