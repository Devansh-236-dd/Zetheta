import { ArrowDownLeft, ArrowUpRight, Bus, Clapperboard, Gift, Landmark, Receipt, RotateCcw, ShoppingBag, Store, UtensilsCrossed, Plane, Wallet, XCircle } from 'lucide-react';
import type { Txn } from '../lib/types';
import { formatINR } from '../lib/money';
import { navigate, usePath } from '../router';
import { StatusBadge } from '../components/ui';

export function useQuery(): URLSearchParams {
  const p = usePath();
  return new URLSearchParams(p.includes('?') ? p.split('?')[1] : '');
}
export const fmtDate = (ts: number) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtDay = (ts: number) => new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const isoDay = (offsetDays = 0) => { const d = new Date(Date.now() + offsetDays * 86400000); return d.toISOString().slice(0, 10); };
export const CAT_LABEL: Record<string, string> = { transfer: 'Transfers', topup: 'Money added', merchant: 'Shops & QR', food: 'Food', travel: 'Travel', entertainment: 'Entertainment', shopping: 'Shopping', bills: 'Bills', transport: 'Transport', rewards: 'Rewards', refund: 'Refunds' };

export function txnIcon(t: Txn) {
  if (t.status === 'failed') return <XCircle aria-hidden="true" color="#FF8F87" />;
  if (t.type === 'refund') return <RotateCcw aria-hidden="true" color="#5BE49B" />;
  if (t.type === 'topup') return <Landmark aria-hidden="true" />;
  if (t.type === 'reward_credit') return <Gift aria-hidden="true" />;
  if (t.direction === 'credit') return <ArrowDownLeft aria-hidden="true" color="#5BE49B" />;
  switch (t.category) {
    case 'food': return <UtensilsCrossed aria-hidden="true" />;
    case 'travel': return <Plane aria-hidden="true" />;
    case 'entertainment': return <Clapperboard aria-hidden="true" />;
    case 'shopping': return <ShoppingBag aria-hidden="true" />;
    case 'bills': return <Receipt aria-hidden="true" />;
    case 'transport': return <Bus aria-hidden="true" />;
    case 'merchant': return <Store aria-hidden="true" />;
    case 'transfer': return <ArrowUpRight aria-hidden="true" />;
    default: return <Wallet aria-hidden="true" />;
  }
}

export function TxnRow({ t }: { t: Txn }) {
  const sign = t.status === 'failed' ? '' : t.direction === 'credit' ? '+' : '−';
  const cls = t.status === 'failed' ? 'amt-failed' : t.direction === 'credit' ? 'amt-credit' : 'amt-debit';
  const sr = `${t.title}. ${t.status === 'failed' ? 'Failed' : t.direction === 'credit' ? 'Received' : 'Paid'} ${formatINR(t.amount)}. ${fmtDate(t.ts)}.`;
  return (
    <button type="button" className="li" onClick={() => navigate('/txn/' + t.id)} aria-label={sr}>
      <span className="ticon">{txnIcon(t)}</span>
      <span className="t"><b>{t.title}</b><small>{fmtDate(t.ts)}{t.status !== 'success' ? ' · ' : ''}{t.status !== 'success' && <StatusBadge status={t.status} />}</small></span>
      <span className={`num ${cls}`}>{sign}{formatINR(t.amount)}</span>
    </button>
  );
}
