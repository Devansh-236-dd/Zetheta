import type { Paise } from './money';
import { bps, formatINR } from './money';
import type { Category, CouponUse } from './types';

export interface Coupon {
  code: string;
  title: string;
  description: string;
  kind: 'percent' | 'fixed';
  value: number;            // basis points for percent (5000 = 50%), paise for fixed
  maxDiscount?: Paise;
  minSpend: Paise;
  categories: Category[];
  startsAt: number;
  expiresAt: number;
  singleUse: boolean;
}

const DAY = 86400000;
const T0 = Date.UTC(2026, 0, 1);
const T1 = Date.UTC(2027, 11, 31);

/** Example demo promotions — not real offers. */
export const COUPONS: Coupon[] = [
  { code: 'FOOD50', title: '50% off food', description: '50% off eligible food orders, up to ₹120. Minimum order ₹199. One use.', kind: 'percent', value: 5000, maxDiscount: 12000, minSpend: 19900, categories: ['food'], startsAt: T0, expiresAt: T1, singleUse: true },
  { code: 'TRAVEL100', title: '₹100 off travel', description: '₹100 off trains, flights, buses and hotels. Minimum ₹999. One use.', kind: 'fixed', value: 10000, minSpend: 99900, categories: ['travel'], startsAt: T0, expiresAt: T1, singleUse: true },
  { code: 'MOVIE75', title: '₹75 off tickets', description: '₹75 off movie and event tickets. Minimum ₹300. One use.', kind: 'fixed', value: 7500, minSpend: 30000, categories: ['entertainment'], startsAt: T0, expiresAt: T1, singleUse: true },
  { code: 'SHOP10', title: '10% off shopping', description: '10% off shopping, up to ₹200. Minimum ₹500. Reusable.', kind: 'percent', value: 1000, maxDiscount: 20000, minSpend: 50000, categories: ['shopping'], startsAt: T0, expiresAt: T1, singleUse: false },
  { code: 'BILL25', title: '₹25 off bills', description: '₹25 off any bill or recharge of ₹300 or more. Reusable.', kind: 'fixed', value: 2500, minSpend: 30000, categories: ['bills'], startsAt: T0, expiresAt: T1, singleUse: false },
  { code: 'RIDE20', title: '20% off rides & passes', description: '20% off metro, bus passes, parking and rides, up to ₹60. Reusable.', kind: 'percent', value: 2000, maxDiscount: 6000, minSpend: 5000, categories: ['transport'], startsAt: T0, expiresAt: T1, singleUse: false },
  { code: 'MONSOON30', title: 'Monsoon food deal', description: 'Expired demo coupon — shows how expiry is enforced.', kind: 'percent', value: 3000, maxDiscount: 10000, minSpend: 10000, categories: ['food'], startsAt: T0, expiresAt: Date.UTC(2026, 8, 30), singleUse: false },
  { code: 'DIWALI200', title: 'Festive travel deal', description: 'Starts 1 Nov 2026 — shows how start dates are enforced.', kind: 'fixed', value: 20000, minSpend: 200000, categories: ['travel'], startsAt: Date.UTC(2026, 10, 1), expiresAt: Date.UTC(2026, 10, 15) + DAY, singleUse: true },
];

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: Paise; message: string }
  | { ok: false; reason: string };

const CAT_LABEL: Record<string, string> = { food: 'food orders', travel: 'travel bookings', entertainment: 'movie and event tickets', shopping: 'shopping', bills: 'bills and recharges', transport: 'transport' };

export function validateCoupon(rawCode: string, ctx: { category: Category; subtotal: Paise; now: number; uses: CouponUse[] }): CouponResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'Enter a coupon code.' };
  if (!/^[A-Z0-9]{3,16}$/.test(code)) return { ok: false, reason: 'Coupon codes use only letters and numbers.' };
  const c = COUPONS.find((x) => x.code === code);
  if (!c) return { ok: false, reason: `${code} isn’t a Zetheta demo coupon. Check the Offers page for valid codes.` };
  if (ctx.now < c.startsAt) return { ok: false, reason: `${code} starts on ${new Date(c.startsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` };
  if (ctx.now > c.expiresAt) return { ok: false, reason: `${code} expired on ${new Date(c.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` };
  if (!c.categories.includes(ctx.category)) return { ok: false, reason: `${code} only works on ${c.categories.map((k) => CAT_LABEL[k] ?? k).join(', ')}.` };
  if (c.singleUse && ctx.uses.some((u) => u.code === code)) return { ok: false, reason: `You’ve already used ${code}. It works once per account.` };
  if (ctx.subtotal < c.minSpend) return { ok: false, reason: `Add ${formatINR(c.minSpend - ctx.subtotal)} more to use ${code} (minimum ${formatINR(c.minSpend)}).` };
  let d = c.kind === 'percent' ? bps(ctx.subtotal, c.value) : c.value;
  if (c.maxDiscount !== undefined) d = Math.min(d, c.maxDiscount);
  d = Math.min(d, ctx.subtotal);
  return { ok: true, coupon: c, discount: d, message: `${code} applied. You save ${formatINR(d)}.` };
}
