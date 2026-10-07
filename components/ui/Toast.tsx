'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  /**
   * Auto-dismiss delay. Defaults to 5000ms, except 'error' toasts which stay
   * until dismissed unless a duration is given. Pass Infinity to keep any toast.
   */
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

export interface ToastApi {
  /** Show a toast; returns its id. */
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const DEFAULT_DURATION_MS = 5000;
const MAX_VISIBLE = 4;

const noop: ToastApi = { toast: () => -1, dismiss: () => {} };

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast API. Outside a ToastProvider it is a no-op. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noop;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...options, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  // Nested providers defer to the outermost one so there is a single stack.
  const parent = useContext(ToastContext);
  if (parent) return <>{children}</>;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toneDot: Record<ToastTone, string> = {
  neutral: '',
  success: 'bg-in',
  error: 'bg-bad',
};

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const tone = item.tone ?? 'neutral';
  const duration = item.durationMs ?? (tone === 'error' ? Infinity : DEFAULT_DURATION_MS);

  useEffect(() => {
    if (!Number.isFinite(duration)) return;
    const timer = setTimeout(() => onDismiss(item.id), duration);
    return () => clearTimeout(timer);
  }, [duration, item.id, onDismiss]);

  return (
    <div
      data-tone={tone}
      className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-md bg-bar py-2.5 pl-4 pr-2 text-sm text-bar-ink shadow-lg"
    >
      {tone !== 'neutral' && (
        <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot[tone]}`} aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        {tone === 'error' && <span className="sr-only">Error: </span>}
        {item.message}
      </span>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="shrink-0 rounded-md px-2 py-1 font-medium text-bar-ink underline underline-offset-2 hover:no-underline"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded-md p-1 text-bar-ink opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
