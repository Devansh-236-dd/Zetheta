import { useSyncExternalStore } from 'react';
import { DEMO_PIN } from './data/seed';

/** Demo session. The PIN check runs in the browser and is NOT production authentication. */
interface Session { unlocked: boolean; pinFails: number; lockUntil: number; introSeen: boolean }
const K = 'zetheta-session';
let s: Session = (() => { try { return { pinFails: 0, lockUntil: 0, ...JSON.parse(sessionStorage.getItem(K) || '{}') } as Session; } catch { return { unlocked: false, pinFails: 0, lockUntil: 0, introSeen: false }; } })();
const ls = new Set<() => void>();
const set = (p: Partial<Session>) => { s = { ...s, ...p }; try { sessionStorage.setItem(K, JSON.stringify(s)); } catch { /* ignore */ } ls.forEach((l) => l()); };

export const session = {
  get: () => s,
  set,
  /** Returns 'ok' | 'wrong' | 'locked'. */
  checkPin(pin: string): 'ok' | 'wrong' | 'locked' {
    if (Date.now() < s.lockUntil) return 'locked';
    if (pin === DEMO_PIN) { set({ pinFails: 0, lockUntil: 0 }); return 'ok'; }
    const fails = s.pinFails + 1;
    set({ pinFails: fails, lockUntil: fails >= 3 ? Date.now() + 30000 : 0 });
    return fails >= 3 ? 'locked' : 'wrong';
  },
  otpPass() { set({ pinFails: 0, lockUntil: 0 }); },
  lock() { set({ unlocked: false }); },
  unlock() { set({ unlocked: true, pinFails: 0, lockUntil: 0 }); },
};
export function useSession() {
  return useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => s, () => s);
}
