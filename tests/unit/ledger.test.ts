import { seedState } from '../../src/data/seed';
import { balance, checkout, myBalance, post, refund, redeemPoints, pointsBalance, transfer, createRequest, payRequest, ledgerIsConsistent, DomainError, topUp } from '../../src/lib/ledger';
import { rs } from '../../src/lib/money';

const fresh = () => seedState(Date.UTC(2026, 9, 10));

describe('ledger', () => {
  it('seeds a consistent ledger', () => {
    const s = fresh();
    expect(ledgerIsConsistent(s)).toBe(true);
    expect(myBalance(s)).toBeGreaterThan(0);
  });

  it('transfers debit me and credit the recipient exactly', () => {
    const s = fresh();
    const before = myBalance(s), rb = balance(s, 'u_rahul');
    const r = transfer(s, 'u_rahul', rs(250), 'k1');
    expect(r.txn.status).toBe('success');
    expect(myBalance(r.state)).toBe(before - rs(250));
    expect(balance(r.state, 'u_rahul')).toBe(rb + rs(250));
    expect(ledgerIsConsistent(r.state)).toBe(true);
  });

  it('rejects duplicates with the same idempotency key', () => {
    const s = transfer(fresh(), 'u_rahul', rs(10), 'dup').state;
    expect(() => transfer(s, 'u_rahul', rs(10), 'dup')).toThrow(DomainError);
  });

  it('records insufficient balance as failed without debiting', () => {
    const s = fresh();
    const before = myBalance(s);
    const r = transfer(s, 'u_rahul', before + 100, 'big');
    expect(r.txn.status).toBe('failed');
    expect(myBalance(r.state)).toBe(before);
    expect(ledgerIsConsistent(r.state)).toBe(true);
  });

  it('rejects zero, negative and fractional amounts', () => {
    const s = fresh();
    expect(() => transfer(s, 'u_rahul', 0, 'z')).toThrow(/greater than zero/);
    expect(() => transfer(s, 'u_rahul', -100, 'n')).toThrow();
    expect(() => transfer(s, 'u_rahul', 10.5, 'f')).toThrow();
  });

  it('simulated bank failure does not debit and clears the flag', () => {
    let s = fresh();
    s = { ...s, settings: { ...s.settings, simulateFailureNext: true } };
    const before = myBalance(s);
    const r = transfer(s, 'u_rahul', rs(10), 'sim');
    expect(r.txn.status).toBe('failed');
    expect(myBalance(r.state)).toBe(before);
    expect(r.state.settings.simulateFailureNext).toBe(false);
  });

  it('checkout attaches booking, coupon use and points atomically', () => {
    const s = fresh();
    const p0 = pointsBalance(s);
    const r = checkout(s, { key: 'c1', category: 'food', merchantId: 'm_food', title: 'Dinner', total: rs(500), coupon: { code: 'FOOD50', subtotal: rs(400), discount: rs(120) },
      attach: (t) => ({ orders: [{ id: 'o1', kind: 'food', ref: 'X', merchantId: 'm_food', merchantName: 'x', lines: [], totals: [], total: rs(500), ts: t.ts, txnId: t.id, status: 'placed' }] }) }, Date.UTC(2026, 9, 10));
    expect(r.state.orders[0].txnId).toBe(r.txn.id);
    expect(r.state.couponUses.some((u) => u.code === 'FOOD50')).toBe(true);
    expect(pointsBalance(r.state)).toBe(p0 + 5);
    expect(() => checkout(r.state, { key: 'c2', category: 'food', merchantId: 'm_food', title: 'Again', total: rs(500), coupon: { code: 'FOOD50', subtotal: rs(400), discount: rs(120) } }, Date.UTC(2026, 9, 10))).toThrow(/already used/);
  });

  it('failed checkout creates no booking', () => {
    const s = fresh();
    const r = checkout(s, { key: 'c3', category: 'travel', merchantId: 'm_air', title: 'Flight', total: myBalance(s) + 1, attach: () => ({ bookings: [{} as never] }) });
    expect(r.txn.status).toBe('failed');
    expect(r.state.bookings.length).toBe(s.bookings.length);
  });

  it('refunds return money, cap at remaining and reverse points', () => {
    const s0 = fresh();
    const c = checkout(s0, { key: 'c4', category: 'entertainment', merchantId: 'm_shows', title: 'Show', total: rs(1000) });
    const mid = myBalance(c.state);
    const r1 = refund(c.state, c.txn.id, rs(400), 'partial');
    expect(myBalance(r1.state)).toBe(mid + rs(400));
    expect(r1.state.txns.find((t) => t.id === c.txn.id)?.status).toBe('partially_refunded');
    expect(() => refund(r1.state, c.txn.id, rs(700), 'too much')).toThrow(/Only/);
    const r2 = refund(r1.state, c.txn.id, rs(600), 'rest');
    expect(r2.state.txns.find((t) => t.id === c.txn.id)?.status).toBe('refunded');
    expect(ledgerIsConsistent(r2.state)).toBe(true);
  });

  it('redeems points once per key and in blocks of 100', () => {
    let s = topUp(fresh(), rs(1), 'x').state;
    s = { ...s, points: [...s.points, { id: 'pp', ts: 0, delta: 300, reason: 'test' }] };
    const before = myBalance(s), p = pointsBalance(s);
    const r = redeemPoints(s, 200, 'red1');
    expect(myBalance(r.state)).toBe(before + 2000);
    expect(pointsBalance(r.state)).toBe(p - 200);
    expect(() => redeemPoints(r.state, 200, 'red1')).toThrow(/already processed/);
    expect(() => redeemPoints(r.state, 150, 'red2')).toThrow(/blocks of 100/);
  });

  it('payment requests credit me when another demo user pays', () => {
    const s = fresh();
    const { state, request } = createRequest(s, rs(300), 'Lunch');
    const before = myBalance(state);
    const r = payRequest(state, request.id, 'u_arjun', null, 'pr1');
    expect(myBalance(r.state)).toBe(before + rs(300));
    expect(r.state.requests[0].status).toBe('paid');
    expect(() => payRequest(r.state, request.id, 'u_arjun', null, 'pr2')).toThrow(/already paid/);
  });

  it('cannot pay yourself or unknown accounts', () => {
    const s = fresh();
    expect(() => post(s, { key: 'a', type: 'transfer_out', category: 'transfer', from: s.me, to: s.me, amount: 100, title: 'x' })).toThrow(/yourself/);
    expect(() => post(s, { key: 'b', type: 'transfer_out', category: 'transfer', from: s.me, to: 'u_ghost', amount: 100, title: 'x' })).toThrow(/doesn’t exist/);
  });
});
