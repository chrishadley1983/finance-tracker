'use client';

import { useState, useEffect } from 'react';
import type { CategoryWithStats } from '@/lib/types/category';
import type { CategoryWithGroup } from '@/lib/hooks/useCategories';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { Field, Input, Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import type { CategoryMapping } from './RulesPanel';

export interface RuleFormData {
  pattern: string;
  match_type: string;
  category_id: string;
  notes: string;
}

export interface RuleTestOutcome {
  totalMatched: number;
  wouldChange: number;
}

interface RuleDialogProps {
  rule: CategoryMapping | null;
  categories: CategoryWithStats[];
  isOpen: boolean;
  /** Category to preselect for a new rule. */
  defaultCategoryId?: string | null;
  onClose: () => void;
  onSave: (data: RuleFormData) => Promise<void>;
  onTest?: (pattern: string, matchType: string, categoryId: string | null) => Promise<RuleTestOutcome>;
}

/** The rules API accepts these three; the engine matches contains on whole words. */
const MATCH_TYPES = [
  { value: 'contains', label: 'Contains', hint: 'Matches when these words appear in the description.' },
  { value: 'exact', label: 'Exact', hint: 'Matches only this exact description.' },
  { value: 'regex', label: 'Pattern (regex)', hint: 'A regular expression, case-insensitive.' },
];

export function RuleDialog({ rule, categories, isOpen, defaultCategoryId = null, onClose, onSave, onTest }: RuleDialogProps) {
  const [formData, setFormData] = useState<RuleFormData>({ pattern: '', match_type: 'contains', category_id: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<RuleTestOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = Boolean(rule?.is_system);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(
      rule
        ? { pattern: rule.pattern, match_type: rule.match_type, category_id: rule.category_id, notes: rule.notes || '' }
        : { pattern: '', match_type: 'contains', category_id: defaultCategoryId ?? '', notes: '' }
    );
    setError(null);
    setTestResult(null);
  }, [rule, isOpen, defaultCategoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id) {
      setError('Choose the category this rule files transactions under.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!onTest || !formData.pattern.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setError(null);
    try {
      setTestResult(await onTest(formData.pattern.trim(), formData.match_type, formData.category_id || null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not test the rule');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={rule ? 'Edit rule' : 'Add rule'}
      onSubmit={handleSubmit}
      scrollBody={false}
      widthClassName="max-w-lg"
      footer={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {rule ? 'Save rule' : 'Add rule'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && <Notice tone="error">{error}</Notice>}
        {locked && <Notice>This is a policy rule. Only its notes can be changed here.</Notice>}
        <Field
          label="Description contains"
          htmlFor="rule-pattern"
          hint={
            testResult ? (
              <span>
                Matches <span className="fig">{testResult.totalMatched}</span> of your latest 1,000 transactions
                {formData.category_id ? (
                  <>
                    ; <span className="fig">{testResult.wouldChange}</span> would change category
                  </>
                ) : null}
                .
              </span>
            ) : undefined
          }
        >
          <div className="flex gap-2">
            <Input
              id="rule-pattern"
              className="fig"
              value={formData.pattern}
              disabled={locked}
              onChange={(e) => {
                setFormData((p) => ({ ...p, pattern: e.target.value }));
                setTestResult(null);
              }}
              placeholder="e.g. TESCO STORES"
              required
            />
            {onTest && (
              <Button onClick={handleTest} disabled={!formData.pattern.trim()} loading={isTesting} className="h-[38px]">
                Test
              </Button>
            )}
          </div>
        </Field>
        <Field label="Match" htmlFor="rule-match" hint={MATCH_TYPES.find((t) => t.value === formData.match_type)?.hint}>
          <Select
            id="rule-match"
            value={formData.match_type}
            disabled={locked}
            onChange={(e) => {
              setFormData((p) => ({ ...p, match_type: e.target.value }));
              setTestResult(null);
            }}
          >
            {MATCH_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <CategorySelect
            value={formData.category_id || null}
            onChange={(id) => {
              setFormData((p) => ({ ...p, category_id: id ?? '' }));
              setTestResult(null);
            }}
            categories={categories as unknown as CategoryWithGroup[]}
            placeholder="Choose a category"
            disabled={locked}
          />
        </Field>
        <Field label="Notes" htmlFor="rule-notes" hint="Optional. Why this rule exists.">
          <Input id="rule-notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} maxLength={1000} />
        </Field>
      </div>
    </Modal>
  );
}
