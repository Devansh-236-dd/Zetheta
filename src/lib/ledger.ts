/**
 * Demo wallet ledger. Double-entry: every successful transaction writes entries that sum to zero,
 * balances are derived from entries, and every operation is a pure function that returns a NEW state.
 * Nothing is mutated, so a failed operation can never leave a half-written wallet.
 * This is a simulation for a hackathon demo — it is not a real payment system.
 */
import type { Paise } from './money';
import { formatINR, rs } from './money';
import type { AccountId, AppState, Booking, Category, Notif, Order, Txn, TxnType } from './types';
import { rid, txnRef } from './ids';
import { validateCoupon } from './coupons';

export const PER_TXN_LIMIT: Paise = rs(200000);
export const SYS_BANK = 'sys_bank';
export const SYS_REWARDS = 'sys_rewards';

export class DomainError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function balance(s: AppState, account: AccountId): Paise {
  let b = 0;
  for (const e of s.entries) if (e.account === account) b += e.delta;
  return b;
}
export const myBalance = (s: AppState) => balance(s, s.me);
export const pointsBalance = (s: AppState) => s.points.reduce((a, p) => a + p.delta, 0);
export const lifetimePoints = (s: AppState) => s.points.filter((p) => p.delta > 0).reduce((a, p) => a + p.delta, 0);

export function accountName(s: AppState, id: AccountId): string {
  if (id === SYS_BANK) return 'Linked bank (demo)';
  if (id === SYS_REWARDS) return 'Zetheta Rewards';
  return s.users.find((u) => u.id === id)?.name ?? s.merchants.find((m) => m.id === id)?.name ?? 'Unknown account';
}
const accountExists = (s: AppState, id: AccountId) =>
  id === SYS_BANK || id === SYS_REWARDS || s.users.some((u) => u.id === id) || s.merchants.some((m) => m.id === id);

export interface PostSpec {
  key: string;
  type: TxnType;
  category: Category;
  from: AccountId;
  to: AccountId;
  amount: Paise;
  title: string;
  note?: string;
  meta?: Txn['meta'];
  ts?: number;
}

export function notify(s: AppState, n: Omit<Notif, 'id' | 'ts' | 'read'>, ts = Date.now()): AppState {
  return { ...s, notifications: [{ id: rid('n_'), ts, read: false, ...n }, ...s.notifications].slice(0, 60) };
}

/** Moves money between two accounts. Returns the new state and the transaction (which may be status "failed"). */
export function post(s: AppState, spec: PostSpec): { state: AppState; txn: Txn } {
  if (!spec.key) throw new DomainError('no_key', 'Missing idempotency key.');
  if (s.processedKeys.includes(spec.key)) throw new DomainError('duplicate', 'This payment was already processed. It won’t be charged twice.');
  if (!Number.isSafeInteger(spec.amount) || spec.amount <= 0) throw new DomainError('invalid_amount', 'Enter an amount greater than zero.');
  if (spec.amount > PER_TXN_LIMIT) throw new DomainError('over_limit', `You can pay up to ${formatINR(PER_TXN_LIMIT)} in one transaction.`);
  if (spec.from === spec.to) throw new DomainError('same_account', 'You can’t pay yourself.');
  if (!accountExists(s, spec.from) || !accountExists(s, spec.to)) throw new DomainError('unknown_account', 'That account doesn’t exist in this demo.');

  const ts = spec.ts ?? Date.now();
  const iAmSender = spec.from === s.me;
  const base: Txn = {
    id: rid('t_'), ref: txnRef(), ts, type: spec.type, category: spec.category, amount: spec.amount,
    direction: iAmSender ? 'debit' : 'credit', from: spec.from, to: spec.to,
    counterparty: accountName(s, iAmSender ? spec.to : spec.from), title: spec.title, status: 'success',
    note: spec.note, meta: spec.meta,
  };
  const keys = [...s.processedKeys, spec.key].slice(-500);

  let failure: string | undefined;
  if (iAmSender && s.settings.simulateFailureNext) failure = 'The bank didn’t respond (simulated failure). No money left your wallet.';
  else if (spec.from.startsWith('u_')) {
    const bal = balance(s, spec.from);
    if (bal < spec.amount) failure = iAmSender
      ? `Not enough balance. You have ${formatINR(bal)} and this needs ${formatINR(spec.amount)}.`
      : `${accountName(s, spec.from)} doesn’t have enough demo balance.`;
  }
  if (failure) {
    const txn: Txn = { ...base, status: 'failed', failureReason: failure };
    const settings = iAmSender && s.settings.simulateFailureNext ? { ...s.settings, simulateFailureNext: false } : s.settings;
    return { state: { ...s, settings, processedKeys: keys, txns: [txn, ...s.txns] }, txn };
  }
  const entries = [
    ...s.entries,
    { id: rid('e_'), txnId: base.id, account: spec.from, delta: -spec.amount },
    { id: rid('e_'), txnId: base.id, account: spec.to, delta: spec.amount },
  ];
  return { state: { ...s, entries, processedKeys: keys, txns: [base, ...s.txns] }, txn: base };
}

export function topUp(s: AppState, amount: Paise, key: string, ts?: number) {
  const r = post(s, { key, type: 'topup', category: 'topup', from: SYS_BANK, to: s.me, amount, title: 'Added money from linked bank (demo)', ts });
  return { ...r, state: notify(r.state, { kind: 'payment', title: 'Money added', body: `${formatINR(amount)} added to your wallet (demo).` }, ts) };
}

export function transfer(s: AppState, to: AccountId, amount: Paise, key: string, note?: string, ts?: number) {
  const r = post(s, { key, type: 'transfer_out', category: 'transfer', from: s.me, to, amount, title: `Sent to ${accountName(s, to)}`, note, ts });
  if (r.txn.status !== 'success') return r;
  return { ...r, state: notify(r.state, { kind: 'payment', title: 'Payment sent', body: `${formatINR(amount)} sent to ${accountName(s, to)}. Ref ${r.txn.ref}.` }, ts) };
}

export interface CheckoutSpec {
  key: string;
  category: Category;
  merchantId: AccountId;
  title: string;
  total: Paise;
  coupon?: { code: string; subtotal: Paise; discount: Paise };
  meta?: Txn['meta'];
  attach?: (txn: Txn) => { bookings?: Booking[]; orders?: Order[] };
  ts?: number;
}

/** Pays a merchant and atomically attaches the booking/order, coupon use and reward points. */
export function checkout(s: AppState, spec: CheckoutSpec, now = Date.now()) {
  if (spec.coupon) {
    const v = validateCoupon(spec.coupon.code, { category: spec.category, subtotal: spec.coupon.subtotal, now, uses: s.couponUses });
    if (!v.ok) throw new DomainError('coupon_invalid', v.reason);
    if (v.discount !== spec.coupon.discount) throw new DomainError('stale_price', 'The price changed. Please review the new total.');
  }
  const r = post(s, { key: spec.key, type: 'purchase', category: spec.category, from: s.me, to: spec.merchantId, amount: spec.total, title: spec.title, meta: { ...(spec.meta ?? {}), ...(spec.coupon ? { coupon: spec.coupon.code, discount: spec.coupon.discount } : {}) }, ts: spec.ts });
  if (r.txn.status !== 'success') return r;
  let st = r.state;
  if (spec.coupon) st = { ...st, couponUses: [...st.couponUses, { code: spec.coupon.code.toUpperCase(), txnId: r.txn.id, ts: now }] };
  const earned = Math.floor(spec.total / 10000);
  if (earned > 0) st = { ...st, points: [...st.points, { id: rid('p_'), ts: r.txn.ts, delta: earned, reason: `Earned on ${spec.title}`, txnId: r.txn.id }] };
  if (spec.attach) {
    const a = spec.attach(r.txn);
    if (a.bookings) st = { ...st, bookings: [...a.bookings, ...st.bookings] };
    if (a.orders) st = { ...st, orders: [...a.orders, ...st.orders] };
  }
  st = notify(st, { kind: spec.category === 'food' || spec.category === 'shopping' ? 'order' : spec.category === 'bills' ? 'payment' : 'booking', title: 'Payment successful', body: `${formatINR(spec.total)} paid to ${accountName(s, spec.merchantId)} for ${spec.title}.${earned ? ` +${earned} reward points.` : ''}` }, spec.ts);
  return { state: st, txn: r.txn };
}

/** Refunds part or all of a purchase back to the wallet; reverses reward points proportionally. */
export function refund(s: AppState, txnId: string, amount: Paise, reason: string) {
  const orig = s.txns.find((t) => t.id === txnId);
  if (!orig) throw new DomainError('not_found', 'Transaction not found.');
  if (orig.type !== 'purchase') throw new DomainError('not_refundable', 'Only purchases can be refunded.');
  if (orig.status !== 'success' && orig.status !== 'partially_refunded') throw new DomainError('not_refundable', 'This transaction can’t be refunded.');
  const remaining = orig.amount - (orig.refundedAmount ?? 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new DomainError('invalid_amount', 'Refund amount must be more than zero.');
  if (amount > remaining) throw new DomainError('over_refund', `Only ${formatINR(remaining)} is left to refund.`);
  const n = s.txns.filter((t) => t.refundOf === txnId).length;
  const r = post(s, { key: `refund:${txnId}:${n}`, type: 'refund', category: 'refund', from: orig.to, to: s.me, amount, title: `Refund: ${orig.title}`, note: reason });
  if (r.txn.status !== 'success') throw new DomainError('refund_failed', r.txn.failureReason ?? 'Refund failed.');
  const refunded = (orig.refundedAmount ?? 0) + amount;
  const txns = r.state.txns.map((t) => t.id === r.txn.id ? { ...t, refundOf: txnId } : t.id === txnId ? { ...t, refundedAmount: refunded, status: refunded >= orig.amount ? 'refunded' as const : 'partially_refunded' as const } : t);
  let st: AppState = { ...r.state, txns };
  const earned = s.points.filter((p) => p.txnId === txnId && p.delta > 0).reduce((a, p) => a + p.delta, 0);
  const reverse = Math.min(Math.floor((earned * amount) / orig.amount), pointsBalance(st));
  if (reverse > 0) st = { ...st, points: [...st.points, { id: rid('p_'), ts: Date.now(), delta: -reverse, reason: `Reversed: ${orig.title}`, txnId }] };
  st = notify(st, { kind: 'payment', title: 'Refund credited', body: `${formatINR(amount)} refunded to your wallet for ${orig.title}.` });
  return { state: st, txn: { ...r.txn, refundOf: txnId } };
}

export const POINT_VALUE_PAISE = 10; // 1 point = ₹0.10, so 100 points = ₹10

export function redeemPoints(s: AppState, points: number, key: string) {
  if (s.processedKeys.includes(key)) throw new DomainError('duplicate', 'This redemption was already processed.');
  if (!Number.isInteger(points) || points < 100 || points % 100 !== 0) throw new DomainError('invalid_points', 'Redeem in blocks of 100 points.');
  if (points > pointsBalance(s)) throw new DomainError('not_enough_points', `You have ${pointsBalance(s)} points.`);
  const r = post(s, { key, type: 'reward_credit', category: 'rewards', from: SYS_REWARDS, to: s.me, amount: points * POINT_VALUE_PAISE, title: `Redeemed ${points} reward points` });
  const st = { ...r.state, points: [...r.state.points, { id: rid('p_'), ts: r.txn.ts, delta: -points, reason: `Redeemed for ${formatINR(points * POINT_VALUE_PAISE)} wallet credit`, txnId: r.txn.id }] };
  return { state: notify(st, { kind: 'offer', title: 'Points redeemed', body: `${points} points → ${formatINR(points * POINT_VALUE_PAISE)} added to your wallet (demo credit).` }), txn: r.txn };
}

export function createRequest(s: AppState, amount: Paise | null, note?: string) {
  if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) throw new DomainError('invalid_amount', 'Enter an amount greater than zero, or leave it empty.');
  if (amount !== null && amount > PER_TXN_LIMIT) throw new DomainError('over_limit', `Requests can be up to ${formatINR(PER_TXN_LIMIT)}.`);
  const req = { id: rid('r_'), ref: 'RQ' + txnRef().slice(2, 12), amount, note, ts: Date.now(), status: 'open' as const };
  return { state: { ...s, requests: [req, ...s.requests] }, request: req };
}

/** Simulates another demo user paying one of my requests. */
export function payRequest(s: AppState, requestId: string, payer: AccountId, amountIfOpen: Paise | null, key: string) {
  const req = s.requests.find((r) => r.id === requestId);
  if (!req) throw new DomainError('not_found', 'Request not found.');
  if (req.status !== 'open') throw new DomainError('closed', 'This request was already paid or cancelled.');
  const amount = req.amount ?? amountIfOpen;
  if (amount === null) throw new DomainError('invalid_amount', 'Enter how much they pay.');
  const r = post(s, { key, type: 'request_paid', category: 'transfer', from: payer, to: s.me, amount, title: `Received from ${accountName(s, payer)}`, note: req.note, meta: { requestRef: req.ref } });
  if (r.txn.status !== 'success') return { ...r, request: req };
  const requests = r.state.requests.map((x) => x.id === requestId ? { ...x, status: 'paid' as const, paidBy: payer, txnId: r.txn.id } : x);
  const st = notify({ ...r.state, requests }, { kind: 'payment', title: 'Money received', body: `${formatINR(amount)} received from ${accountName(s, payer)}. Ref ${r.txn.ref}.` });
  return { state: st, txn: r.txn, request: { ...req, status: 'paid' as const } };
}

/** Spending by category for insights (successful debits minus refunds). */
export function spendByCategory(s: AppState, since = 0) {
  const map = new Map<string, number>();
  for (const t of s.txns) {
    if (t.ts < since || t.direction !== 'debit' || t.status === 'failed') continue;
    const net = t.amount - (t.refundedAmount ?? 0);
    if (net > 0) map.set(t.category, (map.get(t.category) ?? 0) + net);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

/** Sanity check used by tests and the demo panel: every txn's entries sum to zero; total money is conserved. */
export function ledgerIsConsistent(s: AppState): boolean {
  const byTxn = new Map<string, number>();
  for (const e of s.entries) byTxn.set(e.txnId, (byTxn.get(e.txnId) ?? 0) + e.delta);
  for (const v of byTxn.values()) if (v !== 0) return false;
  for (const t of s.txns) if (t.status === 'failed' && byTxn.has(t.id)) return false;
  return true;
}
