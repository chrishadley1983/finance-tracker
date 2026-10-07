'use client';

import { useState, useEffect } from 'react';
import { CategoryGroup, CategoryGroupFormData } from '@/lib/types/category';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';

interface GroupDialogProps {
  group: CategoryGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CategoryGroupFormData) => Promise<void>;
}

export function GroupDialog({ group, isOpen, onClose, onSave }: GroupDialogProps) {
  const [formData, setFormData] = useState<CategoryGroupFormData>({ name: '', display_order: 0, colour: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(group ? { name: group.name, display_order: group.display_order, colour: group.colour } : { name: '', display_order: 0, colour: null });
    setError(null);
  }, [group, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={group ? 'Edit group' : 'Add group'}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {group ? 'Save changes' : 'Add group'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid grid-cols-[1fr_110px] gap-4">
          <Field label="Name" htmlFor="group-name">
            <Input id="group-name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} required maxLength={100} />
          </Field>
          <Field label="Order" htmlFor="group-order">
            <Input
              id="group-order"
              type="number"
              min="0"
              value={formData.display_order}
              onChange={(e) => setFormData((p) => ({ ...p, display_order: parseInt(e.target.value) || 0 }))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
