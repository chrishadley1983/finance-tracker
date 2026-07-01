import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));

import { findMineableMerchants } from '@/lib/categorisation/rule-mining';

const tx = (description: string, category_id: string) => ({ description, category_id });

describe('findMineableMerchants', () => {
  it('mines a merchant with 3+ agreeing transactions', () => {
    const rows = [
      tx('ALDI TONBRIDGE', 'cat-groceries'),
      tx('ALDI TONBRIDGE', 'cat-groceries'),
      tx('ALDI TONBRIDGE )))', 'cat-groceries'),
    ];
    const candidates = findMineableMerchants(rows);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      pattern: 'aldi tonbridge',
      categoryId: 'cat-groceries',
      total: 3,
      agreement: 1,
    });
  });

  it('groups descriptor variants of the same merchant via normalisation', () => {
    const rows = [
      tx('HILDEN SF CONNECT TONBRIDGE KEN )))', 'cat-groceries'),
      tx('HILDEN SF CONNECT TONBRIDGE KEN', 'cat-groceries'),
      tx('HILDEN SF CONNECT TONBRIDGE KEN )))', 'cat-groceries'),
    ];
    const candidates = findMineableMerchants(rows);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].pattern).toBe('hilden sf connect');
  });

  it('rejects merchants below the agreement threshold', () => {
    const rows = [
      tx('WH SMITH LONDON', 'cat-eating-out'),
      tx('WH SMITH LONDON', 'cat-consumerables'),
      tx('WH SMITH LONDON', 'cat-consumerables'),
      tx('WH SMITH LONDON', 'cat-eating-out'),
    ];
    // 50% agreement < 90% → not mineable
    expect(findMineableMerchants(rows)).toHaveLength(0);
  });

  it('rejects merchants with fewer than 3 transactions', () => {
    const rows = [tx('GO APE FORNHAM', 'cat-entertainment'), tx('GO APE FORNHAM', 'cat-entertainment')];
    expect(findMineableMerchants(rows)).toHaveLength(0);
  });

  it('tolerates a single outlier at 90%+ agreement', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => tx('PRET A MANGER LONDON', 'cat-coffee')),
      tx('PRET A MANGER LONDON', 'cat-eating-out'),
    ];
    const candidates = findMineableMerchants(rows);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].categoryId).toBe('cat-coffee');
    expect(candidates[0].agreement).toBeCloseTo(0.9);
  });

  it('skips unmineable keys (too short / numeric / empty)', () => {
    const rows = [
      tx('543458******8906', 'cat-transfers'),
      tx('543458******8906', 'cat-transfers'),
      tx('543458******8906', 'cat-transfers'),
      tx('H3G', 'cat-phone'),
      tx('H3G', 'cat-phone'),
      tx('H3G', 'cat-phone'),
    ];
    // card fragment normalises to '' (unmineable); 'h3g' is only 3 chars
    expect(findMineableMerchants(rows)).toHaveLength(0);
  });

  it('sorts candidates by evidence count', () => {
    const rows = [
      ...Array.from({ length: 3 }, () => tx('GAILS SOUTHFIELDS LONDON', 'cat-eating-out')),
      ...Array.from({ length: 10 }, () => tx('SAINSBURYS S/MKTS TONBRIDGE', 'cat-groceries')),
    ];
    const candidates = findMineableMerchants(rows);
    expect(candidates[0].pattern).toBe('sainsburys s mkts');
    expect(candidates[1].pattern).toBe('gails southfields london');
  });
});
