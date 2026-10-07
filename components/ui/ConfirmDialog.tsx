'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = destroys something; warning = overwrites or changes a lot; default = neither. */
  variant?: 'danger' | 'warning' | 'default';
  /** Shows a spinner on the confirm button while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape (not while the action is running)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, onCancel]);

  // Focus the dialog, and hand focus back to whatever opened it on close
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current.focus();
    return () => opener?.focus?.();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        tabIndex={-1}
        className="relative mx-4 w-full max-w-md rounded-md border border-line bg-surface p-6 shadow-xl focus:outline-none"
      >
        <h2
          id="confirm-dialog-title"
          className="mb-2 text-lg font-semibold text-ink"
        >
          {title}
        </h2>
        <div
          id="confirm-dialog-description"
          className="mb-6 text-sm text-ink-2"
        >
          {message}
        </div>

        <div className="flex justify-end gap-3">
          <Button onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            className={variant === 'danger' ? 'font-semibold' : ''}
            loading={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
