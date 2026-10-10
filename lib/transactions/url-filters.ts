/**
 * Transactions page filters <-> URL search params, so a refresh, a shared
 * link or the back button keeps the current view. Pure; client-safe.
 */
import type { FilterState, TransactionStatusFilter } from '@/lib/hooks/useTransactions';

const STATUSES: readonly TransactionStatusFilter[] = ['uncategorised', 'needs_review', 'unvalidated', 'validated'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ReadableParams {
  get(name: string): string | null;
}

export function filtersFromSearchParams(params: ReadableParams): FilterState {
  const filters: FilterState = {};
  const categoryId = params.get('categoryId');
  const accountId = params.get('accountId');
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  const search = params.get('search');
  const status = params.get('status');

  if (categoryId) filters.categoryId = categoryId;
  if (accountId) filters.accountId = accountId;
  if (dateFrom && DATE.test(dateFrom)) filters.dateFrom = dateFrom;
  if (dateTo && DATE.test(dateTo)) filters.dateTo = dateTo;
  if (search) filters.search = search;
  if (status && (STATUSES as readonly string[]).includes(status)) {
    filters.status = status as TransactionStatusFilter;
  }
  return filters;
}

/** Query string (without "?") for the filters; keys in a stable order. */
export function filtersToQueryString(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.accountId) params.set('accountId', filters.accountId);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.status) params.set('status', filters.status);
  return params.toString();
}

export function hasActiveFilters(filters: FilterState): boolean {
  return Boolean(
    filters.accountId ||
      filters.categoryId ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.search ||
      filters.status ||
      (filters.validated && filters.validated !== 'all')
  );
}
