import { useSyncExternalStore } from 'react';
import type { AppState } from './lib/types';
import { seedState, STATE_VERSION } from './data/seed';

/**
 * Demo persistence: the whole simulated ledger is kept in this browser's localStorage.
 * Limitations (documented in README): per-browser only, can be cleared by the user, not shared
 * between devices, and NOT a secure store — fine for a demo, never for real money.
 */
const KEY = 'zetheta-demo-state';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s && s.version === STATE_VERSION && Array.isArray(s.entries)) return s;
    }
  } catch { /* storage blocked or corrupt — start fresh */ }
  return seedState();
}

let state: AppState = load();
const listeners = new Set<() => void>();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or blocked: keep in memory */ }
}

export const store = {
  get: () => state,
  set(next: AppState) { state = next; save(); listeners.forEach((l) => l()); },
  update(fn: (s: AppState) => AppState) { store.set(fn(state)); },
  reset() { store.set(seedState()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state), () => sel(state));
}
export const useApp = () => useStore((s) => s);
