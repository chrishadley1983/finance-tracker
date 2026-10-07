'use client';

import { createCachedResource, type CachedResourceResult } from './cachedResource';
import type { Category } from '@/lib/types/category';

/** A category as returned by GET /api/categories (joined with its group). */
export interface CategoryWithGroup extends Category {
  category_groups?: { id: string; name: string; colour: string | null } | null;
}

/** Display group for a category: the joined group, then the legacy column. */
export function categoryGroupName(
  category: Partial<Pick<CategoryWithGroup, 'group_name' | 'category_groups'>>
): string {
  return category.category_groups?.name || category.group_name || 'Ungrouped';
}

const resource = createCachedResource<CategoryWithGroup[]>('/api/categories', (json) =>
  Array.isArray(json) ? (json as CategoryWithGroup[]) : []
);

/** All categories, fetched once per page load and shared by every consumer. */
export function useCategories(options?: { enabled?: boolean }): CachedResourceResult<CategoryWithGroup[]> {
  return resource.useResource(options);
}

/** Test helper: clear the module-level cache. */
export const __resetCategoriesCache = resource.reset;
