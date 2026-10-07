'use client';

import { useState, useEffect } from 'react';
import { CategoryWithStats, CategoryGroup, CategoryFormData } from '@/lib/types/category';
import { CheckboxField, Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { ColourPicker } from './ColourPicker';

interface CategoryDialogProps {
  category: CategoryWithStats | null;
  groups: CategoryGroup[];
  isOpen: boolean;
  /** Group to preselect for a new category. */
  defaultGroupId?: string | null;
  onClose: () => void;
  onSave: (data: CategoryFormData) => Promise<void>;
}

const EMPTY: CategoryFormData = { name: '', group_id: null, is_income: false, display_order: 0, exclude_from_totals: false, colour: null };

export function CategoryDialog({ category, groups, isOpen, defaultGroupId = null, onClose, onSave }: CategoryDialogProps) {
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(
      category
        ? {
            name: category.name,
            group_id: category.group_id,
            is_income: category.is_income,
            display_order: category.display_order,
            exclude_from_totals: category.exclude_from_totals,
            colour: category.colour,
          }
        : { ...EMPTY, group_id: defaultGroupId }
    );
    setError(null);
  }, [category, isOpen, defaultGroupId]);

  const set = <K extends keyof CategoryFormData>(k: K, v: CategoryFormData[K]) => setFormData((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={category ? 'Edit category' : 'Add category'}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {category ? 'Save changes' : 'Add category'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Name" htmlFor="category-name">
          <Input id="category-name" value={formData.name} onChange={(e) => set('name', e.target.value)} required maxLength={100} />
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-4">
          <Field label="Group" htmlFor="category-group">
            <Select id="category-group" value={formData.group_id || ''} onChange={(e) => set('group_id', e.target.value || null)}>
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Order" htmlFor="category-order">
            <Input
              id="category-order"
              type="number"
              min="0"
              value={formData.display_order}
              onChange={(e) => set('display_order', parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
        <div className="grid gap-2.5">
          <CheckboxField id="category-income" checked={formData.is_income} onChange={(v) => set('is_income', v)}>
            Money in (income category)
          </CheckboxField>
          <CheckboxField id="category-exclude" checked={formData.exclude_from_totals} onChange={(v) => set('exclude_from_totals', v)}>
            Leave out of spending and income totals (e.g. transfers)
          </CheckboxField>
        </div>
        <ColourPicker value={formData.colour} onChange={(colour) => set('colour', colour)} />
      </div>
    </Modal>
  );
}
