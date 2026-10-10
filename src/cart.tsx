import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Paise } from './lib/money';

/** Carts are UI state (not money) and are kept per browser. */
export interface CartLine { key: string; itemId: string; name: string; unit: Paise; qty: number; options: string[]; veg?: boolean }
interface Carts { food: { restaurantId: string | null; lines: CartLine[] }; shop: CartLine[] }
const K = 'zetheta-carts';
const empty: Carts = { food: { restaurantId: null, lines: [] }, shop: [] };
const Ctx = createContext<{ carts: Carts; setCarts: (f: (c: Carts) => Carts) => void }>({ carts: empty, setCarts: () => {} });
export function CartProvider({ children }: { children: ReactNode }) {
  const [carts, set] = useState<Carts>(() => { try { return { ...empty, ...JSON.parse(localStorage.getItem(K) || '{}') }; } catch { return empty; } });
  useEffect(() => { try { localStorage.setItem(K, JSON.stringify(carts)); } catch { /* ignore */ } }, [carts]);
  return <Ctx.Provider value={{ carts, setCarts: (f) => set((c) => f(c)) }}>{children}</Ctx.Provider>;
}
export const useCarts = () => useContext(Ctx);
