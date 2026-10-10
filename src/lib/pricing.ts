import type { Paise } from './money';
import { bps } from './money';

export interface Line { label: string; amount: Paise; kind?: 'base' | 'fee' | 'tax' | 'discount' }
export interface Totals { lines: Line[]; subtotal: Paise; discount: Paise; total: Paise }

const sum = (xs: Paise[]) => xs.reduce((a, b) => a + b, 0);

/** Food: coupon applies to item total; GST 5% on items after discount; fees on top. */
export function foodTotals(items: { unit: Paise; qty: number }[], r: { deliveryFee: Paise; packaging: Paise }, discount: Paise = 0): Totals {
  const itemTotal = sum(items.map((i) => i.unit * i.qty));
  const d = Math.min(discount, itemTotal);
  const gst = bps(itemTotal - d, 500);
  const platform = itemTotal > 0 ? 500 : 0;
  const lines: Line[] = [
    { label: 'Item total', amount: itemTotal, kind: 'base' },
    ...(d ? [{ label: 'Coupon discount', amount: -d, kind: 'discount' as const }] : []),
    { label: 'Packaging', amount: itemTotal ? r.packaging : 0, kind: 'fee' },
    { label: 'Delivery fee', amount: itemTotal ? r.deliveryFee : 0, kind: 'fee' },
    { label: 'Platform fee', amount: platform, kind: 'fee' },
    { label: 'GST (5% on food)', amount: gst, kind: 'tax' },
  ];
  return { lines, subtotal: itemTotal, discount: d, total: sum(lines.map((l) => l.amount)) };
}

/** Tickets: convenience fee 6% of base, 18% GST on that fee. Coupon on base. */
export function ticketTotals(unit: Paise, qty: number, discount: Paise = 0): Totals {
  return ticketTotalsFromBase(unit * qty, qty, discount, `Tickets (${qty} × ₹${unit / 100})`);
}
export function ticketTotalsFromBase(base: Paise, qty: number, discount: Paise = 0, label = `Tickets (${qty})`): Totals {
  const d = Math.min(discount, base);
  const fee = bps(base, 600);
  const feeGst = bps(fee, 1800);
  const lines: Line[] = [
    { label, amount: base, kind: 'base' },
    ...(d ? [{ label: 'Coupon discount', amount: -d, kind: 'discount' as const }] : []),
    { label: 'Convenience fee (6%)', amount: fee, kind: 'fee' },
    { label: 'GST on fee (18%)', amount: feeGst, kind: 'tax' },
  ];
  return { lines, subtotal: base, discount: d, total: sum(lines.map((l) => l.amount)) };
}

/** Travel: fare × passengers + per-passenger booking fee + 18% GST on that fee; flights add 12% taxes on fare. */
export function travelTotals(fare: Paise, pax: number, mode: 'train' | 'flight' | 'bus', discount: Paise = 0): Totals {
  const base = fare * pax;
  const d = Math.min(discount, base);
  const feeEach = mode === 'flight' ? 19900 : mode === 'train' ? 4000 : 2500;
  const fee = feeEach * pax;
  const taxes = mode === 'flight' ? bps(base, 1200) : 0;
  const feeGst = bps(fee, 1800);
  const lines: Line[] = [
    { label: `Fare (${pax} × ₹${fare / 100})`, amount: base, kind: 'base' },
    ...(d ? [{ label: 'Coupon discount', amount: -d, kind: 'discount' as const }] : []),
    ...(taxes ? [{ label: 'Airport & govt taxes (12%)', amount: taxes, kind: 'tax' as const }] : []),
    { label: `Booking fee (${pax} × ₹${feeEach / 100})`, amount: fee, kind: 'fee' },
    { label: 'GST on fee (18%)', amount: feeGst, kind: 'tax' },
  ];
  return { lines, subtotal: base, discount: d, total: sum(lines.map((l) => l.amount)) };
}

export function hotelTotals(rate: Paise, nights: number, rooms: number, discount: Paise = 0): Totals {
  const base = rate * nights * rooms;
  const d = Math.min(discount, base);
  const gst = bps(base - d, 1200);
  const lines: Line[] = [
    { label: `Room (${rooms} × ${nights} night${nights > 1 ? 's' : ''} × ₹${rate / 100})`, amount: base, kind: 'base' },
    ...(d ? [{ label: 'Coupon discount', amount: -d, kind: 'discount' as const }] : []),
    { label: 'GST (12%)', amount: gst, kind: 'tax' },
  ];
  return { lines, subtotal: base, discount: d, total: sum(lines.map((l) => l.amount)) };
}

/** Simple: subtotal minus discount, optional flat fee. Used for bills, shopping, transport. */
export function simpleTotals(label: string, subtotal: Paise, discount: Paise = 0, fee: Paise = 0, feeLabel = 'Fee'): Totals {
  const d = Math.min(discount, subtotal);
  const lines: Line[] = [
    { label, amount: subtotal, kind: 'base' },
    ...(d ? [{ label: 'Coupon discount', amount: -d, kind: 'discount' as const }] : []),
    ...(fee ? [{ label: feeLabel, amount: fee, kind: 'fee' as const }] : []),
  ];
  return { lines, subtotal, discount: d, total: sum(lines.map((l) => l.amount)) };
}

/** Cancellation refund policy (demo): ≥ 48h before → 90%, ≥ 4h → 50%, else 0. Food: full before "out for delivery". */
export function refundFor(amount: Paise, hoursBefore: number): { amount: Paise; rule: string } {
  if (hoursBefore >= 48) return { amount: bps(amount, 9000), rule: '90% refund (48+ hours before start)' };
  if (hoursBefore >= 4) return { amount: bps(amount, 5000), rule: '50% refund (4–48 hours before start)' };
  return { amount: 0, rule: 'No refund within 4 hours of start' };
}
