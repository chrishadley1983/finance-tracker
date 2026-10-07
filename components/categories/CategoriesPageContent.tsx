'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  CategoryWithStats,
  CategoryGroup,
  CategoryTypeFilter,
  CategoryFormData,
  CategoryGroupFormData,
} from '@/lib/types/category';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Notice } from '@/components/ui/Notice';
import { PageIntro } from '@/components/ui/PageIntro';
import { useToast } from '@/components/ui/Toast';
import { CategoryTree, type CategoryTreeGroup } from './CategoryTree';
import { RulesPanel, type CategoryMapping } from './RulesPanel';
import { RuleDialog, type RuleFormData } from './RuleDialog';
import { ApplyRuleDialog } from './ApplyRuleDialog';
import { CategoryDialog } from './CategoryDialog';
import { GroupDialog } from './GroupDialog';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';
import { ReassignCategoryDialog } from './ReassignCategoryDialog';

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error(body.message || body.error || fallback);
}

/** Build the left-pane tree: groups in order, then ungrouped categories. */
export function buildTree(
  categories: CategoryWithStats[],
  groups: CategoryGroup[],
  search: string,
  type: CategoryTypeFilter
): CategoryTreeGroup[] {
  const q = search.trim().toLowerCase();
  const keep = categories.filter(
    (c) =>
      (!q || c.name.toLowerCase().includes(q)) &&
      (type === 'all' || (type === 'income' ? c.is_income : !c.is_income))
  );
  const filtering = Boolean(q) || type !== 'all';
  const tree: CategoryTreeGroup[] = [...groups]
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
    .map((g) => ({ id: g.id, name: g.name, colour: g.colour, group: g, categories: keep.filter((c) => c.group_id === g.id) }))
    .filter((g) => g.categories.length > 0 || !filtering);
  const ungrouped = keep.filter((c) => !c.group_id || !groups.some((g) => g.id === c.group_id));
  if (ungrouped.length > 0) tree.push({ id: null, name: 'Ungrouped', colour: null, group: null, categories: ungrouped });
  return tree;
}

export function CategoriesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();
  const rulesRef = useRef<HTMLDivElement>(null);

  const selectedId = params?.get('category') || null;
  const ruleSearch = params?.get('q') ?? '';

  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params?.toString() ?? '');
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rules, setRules] = useState<CategoryMapping[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [catSearch, setCatSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CategoryTypeFilter>('all');

  const [editingCategory, setEditingCategory] = useState<CategoryWithStats | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<CategoryWithStats | null>(null);
  const [reassigningCategory, setReassigningCategory] = useState<CategoryWithStats | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<CategoryGroup | null>(null);

  const [editingRule, setEditingRule] = useState<CategoryMapping | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<CategoryMapping | null>(null);
  const [applyingRule, setApplyingRule] = useState<CategoryMapping | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [categoriesRes, groupsRes] = await Promise.all([fetch('/api/categories?stats=true'), fetch('/api/category-groups')]);
      if (!categoriesRes.ok || !groupsRes.ok) throw new Error('Could not load categories');
      const [categoriesData, groupsData] = await Promise.all([categoriesRes.json(), groupsRes.json()]);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    setRulesError(null);
    try {
      const res = await fetch('/api/categories/rules');
      if (!res.ok) throw await errorFrom(res, 'Could not load rules');
      const data = await res.json();
      setRules(Array.isArray(data) ? data : data.rules || []);
    } catch (err) {
      setRulesError(err instanceof Error ? err.message : 'Could not load rules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchRules();
  }, [fetchData, fetchRules]);

  const tree = useMemo(() => buildTree(categories, groups, catSearch, typeFilter), [categories, groups, catSearch, typeFilter]);
  const ruleCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rules) m.set(r.category_id, (m.get(r.category_id) ?? 0) + 1);
    return m;
  }, [rules]);
  const selected = categories.find((c) => c.id === selectedId) ?? null;

  const select = (id: string | null) => {
    setParams({ category: id });
    // On a phone the rules sit below the list: bring them into view.
    if (id && typeof window !== 'undefined' && window.innerWidth < 1024) {
      requestAnimationFrame(() => rulesRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  };

  const fail = (err: unknown, fallback: string) =>
    toast({ tone: 'error', message: err instanceof Error ? err.message : fallback });

  // ---- categories -----------------------------------------------------------
  const handleSaveCategory = async (data: CategoryFormData) => {
    const group = groups.find((g) => g.id === data.group_id);
    const response = await fetch(editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories', {
      method: editingCategory ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      // group_name is the legacy text column; keep it in step with the group.
      body: JSON.stringify({ ...data, group_name: group?.name ?? 'Ungrouped' }),
    });
    if (!response.ok) throw await errorFrom(response, 'Could not save the category');
    await fetchData();
    toast({ tone: 'success', message: editingCategory ? `Saved ${data.name}` : `Added ${data.name}` });
  };

  const handleConfirmDelete = async (force: boolean) => {
    if (!deletingCategory) return;
    const { id, name } = deletingCategory;
    const response = await fetch(`/api/categories/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) throw await errorFrom(response, 'Could not delete the category');
    setDeletingCategory(null);
    if (selectedId === id) setParams({ category: null });
    await Promise.all([fetchData(), fetchRules()]);
    toast({ message: `Deleted ${name}` });
  };

  const handleReassign = async (targetCategoryId: string) => {
    if (!reassigningCategory) return;
    const response = await fetch(`/api/categories/${reassigningCategory.id}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_category_id: targetCategoryId }),
    });
    if (!response.ok) throw await errorFrom(response, 'Could not move the transactions');
    const target = categories.find((c) => c.id === targetCategoryId);
    setReassigningCategory(null);
    await fetchData();
    toast({ tone: 'success', message: `Moved ${reassigningCategory.name} transactions to ${target?.name ?? 'the new category'}` });
  };

  // ---- groups -------------------------------------------------------------
  const handleSaveGroup = async (data: CategoryGroupFormData) => {
    const response = await fetch(editingGroup ? `/api/category-groups/${editingGroup.id}` : '/api/category-groups', {
      method: editingGroup ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw await errorFrom(response, 'Could not save the group');
    await fetchData();
    toast({ tone: 'success', message: editingGroup ? `Saved ${data.name}` : `Added ${data.name}` });
  };

  const confirmDeleteGroup = async () => {
    const group = deletingGroup;
    setDeletingGroup(null);
    if (!group) return;
    try {
      const response = await fetch(`/api/category-groups/${group.id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) throw await errorFrom(response, 'Could not delete the group');
      await fetchData();
      toast({ message: `Deleted group ${group.name}` });
    } catch (err) {
      fail(err, 'Could not delete the group');
    }
  };

  // ---- rules ----------------------------------------------------------------
  const handleSaveRule = async (data: RuleFormData) => {
    const response = await fetch(editingRule ? `/api/categories/rules/${editingRule.id}` : '/api/categories/rules', {
      method: editingRule ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        editingRule?.is_system
          ? { notes: data.notes }
          : { pattern: data.pattern.trim(), matchType: data.match_type, categoryId: data.category_id, notes: data.notes }
      ),
    });
    if (!response.ok) {
      if (response.status === 409) throw new Error('A rule with this pattern already exists.');
      throw await errorFrom(response, 'Could not save the rule');
    }
    const wasNew = !editingRule;
    const saved = wasNew ? ((await response.json().catch(() => null)) as CategoryMapping | null) : null;
    await fetchRules();
    toast({
      tone: 'success',
      message: wasNew ? 'Rule added' : 'Rule saved',
      action: saved?.id ? { label: 'Apply to existing', onClick: () => setApplyingRule(saved) } : undefined,
    });
  };

  const handleTestRule = async (pattern: string, matchType: string, categoryId: string | null) => {
    const response = await fetch('/api/categories/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', pattern, matchType, categoryId: categoryId ?? '00000000-0000-0000-0000-000000000000' }),
    });
    if (!response.ok) throw await errorFrom(response, 'Could not test the rule');
    const data = await response.json();
    return { totalMatched: data.totalMatched || 0, wouldChange: data.wouldChange || 0 };
  };

  const confirmDeleteRule = async () => {
    const rule = deletingRule;
    setDeletingRule(null);
    if (!rule) return;
    try {
      const response = await fetch(`/api/categories/rules/${rule.id}`, { method: 'DELETE' });
      if (!response.ok) throw await errorFrom(response, 'Could not delete the rule');
      await fetchRules();
      toast({ message: `Deleted rule ${rule.pattern}` });
    } catch (err) {
      fail(err, 'Could not delete the rule');
    }
  };

  const groupCount = groups.length;
  const income = categories.filter((c) => c.is_income).length;

  return (
    <div className="grid gap-6">
      <PageIntro
        actions={
          <>
            <Button
              onClick={() => {
                setEditingGroup(null);
                setIsGroupDialogOpen(true);
              }}
            >
              Add group
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryDialogOpen(true);
              }}
            >
              Add category
            </Button>
          </>
        }
      >
        {isLoading ? (
          <p>Loading categories…</p>
        ) : (
          <p>
            <strong>{categories.length}</strong> categories in <strong>{groupCount}</strong> group{groupCount === 1 ? '' : 's'} ({income} for money
            in), with <strong>{rules.length}</strong> rule{rules.length === 1 ? '' : 's'} filing new transactions automatically. Pick a category to
            see its rules.
          </p>
        )}
      </PageIntro>

      {error && (
        <Notice tone="error" action={<Button size="sm" onClick={fetchData}>Try again</Button>}>
          {error}. Check your connection and try again.
        </Notice>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <CategoryTree
          groups={tree}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={select}
          ruleCounts={ruleCounts}
          totalRules={rules.length}
          search={catSearch}
          onSearch={setCatSearch}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          onEditCategory={(c) => {
            setEditingCategory(c);
            setIsCategoryDialogOpen(true);
          }}
          onDeleteCategory={setDeletingCategory}
          onReassignCategory={setReassigningCategory}
          onEditGroup={(g) => {
            setEditingGroup(g);
            setIsGroupDialogOpen(true);
          }}
          onDeleteGroup={setDeletingGroup}
        />

        <div ref={rulesRef} className="min-w-0 scroll-mt-4 lg:sticky lg:top-4">
          <RulesPanel
            rules={rules}
            isLoading={rulesLoading}
            error={rulesError}
            onRetry={fetchRules}
            selectedCategoryId={selectedId}
            selectedCategoryName={selected?.name ?? null}
            search={ruleSearch}
            onSearch={(q) => setParams({ q: q || null })}
            onAdd={() => {
              setEditingRule(null);
              setIsRuleDialogOpen(true);
            }}
            onEdit={(r) => {
              setEditingRule(r);
              setIsRuleDialogOpen(true);
            }}
            onDelete={setDeletingRule}
            onApply={setApplyingRule}
            onShowAll={() => setParams({ category: null })}
          />
        </div>
      </div>

      <CategoryDialog
        category={editingCategory}
        groups={groups}
        isOpen={isCategoryDialogOpen}
        onClose={() => setIsCategoryDialogOpen(false)}
        onSave={handleSaveCategory}
      />
      <GroupDialog group={editingGroup} isOpen={isGroupDialogOpen} onClose={() => setIsGroupDialogOpen(false)} onSave={handleSaveGroup} />
      <DeleteCategoryDialog
        category={deletingCategory}
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onDelete={handleConfirmDelete}
        onReassign={() => {
          setReassigningCategory(deletingCategory);
          setDeletingCategory(null);
        }}
      />
      <ReassignCategoryDialog
        category={reassigningCategory}
        allCategories={categories}
        isOpen={!!reassigningCategory}
        onClose={() => setReassigningCategory(null)}
        onReassign={handleReassign}
      />
      <RuleDialog
        rule={editingRule}
        categories={categories}
        isOpen={isRuleDialogOpen}
        defaultCategoryId={selectedId}
        onClose={() => setIsRuleDialogOpen(false)}
        onSave={handleSaveRule}
        onTest={handleTestRule}
      />
      <ApplyRuleDialog
        rule={applyingRule}
        onClose={() => setApplyingRule(null)}
        onApplied={(n, name) => {
          setApplyingRule(null);
          toast({
            tone: 'success',
            message: n === 0 ? 'Nothing needed changing' : `Categorised ${n} transaction${n === 1 ? '' : 's'} as ${name}`,
          });
          fetchData();
        }}
      />
      <ConfirmDialog
        isOpen={!!deletingGroup}
        title="Delete group"
        message={deletingGroup ? `Delete the group ${deletingGroup.name}? Only empty groups can be deleted; move its categories first.` : ''}
        confirmLabel="Delete group"
        variant="danger"
        onConfirm={confirmDeleteGroup}
        onCancel={() => setDeletingGroup(null)}
      />
      <ConfirmDialog
        isOpen={!!deletingRule}
        title="Delete rule"
        message={deletingRule ? `Delete the rule "${deletingRule.pattern}"? Transactions already filed by it keep their category.` : ''}
        confirmLabel="Delete rule"
        variant="danger"
        onConfirm={confirmDeleteRule}
        onCancel={() => setDeletingRule(null)}
      />
    </div>
  );
}
