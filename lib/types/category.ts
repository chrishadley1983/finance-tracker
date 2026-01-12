// Category Group types
export interface CategoryGroup {
  id: string;
  name: string;
  display_order: number;
  colour: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryGroupWithStats extends CategoryGroup {
  category_count: number;
  transaction_count: number;
  total_amount: number;
}

// Category types
export interface Category {
  id: string;
  name: string;
  group_name: string;
  group_id: string | null;
  is_income: boolean;
  display_order: number;
  exclude_from_totals: boolean;
  colour: string | null;
  created_at: string;
}

export interface CategoryWithStats extends Category {
  transaction_count: number;
  total_amount: number;
  group?: CategoryGroup;
}

// Category Rule types (from category_mappings table)
export interface CategoryRule {
  id: string;
  pattern: string;
  match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  category_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryRuleWithCategory extends CategoryRule {
  category?: Category;
}

// AI Suggestion types
export interface CategorySuggestion {
  pattern: string;
  match_type: 'exact' | 'contains' | 'starts_with';
  category_id: string;
  category_name: string;
  confidence: number;
  sample_transactions: number;
}

// Form/Dialog types
export interface CategoryFormData {
  name: string;
  group_id: string | null;
  is_income: boolean;
  display_order: number;
  exclude_from_totals: boolean;
  colour: string | null;
}

export interface CategoryGroupFormData {
  name: string;
  display_order: number;
  colour: string | null;
}

export interface RuleFormData {
  pattern: string;
  match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  category_id: string;
  priority: number;
  is_active: boolean;
}

// Filter types
export type CategoryTypeFilter = 'all' | 'income' | 'expense';

export interface CategoryFiltersState {
  search: string;
  type: CategoryTypeFilter;
  groupId: string | null;
}

// Colour palette for categories and groups
export const CATEGORY_COLOURS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#A855F7', // Purple
] as const;

export type CategoryColour = (typeof CATEGORY_COLOURS)[number];
