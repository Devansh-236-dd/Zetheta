import { useSyncExternalStore } from 'react';

/**
 * Tiny hash router with its own back stack, so the in-app Back button always works
 * (even inside an embedded viewer where browser history is unreliable).
 */
let memPath = '/';
const listeners = new Set<() => void>();
const read = () => {
  try { const h = window.location.hash.replace(/^#/, ''); return h.startsWith('/') ? h : memPath; } catch { return memPath; }
};
let current = read();
const stack: string[] = [current];
const emit = () => { listeners.forEach((l) => l()); };
const setHash = (path: string) => { try { window.history.replaceState(null, '', '#' + path); } catch { /* ignore */ } };
const scrollTop = () => { const sc = document.getElementById('scroller'); if (sc) sc.scrollTop = 0; };

window.addEventListener('hashchange', () => {
  const p = read();
  if (p === current) return;
  const i = stack.lastIndexOf(p);
  if (i >= 0) stack.splice(i + 1); else stack.push(p);
  current = p; emit();
});

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  memPath = path;
  if (path === current) { scrollTop(); return; }
  if (opts.replace) stack[stack.length - 1] = path; else stack.push(path);
  if (stack.length > 60) stack.splice(0, stack.length - 60);
  current = path; setHash(path); emit(); scrollTop();
}

/** Go to the previous in-app screen; if there is none, go to the given parent screen. */
export function back(fallback = '/') {
  if (stack.length > 1) {
    stack.pop();
    const prev = stack[stack.length - 1];
    current = memPath = prev; setHash(prev); emit(); scrollTop();
    return;
  }
  stack[0] = fallback || '/';
  current = memPath = stack[0]; setHash(current); emit(); scrollTop();
}
/** Clears history and goes home (used when the app is "restarted"). */
export function resetTo(path = '/') { stack.splice(0, stack.length, path); current = memPath = path; setHash(path); emit(); scrollTop(); }

export function usePath() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current, () => current);
}
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = path.split('?')[0].split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
