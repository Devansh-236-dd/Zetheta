import type { Paise } from './money';

export type Category =
  | 'transfer' | 'topup' | 'merchant' | 'food' | 'travel' | 'entertainment'
  | 'shopping' | 'bills' | 'transport' | 'rewards' | 'refund';

export type AccountId = string; // "u_*" users, "m_*" merchants, "sys_*" system accounts

export interface User {
  id: AccountId;
  name: string;
  first: string;
  upi: string;            // demo id, e.g. rahul.sharma@zetheta
  phone: string;          // masked alias, e.g. 98xxxxx210
  bankName: string;       // name registered with the (demo) bank
  bank: string;
  color: string;
  isNew?: boolean;        // never paid before — used by look-alike check
  lookalikeOf?: AccountId;
  tagline?: string;
}

export interface Merchant {
  id: AccountId;
  name: string;
  upi: string;
  category: Category;
  city: string;
  color: string;
}

export interface LedgerEntry {
  id: string;
  txnId: string;
  account: AccountId;
  delta: Paise; // + credit, − debit; entries of one txn always sum to 0
}

export type TxnStatus = 'success' | 'failed' | 'refunded' | 'partially_refunded';
export type TxnType = 'transfer_out' | 'transfer_in' | 'topup' | 'purchase' | 'refund' | 'reward_credit' | 'request_paid';

export interface Txn {
  id: string;
  ref: string;
  ts: number;
  type: TxnType;
  category: Category;
  amount: Paise;           // always positive
  direction: 'debit' | 'credit';
  from: AccountId;
  to: AccountId;
  counterparty: string;    // display name from the viewer's side
  title: string;
  status: TxnStatus;
  failureReason?: string;
  note?: string;
  refundedAmount?: Paise;
  refundOf?: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface PayRequest {
  id: string;
  ref: string;
  amount: Paise | null;
  note?: string;
  ts: number;
  status: 'open' | 'paid' | 'cancelled';
  paidBy?: AccountId;
  txnId?: string;
}

export type BookingKind = 'train' | 'flight' | 'bus' | 'hotel' | 'movie' | 'event' | 'metro' | 'buspass' | 'parking' | 'taxi';

export interface Booking {
  id: string;
  kind: BookingKind;
  ref: string;              // PNR / booking id
  title: string;
  subtitle: string;
  when: string;             // human date/time
  ts: number;
  amount: Paise;
  txnId: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  details: Record<string, string>;
  passengers?: { name: string; age: number; seat?: string }[];
  ticketCode?: string;      // for QR tickets
  redeemedAt?: number;
  refundAmount?: Paise;
}

export interface OrderLine { itemId: string; name: string; unit: Paise; qty: number; options: string[] }

export interface Order {
  id: string;
  kind: 'food' | 'shopping' | 'bill';
  ref: string;
  merchantId: AccountId;
  merchantName: string;
  lines: OrderLine[];
  totals: { label: string; amount: Paise }[];
  total: Paise;
  ts: number;
  txnId: string;
  status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'paid';
  address?: string;
  couponCode?: string;
  refundAmount?: Paise;
}

export interface CouponUse { code: string; txnId: string; ts: number }
export interface PointEntry { id: string; ts: number; delta: number; reason: string; txnId?: string }

export interface Notif { id: string; ts: number; title: string; body: string; read: boolean; kind: 'payment' | 'booking' | 'order' | 'offer' | 'security' }

export interface A11ySettings {
  textScale: 100 | 125 | 150 | 200;
  reduceMotion: 'system' | 'on' | 'off';
  highContrast: boolean;
  srMode: boolean;
  simpleNav: boolean;
  hindiAmounts: boolean;
  idleMinutes: 0 | 2 | 5 | 10;
}

export interface Settings {
  a11y: A11ySettings;
  hideBalance: boolean;
  notifyPayments: boolean;
  notifyOffers: boolean;
  confirmLargeAbove: Paise;   // extra confirmation above this amount
  simulateFailureNext: boolean;
}

export interface AppState {
  version: number;
  me: AccountId;
  users: User[];
  merchants: Merchant[];
  entries: LedgerEntry[];
  txns: Txn[];
  requests: PayRequest[];
  bookings: Booking[];
  orders: Order[];
  couponUses: CouponUse[];
  points: PointEntry[];
  notifications: Notif[];
  processedKeys: string[];
  favourites: AccountId[];
  addresses: { id: string; label: string; line: string }[];
  settings: Settings;
}
