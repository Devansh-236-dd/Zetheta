import { useMemo, useState } from 'react';
import { BarChart3, Download, FileText, Inbox, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { accountName, spendByCategory } from '../lib/ledger';
import type { Txn } from '../lib/types';
import { formatINR, wordsEn } from '../lib/money';
import { saveFile } from '../lib/download';
import { Alert, AmountWords, Btn, Empty, Money, PageHeader, StatusBadge, toast } from '../components/ui';
import { CAT_LABEL, TxnRow, fmtDate, txnIcon } from './common';

const FILTERS = [
  { id: 'all', label: 'All' }, { id: 'out', label: 'Sent & paid' }, { id: 'in', label: 'Received' },
  { id: 'refund', label: 'Refunds' }, { id: 'failed', label: 'Failed' },
] as const;

const csvEsc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export async function downloadStatement(txns: Txn[]) {
  const rows = [['Date', 'Reference', 'Description', 'Category', 'Direction', 'Amount (INR)', 'Status', 'Counterparty', 'Note']];
  for (const t of [...txns].reverse()) rows.push([new Date(t.ts).toISOString(), t.ref, t.title, CAT_LABEL[t.category] ?? t.category, t.direction, (t.amount / 100).toFixed(2), t.status, t.counterparty, t.note ?? '']);
  const csv = '# Zetheta DEMO statement — simulated transactions, not a real bank statement\n' + rows.map((r) => r.map(csvEsc).join(',')).join('\n');
  const r = await saveFile(`zetheta-demo-statement-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  toast(r === 'saved' ? 'Statement saved' : r === 'declined' ? 'Download cancelled' : 'Couldn’t save the file here', r === 'saved' ? 'ok' : 'info');
}

export function History() {
  const txns = useStore((s) => s.txns);
  const [f, setF] = useState<(typeof FILTERS)[number]['id']>('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => txns.filter((t) => {
    if (f === 'out' && !(t.direction === 'debit' && t.status !== 'failed')) return false;
    if (f === 'in' && !(t.direction === 'credit' && t.type !== 'refund')) return false;
    if (f === 'refund' && t.type !== 'refund') return false;
    if (f === 'failed' && t.status !== 'failed') return false;
    const s = q.trim().toLowerCase();
    return !s || (t.title + t.counterparty + t.ref + (t.note ?? '')).toLowerCase().includes(s);
  }), [txns, f, q]);
  const groups = useMemo(() => {
    const m = new Map<string, Txn[]>();
    list.forEach((t) => { const k = new Date(t.ts).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }); m.set(k, [...(m.get(k) ?? []), t]); });
    return [...m.entries()];
  }, [list]);
  return (
    <>
      <PageHeader title="Transaction history" sub="Every simulated payment, refund and reward, with receipts." backTo="/" actions={<><Btn variant="ghost" size="sm" icon={<BarChart3 />} onClick={() => navigate('/insights')}>Insights</Btn><Btn variant="quiet" size="sm" icon={<Download />} onClick={() => downloadStatement(txns)}>CSV statement</Btn></>} />
      <div className="row">
        <div className="chips" role="group" aria-label="Filter transactions">{FILTERS.map((x) => <button key={x.id} type="button" className="chip" aria-pressed={f === x.id} onClick={() => setF(x.id)}>{x.label}</button>)}</div>
        <div className="field grow" style={{ minWidth: 200 }}><label htmlFor="hq" className="vh">Search transactions</label><input id="hq" className="input" placeholder="Search name, reference or note" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <p className="small muted" aria-live="polite" style={{ margin: 0 }}>{list.length} transaction{list.length === 1 ? '' : 's'}</p>
      {groups.length === 0 ? <Empty icon={<Inbox />} title="No transactions match">Try another filter or search.</Empty> : groups.map(([day, ts]) => (
        <section key={day} className="card" aria-label={day}>
          <h2 className="eyebrow" style={{ marginBottom: 4 }}>{day}</h2>
          <div className="list">{ts.map((t) => <TxnRow key={t.id} t={t} />)}</div>
        </section>
      ))}
    </>
  );
}

function receiptHtml(t: Txn, extra: [string, string][]) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const rows = [['Reference', t.ref], ['Status', t.status], ['Date & time', fmtDate(t.ts)], ['Amount', formatINR(t.amount) + ` (${wordsEn(t.amount)})`], ['Direction', t.direction === 'debit' ? 'Paid' : 'Received'], ['Counterparty', t.counterparty], ...(t.note ? [['Note', t.note]] : []), ...(t.failureReason ? [['Failure reason', t.failureReason]] : []), ...extra];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Zetheta demo receipt ${esc(t.ref)}</title><style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#0A1630}h1{font-size:22px}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px solid #ddd;vertical-align:top}td:last-child{text-align:right;font-weight:700}.demo{border:2px dashed #C98A00;color:#6B3F00;padding:10px;border-radius:8px;margin:16px 0}</style></head><body><h1>Zetheta — ${esc(t.title)}</h1><div class="demo">DEMO RECEIPT. This transaction was simulated in the Zetheta hackathon demo. No real money moved.</div><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('')}</table></body></html>`;
}

export function TxnDetail({ id }: { id: string }) {
  const st = useStore((s) => s);
  const t = st.txns.find((x) => x.id === id);
  if (!t) return <><PageHeader title="Transaction" backTo="/history" /><Empty icon={<Inbox />} title="Transaction not found">It may have been cleared when demo data was reset.</Empty></>;
  const booking = st.bookings.find((b) => b.txnId === t.id);
  const order = st.orders.find((o) => o.txnId === t.id);
  const refunds = st.txns.filter((x) => x.refundOf === t.id);
  const original = t.refundOf ? st.txns.find((x) => x.id === t.refundOf) : undefined;
  const pts = st.points.filter((p) => p.txnId === t.id);
  const extra: [string, string][] = [['From', accountName(st, t.from)], ['To', accountName(st, t.to)], ['Category', CAT_LABEL[t.category] ?? t.category]];
  if (t.meta?.coupon) extra.push(['Coupon', `${t.meta.coupon} (saved ${formatINR(Number(t.meta.discount))})`]);
  if (booking) extra.push(['Booking', `${booking.title} · ${booking.ref}`]);
  if (order) extra.push(['Order', `${order.merchantName} · ${order.ref}`]);
  const dl = async () => { const r = await saveFile(`zetheta-receipt-${t.ref}.html`, receiptHtml(t, extra), 'text/html'); toast(r === 'saved' ? 'Receipt saved' : r === 'declined' ? 'Download cancelled' : 'Couldn’t save the file here', r === 'saved' ? 'ok' : 'info'); };
  return (
    <>
      <PageHeader title="Receipt" eyebrow="Demo transaction" backTo="/history" actions={<Btn variant="quiet" size="sm" icon={<FileText />} onClick={dl}>Download receipt</Btn>} />
      <div className="card stack lg" style={{ maxWidth: 640 }}>
        <div className="row nowrap"><span className="ticon" style={{ width: 52, height: 52 }}>{txnIcon(t)}</span><div className="grow"><b className="h3">{t.title}</b><div className="small muted">{fmtDate(t.ts)}</div></div><StatusBadge status={t.status} /></div>
        <div className="stack sm">
          <div className={`bigamt ${t.status === 'failed' ? 'amt-failed' : ''}`} style={{ color: t.direction === 'credit' && t.status !== 'failed' ? 'var(--ok)' : undefined }}><span className="cur">{t.direction === 'credit' ? '+' : '−'}₹</span>{formatINR(t.amount, { plain: true })}</div>
          <div><AmountWords p={t.amount} /></div>
        </div>
        {t.status === 'failed' && <Alert kind="err" title="This payment failed">{t.failureReason} Your wallet was not charged.</Alert>}
        <dl className="kv">
          <dt>Reference</dt><dd className="mono">{t.ref}</dd>
          <dt>{t.direction === 'debit' ? 'Paid to' : 'Received from'}</dt><dd>{t.counterparty}</dd>
          {extra.map(([k, v]) => <FragmentKV key={k} k={k} v={v} />)}
          {t.note && <><dt>Note</dt><dd>{t.note}</dd></>}
          {t.refundedAmount ? <><dt>Refunded</dt><dd><Money p={t.refundedAmount} /></dd></> : null}
          {pts.map((p) => <FragmentKV key={p.id} k="Reward points" v={(p.delta > 0 ? '+' : '') + p.delta} />)}
        </dl>
        {refunds.length > 0 && <Alert kind="info" title="Refunds on this payment">{refunds.map((r) => <div key={r.id}><button type="button" className="link" onClick={() => navigate('/txn/' + r.id)}>{formatINR(r.amount)} on {fmtDate(r.ts)} · {r.ref}</button></div>)}</Alert>}
        {original && <Btn variant="ghost" icon={<RotateCcw />} onClick={() => navigate('/txn/' + original.id)}>View original payment</Btn>}
        <div className="row">
          {booking && <Btn onClick={() => navigate('/booking/' + booking.id)}>Open booking</Btn>}
          {order && <Btn onClick={() => navigate('/order/' + order.id)}>Open order</Btn>}
        </div>
        <p className="xs dim" style={{ margin: 0 }}>Simulated transaction in the Zetheta demo ledger. No real money moved.</p>
      </div>
    </>
  );
}
const FragmentKV = ({ k, v }: { k: string; v: string }) => <><dt>{k}</dt><dd>{v}</dd></>;

export function Insights() {
  const st = useStore((s) => s);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const thirty = Date.now() - 30 * 86400000;
  const cats = spendByCategory(st, thirty);
  const max = Math.max(1, ...cats.map((c) => c[1]));
  const sumRange = (a: number, b: number, dir: 'debit' | 'credit') => st.txns.filter((t) => t.ts >= a && t.ts < b && t.direction === dir && t.status !== 'failed').reduce((s, t) => s + t.amount - (dir === 'debit' ? t.refundedAmount ?? 0 : 0), 0);
  const thisOut = sumRange(monthStart, Infinity, 'debit'), prevOut = sumRange(prevStart, monthStart, 'debit');
  const thisIn = sumRange(monthStart, Infinity, 'credit');
  const top = useMemo(() => { const m = new Map<string, number>(); st.txns.filter((t) => t.direction === 'debit' && t.status !== 'failed' && t.ts >= thirty).forEach((t) => m.set(t.counterparty, (m.get(t.counterparty) ?? 0) + t.amount - (t.refundedAmount ?? 0))); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); }, [st.txns]);
  return (
    <>
      <PageHeader title="Spending insights" sub="Based on your simulated activity." backTo="/history" actions={<Btn variant="quiet" size="sm" icon={<Download />} onClick={() => downloadStatement(st.txns)}>CSV statement</Btn>} />
      <div className="grid">
        <div className="card"><div className="eyebrow">Spent this month</div><div className="h1 num"><Money p={thisOut} /></div><div className="small muted">{prevOut ? `${thisOut > prevOut ? 'Up' : 'Down'} ${Math.abs(Math.round(((thisOut - prevOut) / prevOut) * 100))}% vs last month (${formatINR(prevOut)})` : 'No spending last month'}</div></div>
        <div className="card"><div className="eyebrow">Received this month</div><div className="h1 num" style={{ color: 'var(--ok)' }}><Money p={thisIn} /></div><div className="small muted">Includes money added and refunds</div></div>
        <div className="card"><div className="eyebrow">Transactions</div><div className="h1 num">{st.txns.filter((t) => t.ts >= monthStart).length}</div><div className="small muted">{st.txns.filter((t) => t.status === 'failed').length} failed in total (no money moved)</div></div>
      </div>
      <section className="card stack" aria-labelledby="cat-h">
        <h2 id="cat-h" className="h2">Spending by category · last 30 days</h2>
        {cats.length === 0 ? <p className="muted">No spending yet.</p> : (
          <div className="bars" role="list">
            {cats.map(([c, v]) => (
              <div key={c} className="bar" role="listitem" aria-label={`${CAT_LABEL[c] ?? c}: ${formatINR(v)}`}>
                <span>{CAT_LABEL[c] ?? c}</span><span className="track" aria-hidden="true"><span className="fill" style={{ width: `${(v / max) * 100}%`, display: 'block' }} /></span><b className="num">{formatINR(v)}</b>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card stack" aria-labelledby="top-h">
        <h2 id="top-h" className="h2">Where your money went</h2>
        <div className="list">{top.map(([n, v]) => <div key={n} className="li"><span className="t"><b>{n}</b></span><b className="num">{formatINR(v)}</b></div>)}</div>
      </section>
    </>
  );
}
