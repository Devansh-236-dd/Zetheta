import { useRef, useState } from 'react';
import { Award, Gift, Tag } from 'lucide-react';
import { store, useStore } from '../store';
import { COUPONS, validateCoupon } from '../lib/coupons';
import { DomainError, POINT_VALUE_PAISE, lifetimePoints, pointsBalance, redeemPoints } from '../lib/ledger';
import type { Category } from '../lib/types';
import { formatINR, parseAmount } from '../lib/money';
import { rid } from '../lib/ids';
import { Alert, Btn, DemoNote, Field, PageHeader, Seg, announce, toast } from '../components/ui';
import { fmtDate } from './common';

const TIERS = [{ name: 'Silver', min: 0 }, { name: 'Gold', min: 500 }, { name: 'Platinum', min: 1500 }];

export function Rewards() {
  const st = useStore((s) => s);
  const [tab, setTab] = useState<'offers' | 'rewards'>('offers');
  return (
    <>
      <PageHeader title="Offers & rewards" sub="Demo coupons with clear rules, and points you earn on every purchase." />
      <Seg label="Section" value={tab} onChange={setTab} options={[{ id: 'offers', label: 'Offers & coupons' }, { id: 'rewards', label: `Reward points (${pointsBalance(st)})` }]} />
      {tab === 'offers' ? <Offers /> : <Points />}
    </>
  );
}

function Offers() {
  const uses = useStore((s) => s.couponUses);
  const now = Date.now();
  const [code, setCode] = useState('FOOD50');
  const [cat, setCat] = useState<Category>('food');
  const [amt, setAmt] = useState('250');
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const check = () => {
    const p = parseAmount(amt);
    if (!p) { setRes({ ok: false, text: 'Enter an order amount.' }); return; }
    const r = validateCoupon(code, { category: cat, subtotal: p, now, uses });
    setRes(r.ok ? { ok: true, text: `${r.message} You’d pay ${formatINR(p - r.discount)} before fees.` } : { ok: false, text: r.reason });
  };
  return (
    <>
      <DemoNote>These are example demo promotions, not real offers. No real cashback is paid. Each rule below is enforced at checkout.</DemoNote>
      <div className="grid two">
        {COUPONS.map((c) => {
          const used = c.singleUse && uses.some((u) => u.code === c.code);
          const status = now > c.expiresAt ? ['err', 'Expired'] : now < c.startsAt ? ['warn', 'Starts ' + new Date(c.startsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })] : used ? ['info', 'Used'] : ['ok', 'Available'];
          return (
            <div key={c.code} className="card stack sm">
              <div className="row between nowrap"><span className="row nowrap"><Tag aria-hidden="true" /><b className="h3">{c.title}</b></span><span className={`badge ${status[0]}`}>{status[1]}</span></div>
              <span className="mono" style={{ fontSize: '1.1rem', border: '1.5px dashed var(--line2)', padding: '4px 10px', borderRadius: 8, width: 'max-content' }}>{c.code}</span>
              <span className="small muted">{c.description}</span>
              <span className="xs dim">Valid {new Date(c.startsAt).toLocaleDateString('en-IN')} – {new Date(c.expiresAt).toLocaleDateString('en-IN')} · {c.singleUse ? 'single use' : 'reusable'}</span>
            </div>
          );
        })}
      </div>
      <section className="card stack" aria-labelledby="cc-h" style={{ maxWidth: 680 }}>
        <h2 id="cc-h" className="h2">Check a coupon</h2>
        <p className="muted" style={{ margin: 0 }}>See exactly why a code would be accepted or rejected.</p>
        <div className="formgrid">
          <Field label="Code">{(id) => <input id={id} className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />}</Field>
          <Field label="Category">{(id) => <select id={id} className="select" value={cat} onChange={(e) => setCat(e.target.value as Category)}>{['food', 'travel', 'entertainment', 'shopping', 'bills', 'transport'].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select>}</Field>
          <Field label="Order amount (₹)">{(id) => <input id={id} className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} />}</Field>
        </div>
        <Btn variant="ghost" onClick={check}>Check</Btn>
        {res && <Alert kind={res.ok ? 'ok' : 'err'} title={res.ok ? 'Coupon accepted' : 'Coupon rejected'}>{res.text}</Alert>}
      </section>
    </>
  );
}

function Points() {
  const st = useStore((s) => s);
  const bal = pointsBalance(st), life = lifetimePoints(st);
  const tier = [...TIERS].reverse().find((t) => life >= t.min)!;
  const next = TIERS.find((t) => t.min > life);
  const [pts, setPts] = useState(100);
  const keyRef = useRef(rid('redeem_'));
  const redeem = () => {
    try {
      const r = redeemPoints(store.get(), pts, keyRef.current);
      store.set(r.state); keyRef.current = rid('redeem_');
      toast(`${pts} points redeemed for ${formatINR(pts * POINT_VALUE_PAISE)}`); announce('Points redeemed.');
    } catch (e) { toast(e instanceof DomainError ? e.message : 'Couldn’t redeem', 'err'); }
  };
  return (
    <>
      <div className="grid two">
        <div className="card stack">
          <div className="row nowrap"><Award aria-hidden="true" color="#FFC861" /><b className="h3">{tier.name} member</b></div>
          <div className="h1 num">{bal} <span className="h3 muted">points</span></div>
          <span className="small muted">Worth {formatINR(bal * POINT_VALUE_PAISE)} · {life} earned in total</span>
          <div className="tier" role="progressbar" aria-label="Progress to next tier" aria-valuemin={0} aria-valuemax={next?.min ?? life} aria-valuenow={life}><i style={{ width: `${next ? Math.min(100, (life / next.min) * 100) : 100}%` }} /></div>
          <span className="xs muted">{next ? `${next.min - life} more points to ${next.name}` : 'Top tier reached'}</span>
        </div>
        <div className="card stack">
          <b className="h3">Redeem for wallet credit</b>
          <span className="small muted">100 points = ₹10 of demo wallet credit. Redeem in blocks of 100.</span>
          <div className="chips" role="group" aria-label="Points to redeem">{[100, 200, 500].map((p) => <button key={p} type="button" className="chip" aria-pressed={pts === p} disabled={p > bal} onClick={() => setPts(p)}>{p} pts → {formatINR(p * POINT_VALUE_PAISE)}</button>)}</div>
          <Btn icon={<Gift />} disabled={bal < 100 || pts > bal} onClick={redeem}>Redeem {pts} points</Btn>
          {bal < 100 && <span className="small muted">Earn 1 point for every ₹100 you spend on bookings, food, shopping and bills.</span>}
        </div>
      </div>
      <section className="card" aria-labelledby="ph-h">
        <h2 id="ph-h" className="h3" style={{ marginBottom: 6 }}>Points history</h2>
        <div className="list">{[...st.points].reverse().map((p) => <div key={p.id} className="li"><span className="t"><b>{p.reason}</b><small>{fmtDate(p.ts)}</small></span><b className="num" style={{ color: p.delta > 0 ? 'var(--ok)' : 'var(--ink)' }}>{p.delta > 0 ? '+' : ''}{p.delta}</b></div>)}</div>
      </section>
    </>
  );
}
