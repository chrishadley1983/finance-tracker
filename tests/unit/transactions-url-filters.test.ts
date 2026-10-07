import { describe, it, expect } from 'vitest';
import { filtersFromSearchParams, filtersToQueryString, hasActiveFilters } from '@/lib/transactions/url-filters';
import { filterQueryParams } from '@/lib/hooks/useTransactions';
import { formatDayHeading } from '@/lib/format';

describe('transactions URL filters', () => {
  it('reads the URL-seeded filters', () => {
    const f = filtersFromSearchParams(
      new URLSearchParams('categoryId=c1&accountId=a1&dateFrom=2026-01-01&dateTo=2026-01-31&search=tesco&status=needs_review')
    );
    expect(f).toEqual({
      categoryId: 'c1',
      accountId: 'a1',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      search: 'tesco',
      status: 'needs_review',
    });
  });

  it('drops unknown statuses and malformed dates', () => {
    expect(filtersFromSearchParams(new URLSearchParams('status=nope&dateFrom=yesterday'))).toEqual({});
  });

  it('round-trips through the query string', () => {
    const f = { search: 'a b', accountId: 'a1', status: 'uncategorised' as const, dateFrom: '2026-02-01' };
    const qs = filtersToQueryString(f);
    expect(qs).toBe('search=a+b&dateFrom=2026-02-01&accountId=a1&status=uncategorised');
    expect(filtersFromSearchParams(new URLSearchParams(qs))).toEqual(f);
    expect(filtersToQueryString({})).toBe('');
  });

  it('knows when any filter is active', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ status: 'validated' })).toBe(true);
    expect(hasActiveFilters({ validated: 'all' })).toBe(false);
  });

  it('maps filters to API params (status wins over legacy validated)', () => {
    const p = filterQueryParams({ accountId: 'a', categoryId: 'c', dateFrom: 'f', dateTo: 't', search: 's', status: 'uncategorised', validated: 'validated' });
    expect(p.toString()).toBe('account_id=a&category_id=c&start_date=f&end_date=t&search=s&status=uncategorised');
    expect(filterQueryParams({ validated: 'unvalidated' }).toString()).toBe('validated=unvalidated');
  });
});

describe('formatDayHeading', () => {
  it('formats a day in the current year without the year', () => {
    expect(formatDayHeading('2026-10-07', new Date(2026, 9, 7))).toBe('Wed 7 October');
  });

  it('adds the year for other years', () => {
    expect(formatDayHeading('2024-12-30', new Date(2026, 0, 1))).toBe('Mon 30 December 2024');
  });
});
