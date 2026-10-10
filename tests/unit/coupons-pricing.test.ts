import { validateCoupon } from '../../src/lib/coupons';
import { foodTotals, ticketTotals, travelTotals, refundFor } from '../../src/lib/pricing';
import { rs } from '../../src/lib/money';

const now = Date.UTC(2026, 9, 10);
describe('coupons', () => {
  it('applies percent with a cap', () => {
    const r = validateCoupon('food50', { category: 'food', subtotal: rs(400), now, uses: [] });
    expect(r.ok && r.discount).toBe(rs(120));
  });
  it('rejects wrong category, min spend, expiry, start date and reuse', () => {
    expect(validateCoupon('FOOD50', { category: 'travel', subtotal: rs(400), now, uses: [] }).ok).toBe(false);
    const min = validateCoupon('FOOD50', { category: 'food', subtotal: rs(150), now, uses: [] });
    expect(!min.ok && min.reason).toMatch(/Add ₹49 more/);
    expect(validateCoupon('MONSOON30', { category: 'food', subtotal: rs(400), now, uses: [] }).ok).toBe(false);
    expect(validateCoupon('DIWALI200', { category: 'travel', subtotal: rs(4000), now, uses: [] }).ok).toBe(false);
    expect(validateCoupon('MOVIE75', { category: 'entertainment', subtotal: rs(400), now, uses: [{ code: 'MOVIE75', txnId: 't', ts: 0 }] }).ok).toBe(false);
    expect(validateCoupon('NOPE', { category: 'food', subtotal: rs(400), now, uses: [] }).ok).toBe(false);
  });
  it('never discounts more than the eligible amount', () => {
    const r = validateCoupon('TRAVEL100', { category: 'travel', subtotal: rs(999), now, uses: [] });
    expect(r.ok && r.discount).toBe(rs(100));
  });
});

describe('pricing', () => {
  it('food total always equals the sum of its lines', () => {
    const t = foodTotals([{ unit: rs(219), qty: 2 }, { unit: rs(49), qty: 1 }], { deliveryFee: rs(29), packaging: rs(15) }, rs(120));
    expect(t.total).toBe(t.lines.reduce((a, l) => a + l.amount, 0));
    expect(t.subtotal).toBe(rs(487));
    // GST 5% on (487-120)=367 → 18.35
    expect(t.lines.find((l) => l.kind === 'tax')?.amount).toBe(1835);
  });
  it('ticket and travel totals add fees and GST in paise', () => {
    const t = ticketTotals(rs(220), 2);
    expect(t.total).toBe(rs(440) + 2640 + 475);
    const f = travelTotals(rs(5000), 2, 'flight');
    expect(f.total).toBe(rs(10000) + rs(1200) + rs(398) + 7164);
  });
  it('refund policy tiers', () => {
    expect(refundFor(rs(1000), 72).amount).toBe(rs(900));
    expect(refundFor(rs(1000), 10).amount).toBe(rs(500));
    expect(refundFor(rs(1000), 1).amount).toBe(0);
  });
});
