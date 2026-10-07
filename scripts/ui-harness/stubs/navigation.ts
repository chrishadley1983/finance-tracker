// Minimal app-router stand-in for the harness.
import { useSyncExternalStore } from 'react';
const listeners = new Set<() => void>();
const w = window as unknown as { __path: string; __pushed: string[] };
w.__path = w.__path || '/';
w.__pushed = [];
export function navigate(p: string) {
  w.__path = p;
  w.__pushed.push(p);
  listeners.forEach((l) => l());
}
function useFullPath() {
  return useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => w.__path);
}
/** Path without the query string, like Next's usePathname. */
export function usePathname() {
  const p = useFullPath();
  const i = p.indexOf('?');
  return i >= 0 ? p.slice(0, i) : p;
}
export function useRouter() {
  return { push: navigate, refresh() {}, replace: navigate, back() {} };
}
const paramCache = new Map<string, URLSearchParams>();
/** Stable object per query string, like Next's (effects depending on it don't loop). */
export function useSearchParams() {
  const path = useFullPath();
  const i = path.indexOf('?');
  const qs = i >= 0 ? path.slice(i + 1) : '';
  let p = paramCache.get(qs);
  if (!p) {
    p = new URLSearchParams(qs);
    paramCache.set(qs, p);
  }
  return p;
}
export function notFound(): never {
  throw new Error('notFound');
}
export function redirect(p: string): never {
  navigate(p);
  throw new Error('redirect');
}
