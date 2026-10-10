import type { AppState, Merchant, User } from '../lib/types';
import { rs } from '../lib/money';
import { checkout, post, refund, topUp, transfer, SYS_BANK } from '../lib/ledger';

export const STATE_VERSION = 3;
export const DEMO_PIN = '1234'; // NON-PRODUCTION demo PIN, documented in README

export const USERS: User[] = [
  { id: 'u_ramesh', name: 'Ramesh Kumar', first: 'Ramesh', upi: 'ramesh.k@zetheta', phone: '98xxxxx821', bankName: 'RAMESH KUMAR', bank: 'Demo Bank of India', color: '#3A4BD6' },
  { id: 'u_rahul', name: 'Rahul Sharma', first: 'Rahul', upi: 'rahul.sharma@zetheta', phone: '98xxxxx104', bankName: 'RAHUL SHARMA', bank: 'Axis Demo Bank', color: '#1F4E99' },
  { id: 'u_lakshmi', name: 'Lakshmi Iyer', first: 'Lakshmi', tagline: 'Amma', upi: 'lakshmi.iyer@zetheta', phone: '94xxxxx552', bankName: 'LAKSHMI R IYER', bank: 'State Demo Bank', color: '#6B2FA0' },
  { id: 'u_meera', name: 'Meera Nair', first: 'Meera', upi: 'meera.nair@zetheta', phone: '99xxxxx318', bankName: 'MEERA NAIR', bank: 'HDFC Demo Bank', color: '#9A3F14' },
  { id: 'u_arjun', name: 'Arjun Mehta', first: 'Arjun', upi: 'arjun.m@zetheta', phone: '90xxxxx777', bankName: 'ARJUN V MEHTA', bank: 'Kotak Demo Bank', color: '#0F6B5F' },
  { id: 'u_priya', name: 'Priya Das', first: 'Priya', upi: 'priya.das@zetheta', phone: '87xxxxx240', bankName: 'PRIYA DAS', bank: 'ICICI Demo Bank', color: '#9C2A5A' },
  { id: 'u_rahul2', name: 'Rahul Sharmaa', first: 'Rahul', upi: 'rahulsharmaa9@zetheta', phone: '70xxxxx013', bankName: 'RAHUL K SHARMAA', bank: 'Unknown Demo Bank', color: '#4A5272', isNew: true, lookalikeOf: 'u_rahul' },
];

export const MERCHANTS: Merchant[] = [
  { id: 'm_gupta', name: 'Gupta Kirana Store', upi: 'gupta.kirana@zetheta', category: 'merchant', city: 'Mumbai', color: '#0F6B5F' },
  { id: 'm_monsoon', name: 'Café Monsoon', upi: 'cafe.monsoon@zetheta', category: 'merchant', city: 'Mumbai', color: '#8A4B12' },
  { id: 'm_fuel', name: 'Western Express Fuels', upi: 'wex.fuels@zetheta', category: 'merchant', city: 'Mumbai', color: '#5A3A9A' },
  { id: 'm_rail', name: 'Zetheta Rail (demo)', upi: 'rail@zetheta', category: 'travel', city: 'India', color: '#1F4E99' },
  { id: 'm_air', name: 'Zetheta Flights (demo)', upi: 'flights@zetheta', category: 'travel', city: 'India', color: '#2B5BFF' },
  { id: 'm_bus', name: 'Zetheta Bus (demo)', upi: 'bus@zetheta', category: 'travel', city: 'India', color: '#9C2A5A' },
  { id: 'm_stay', name: 'Zetheta Stays (demo)', upi: 'stays@zetheta', category: 'travel', city: 'India', color: '#6B2FA0' },
  { id: 'm_shows', name: 'Zetheta Shows (demo)', upi: 'shows@zetheta', category: 'entertainment', city: 'India', color: '#B8327A' },
  { id: 'm_food', name: 'Zetheta Food (demo)', upi: 'food@zetheta', category: 'food', city: 'India', color: '#C2410C' },
  { id: 'm_shop', name: 'Zetheta Store (demo)', upi: 'store@zetheta', category: 'shopping', city: 'India', color: '#0E7490' },
  { id: 'm_bills', name: 'Zetheta Bill Desk (demo)', upi: 'bills@zetheta', category: 'bills', city: 'India', color: '#4D7C0F' },
  { id: 'm_move', name: 'Zetheta Move (demo)', upi: 'move@zetheta', category: 'transport', city: 'India', color: '#0369A1' },
];

const DAY = 86400000;

export function seedState(now = Date.now()): AppState {
  let s: AppState = {
    version: STATE_VERSION, me: 'u_ramesh', users: USERS, merchants: MERCHANTS, entries: [], txns: [], requests: [], bookings: [], orders: [],
    couponUses: [], points: [], notifications: [], processedKeys: [], favourites: ['u_lakshmi', 'u_rahul', 'm_gupta'],
    addresses: [
      { id: 'a1', label: 'Home', line: 'Flat 402, Sea Breeze CHS, Bandra West, Mumbai 400050 (demo)' },
      { id: 'a2', label: 'Office', line: '7th floor, Lotus Tech Park, Andheri East, Mumbai 400069 (demo)' },
    ],
    settings: {
      a11y: { textScale: 100, reduceMotion: 'system', highContrast: false, srMode: false, simpleNav: false, hindiAmounts: false, idleMinutes: 5 },
      hideBalance: true, notifyPayments: true, notifyOffers: true, confirmLargeAbove: rs(2000), simulateFailureNext: false,
    },
  };
  const t = (days: number, h = 12) => now - days * DAY + (h - 12) * 3600000;
  // Other demo users get opening balances from the demo bank.
  const opening: [string, number][] = [['u_rahul', 8000], ['u_lakshmi', 40000], ['u_meera', 12000], ['u_arjun', 6500], ['u_priya', 9000], ['u_rahul2', 3000]];
  for (const [id, r] of opening) s = post(s, { key: 'seed-open-' + id, type: 'topup', category: 'topup', from: SYS_BANK, to: id, amount: rs(r), title: 'Opening demo balance', ts: t(40) }).state;

  s = topUp(s, rs(25000), 'seed-topup-1', t(30, 10)).state;
  s = transfer(s, 'u_rahul', rs(500), 'seed-tx-1', 'Movie tickets', t(28, 20)).state;
  s = transfer(s, 'u_lakshmi', rs(2000), 'seed-tx-2', 'For groceries', t(21, 9)).state;
  s = checkout(s, { key: 'seed-shop-1', category: 'merchant', merchantId: 'm_gupta', title: 'Groceries at Gupta Kirana Store', total: rs(340), ts: t(9, 18) }, t(9)).state;
  s = transfer(s, 'u_rahul', rs(500), 'seed-tx-3', 'Dinner split', t(8, 21)).state;
  s = checkout(s, { key: 'seed-cafe-1', category: 'merchant', merchantId: 'm_monsoon', title: 'Café Monsoon', total: rs(260), ts: t(6, 16) }, t(6)).state;
  s = post(s, { key: 'seed-in-1', type: 'request_paid', category: 'transfer', from: 'u_meera', to: 'u_ramesh', amount: rs(1200), title: 'Received from Meera Nair', note: 'Cab share', ts: t(5, 22) }).state;
  const bill = checkout(s, { key: 'seed-bill-1', category: 'bills', merchantId: 'm_bills', title: 'Electricity — City Power Board', total: rs(1430), ts: t(4, 11) }, t(4));
  s = bill.state;
  const cafe2 = checkout(s, { key: 'seed-cafe-2', category: 'merchant', merchantId: 'm_monsoon', title: 'Café Monsoon (double charge)', total: rs(180), ts: t(3, 15) }, t(3));
  s = cafe2.state;
  s = refund(s, cafe2.txn.id, rs(180), 'Duplicate charge reversed by merchant').state;
  s = transfer(s, 'u_lakshmi', rs(2000), 'seed-tx-4', 'Monthly', t(1, 9)).state;
  s = { ...s, points: [{ id: 'p_welcome', ts: t(30, 10), delta: 150, reason: 'Welcome bonus (demo)' }, ...s.points] };
  s = { ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) };
  s = { ...s, notifications: [{ id: 'n_welcome', ts: now, read: false, kind: 'offer', title: 'Welcome to the Zetheta demo', body: 'Everything here is simulated. Try FOOD50, TRAVEL100 or MOVIE75 at checkout. In-app demo notification — no SMS or email is sent.' }, ...s.notifications] };
  return s;
}
