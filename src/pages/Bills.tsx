import { useState } from 'react';
import { FileSearch, Receipt } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { checkout } from '../lib/ledger';
import type { Order } from '../lib/types';
import { formatINR, type Paise } from '../lib/money';
import { simpleTotals } from '../lib/pricing';
import { bookingRef, rid } from '../lib/ids';
import { BILLERS, MOBILE_PLANS, fetchBill } from '../data/catalog';
import { usePay } from '../components/PaySheet';
import { Alert, Btn, DemoNote, Field, PageHeader } from '../components/ui';
import { fmtDate, useQuery } from './common';

export function Bills() {
  const q = useQuery();
  const initial = BILLERS.find((b) => b.id === q.get('t'))?.id ?? 'mob';
  const [type, setType] = useState<string>(initial);
  const biller = BILLERS.find((b) => b.id === type)!;
  const [op, setOp] = useState<string>(biller.operators[0]);
  const [acct, setAcct] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [bill, setBill] = useState<null | { amount: Paise; name: string; due: string; billNo: string }>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const { openPay } = usePay();
  const orders = useStore((s) => s.orders.filter((o) => o.kind === 'bill'));
  const choose = (id: string) => { const b = BILLERS.find((x) => x.id === id)!; setType(id); setOp(b.operators[0]); setAcct(''); setBill(null); setPlan(null); setErr(null); };
  const valid = () => { if (!new RegExp(biller.idPattern).test(acct)) { setErr(`Enter a valid ${biller.idLabel.toLowerCase()} (${biller.idHint}).`); return false; } setErr(null); return true; };
  const fetch = () => { if (!valid()) return; setBill(fetchBill(type, op, acct)); };
  const pay = (amount: Paise, label: string, detail: string) => {
    if (!valid()) return;
    openPay({
      title: `${biller.label} · ${op} · ${acct}${detail ? ' · ' + detail : ''}`,
      payee: { name: op, color: '#4D7C0F', sub: 'via Zetheta Bill Desk (demo)' }, category: 'bills', couponable: true,
      totals: (d) => simpleTotals(label, amount, d),
      commit: (s, x) => checkout(s, { key: x.key, category: 'bills', merchantId: 'm_bills', title: `${biller.label} — ${op}`, total: x.total, coupon: x.coupon, meta: { account: acct },
        attach: (txn) => ({ orders: [{ id: rid('o_'), kind: 'bill', ref: bookingRef('bill'), merchantId: 'm_bills', merchantName: `${op} (${biller.label})`, lines: [{ itemId: type, name: `${label} · ${acct}`, unit: amount, qty: 1, options: detail ? [detail] : [] }], totals: simpleTotals(label, amount, x.coupon?.discount ?? 0).lines.map((l) => ({ label: l.label, amount: l.amount })), total: x.total, ts: txn.ts, txnId: txn.id, status: 'paid', couponCode: x.coupon?.code } as Order] }) }),
      onSuccess: () => { setBill(null); setPlan(null); },
    });
  };
  return (
    <>
      <PageHeader title="Bills & recharge" sub="Recharge and pay utility bills from your wallet." backTo="/" />
      <DemoNote>Billers are invented and bills are generated from the number you enter. No real operator is contacted. Try <b className="mono">BILL25</b> on ₹300+.</DemoNote>
      <div className="chips" role="group" aria-label="Bill type">{BILLERS.map((b) => <button key={b.id} type="button" className="chip" aria-pressed={type === b.id} onClick={() => choose(b.id)}>{b.label}</button>)}</div>
      <section className="card stack" aria-labelledby="bill-h" style={{ maxWidth: 720 }}>
        <h2 id="bill-h" className="h2">{biller.label}</h2>
        <div className="formgrid">
          <Field label="Operator / biller">{(id) => <select id={id} className="select" value={op} onChange={(e) => { setOp(e.target.value); setBill(null); }}>{biller.operators.map((o) => <option key={o}>{o}</option>)}</select>}</Field>
          <Field label={biller.idLabel} hint={biller.idHint} error={err}>{(id, d) => <input id={id} aria-describedby={d} className="input mono" inputMode={type === 'mob' || type === 'elec' || type === 'water' || type === 'dth' ? 'numeric' : 'text'} value={acct} onChange={(e) => { setAcct(e.target.value.trim()); setBill(null); setErr(null); }} placeholder={type === 'mob' ? '98765 43210' : ''} />}</Field>
        </div>
        {biller.kind === 'recharge' && type === 'mob' ? (
          <div className="stack sm" role="radiogroup" aria-label="Recharge plans">
            {MOBILE_PLANS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} className="card click row between" style={plan === p.id ? { borderColor: 'var(--accent)' } : undefined} onClick={() => setPlan(p.id)}>
                <span><b className="h3 num">{formatINR(p.price)}</b><span className="small muted" style={{ display: 'block' }}>{p.data} · {p.validity} · {p.extra}</span></span>
              </button>
            ))}
            <Btn size="lg" disabled={!plan} onClick={() => { const p = MOBILE_PLANS.find((x) => x.id === plan)!; pay(p.price, 'Recharge', `${p.data}, ${p.validity}`); }}>Recharge {plan ? formatINR(MOBILE_PLANS.find((x) => x.id === plan)!.price) : ''}</Btn>
          </div>
        ) : biller.kind === 'recharge' ? (
          <div className="stack sm">
            <div className="chips" role="group" aria-label="Recharge amount">{[199, 299, 499].map((a) => <button key={a} type="button" className="chip" aria-pressed={plan === String(a)} onClick={() => setPlan(String(a))}>₹{a}</button>)}</div>
            <Btn size="lg" disabled={!plan} onClick={() => pay(+plan! * 100, 'Recharge', '')}>Recharge</Btn>
          </div>
        ) : !bill ? (
          <Btn icon={<FileSearch />} onClick={fetch}>Fetch bill</Btn>
        ) : (
          <div className="stack">
            <Alert kind="info" title={`Bill found for ${bill.name}`}>Bill no. <span className="mono">{bill.billNo}</span> · due {bill.due}</Alert>
            <div className="row between"><span className="muted">Amount due</span><b className="h1 num">{formatINR(bill.amount)}</b></div>
            <Btn size="lg" onClick={() => pay(bill.amount, 'Bill amount', `Bill ${bill.billNo}`)}>Pay {formatINR(bill.amount)}</Btn>
          </div>
        )}
      </section>
      <section className="card" aria-labelledby="bh-h">
        <h2 id="bh-h" className="h3" style={{ marginBottom: 6 }}>Recent bill payments</h2>
        {orders.length === 0 ? <p className="muted">No bills paid in this session yet. The seeded electricity bill is in History.</p> : (
          <div className="list">{orders.map((o) => <button key={o.id} type="button" className="li" onClick={() => navigate('/txn/' + o.txnId)}><span className="ticon"><Receipt aria-hidden="true" /></span><span className="t"><b>{o.merchantName}</b><small>{o.lines[0].name} · {fmtDate(o.ts)}</small></span><b className="num">{formatINR(o.total)}</b></button>)}</div>
        )}
      </section>
    </>
  );
}
