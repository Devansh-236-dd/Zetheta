import { useMemo, useState } from 'react';
import { Minus, Package, Plus, ShoppingBag, ShoppingCart, Star, Trash2 } from 'lucide-react';
import { navigate } from '../router';
import { useStore } from '../store';
import { checkout } from '../lib/ledger';
import type { Order } from '../lib/types';
import { formatINR, rs, type Paise } from '../lib/money';
import { simpleTotals, type Totals } from '../lib/pricing';
import { bookingRef, rid } from '../lib/ids';
import { PRODUCTS, type Product } from '../data/catalog';
import { useCarts } from '../cart';
import { usePay } from '../components/PaySheet';
import { Alert, Btn, DemoNote, Empty, Money, PageHeader, Stepper, toast, announce } from '../components/ui';

const art = (p: Product) => `hsl(${p.hue} 40% 20%)`;
const DELIVERY_FREE_ABOVE = rs(499);
export function shopTotals(lines: { unit: Paise; qty: number }[], discount = 0): Totals {
  const sub = lines.reduce((a, l) => a + l.unit * l.qty, 0);
  return simpleTotals('Items', sub, discount, sub >= DELIVERY_FREE_ABOVE || sub === 0 ? 0 : rs(40), 'Delivery (free above ₹499)');
}

export function Shop() {
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const { carts } = useCarts();
  const cats = ['All', ...new Set(PRODUCTS.map((p) => p.category))];
  const list = useMemo(() => PRODUCTS.filter((p) => (cat === 'All' || p.category === cat) && (p.name + p.brand).toLowerCase().includes(q.toLowerCase())), [cat, q]);
  const count = carts.shop.reduce((a, l) => a + l.qty, 0);
  return (
    <>
      <PageHeader title="Shopping" sub="Everyday essentials from demo brands." backTo="/" actions={count ? <Btn size="sm" icon={<ShoppingCart />} onClick={() => navigate('/shop/cart')}>Cart ({count})</Btn> : undefined} />
      <DemoNote>Products and brands are invented. Use <b className="mono">SHOP10</b> for 10% off orders of ₹500+ (up to ₹200).</DemoNote>
      <div className="row"><div className="field grow"><label htmlFor="sq" className="vh">Search products</label><input id="sq" className="input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <div className="chips" role="group" aria-label="Category">{cats.map((c) => <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
      {list.length === 0 ? <Empty icon={<ShoppingBag />} title="No products found" /> : (
        <div className="grid sm">{list.map((p) => (
          <button key={p.id} type="button" className="card click stack sm" style={{ padding: 0, overflow: 'hidden' }} onClick={() => navigate('/shop/' + p.id)}>
            <div style={{ aspectRatio: '4/3', background: art(p), display: 'grid', placeItems: 'center' }} aria-hidden="true"><Package size={44} color="#E6E9FF" /></div>
            <div className="stack sm" style={{ padding: '4px 14px 14px' }}>
              <b>{p.name}</b><span className="xs muted">{p.brand}</span>
              <span className="row nowrap"><b className="num">{formatINR(p.price)}</b><s className="xs dim">{formatINR(p.mrp)}</s><span className="xs" style={{ color: 'var(--ok)' }}>{Math.round(((p.mrp - p.price) / p.mrp) * 100)}% off</span></span>
            </div>
          </button>
        ))}</div>
      )}
    </>
  );
}

export function ProductPage({ id }: { id: string }) {
  const p = PRODUCTS.find((x) => x.id === id);
  const [qty, setQty] = useState(1);
  const { setCarts } = useCarts();
  if (!p) return <><PageHeader title="Product" backTo="/shop" /><Empty icon={<ShoppingBag />} title="Product not found" /></>;
  const add = (go?: boolean) => {
    setCarts((c) => { const ex = c.shop.find((l) => l.key === p.id); return { ...c, shop: ex ? c.shop.map((l) => l.key === p.id ? { ...l, qty: Math.min(10, l.qty + qty) } : l) : [...c.shop, { key: p.id, itemId: p.id, name: p.name, unit: p.price, qty, options: [] }] }; });
    toast(`${p.name} added to cart`); announce('Added to cart.');
    if (go) navigate('/shop/cart');
  };
  return (
    <>
      <PageHeader title={p.name} eyebrow={`${p.brand} · demo product`} backTo="/shop" />
      <div className="grid two">
        <div style={{ aspectRatio: '4/3', background: art(p), borderRadius: 22, display: 'grid', placeItems: 'center' }} aria-hidden="true"><Package size={80} color="#E6E9FF" /></div>
        <div className="stack">
          <span className="badge ok" style={{ width: 'max-content' }}><Star aria-hidden="true" />{p.rating} (demo rating)</span>
          <p style={{ margin: 0 }}>{p.desc}</p>
          <div className="row"><b className="h1 num">{formatINR(p.price)}</b><s className="dim">{formatINR(p.mrp)}</s></div>
          <div className="row"><span className="lbl">Quantity</span><Stepper label="Quantity" value={qty} min={1} max={10} onChange={setQty} /></div>
          <div className="row"><Btn icon={<ShoppingCart />} onClick={() => add()}>Add to cart</Btn><Btn variant="ghost" onClick={() => add(true)}>Buy now</Btn></div>
          <p className="small muted" style={{ margin: 0 }}>Free delivery above ₹499. Delivered in 3 days (demo). 7-day returns (demo policy).</p>
        </div>
      </div>
    </>
  );
}

export function ShopCart() {
  const { carts, setCarts } = useCarts();
  const addresses = useStore((s) => s.addresses);
  const { openPay } = usePay();
  const lines = carts.shop;
  if (!lines.length) return <><PageHeader title="Shopping cart" backTo="/shop" /><Empty icon={<ShoppingCart />} title="Your cart is empty" action={<Btn onClick={() => navigate('/shop')}>Browse products</Btn>} /></>;
  const setQty = (key: string, q: number) => setCarts((c) => ({ ...c, shop: q <= 0 ? c.shop.filter((l) => l.key !== key) : c.shop.map((l) => l.key === key ? { ...l, qty: Math.min(10, q) } : l) }));
  const t = shopTotals(lines);
  const checkoutNow = () => {
    const snap = lines.map((l) => ({ ...l }));
    openPay({
      title: `${snap.reduce((a, l) => a + l.qty, 0)} items · deliver to ${addresses[0].label}`,
      payee: { name: 'Zetheta Store (demo)', color: '#0E7490' }, category: 'shopping', couponable: true,
      totals: (d) => shopTotals(snap, d),
      commit: (s, x) => { const tt = shopTotals(snap, x.coupon?.discount ?? 0); return checkout(s, { key: x.key, category: 'shopping', merchantId: 'm_shop', title: 'Shopping order', total: x.total, coupon: x.coupon,
        attach: (txn) => ({ orders: [{ id: rid('o_'), kind: 'shopping', ref: bookingRef('shop'), merchantId: 'm_shop', merchantName: 'Zetheta Store (demo)', lines: snap.map((l) => ({ itemId: l.itemId, name: l.name, unit: l.unit, qty: l.qty, options: [] })), totals: tt.lines.filter((l) => l.amount !== 0).map((l) => ({ label: l.label, amount: l.amount })), total: tt.total, ts: txn.ts, txnId: txn.id, status: 'paid', address: addresses[0].line, couponCode: x.coupon?.code } as Order] }) }); },
      onSuccess: () => setCarts((c) => ({ ...c, shop: [] })),
      success: { label: 'View order', to: () => '/orders' },
    });
  };
  return (
    <>
      <PageHeader title="Shopping cart" backTo="/shop" />
      <div className="grid two" style={{ alignItems: 'start' }}>
        <section className="card"><div className="list">{lines.map((l) => (
          <div key={l.key} className="li"><span className="t"><b>{l.name}</b><small>{formatINR(l.unit)} each</small></span>
            <div className="stepper" role="group" aria-label={`Quantity of ${l.name}`}><button type="button" aria-label={l.qty === 1 ? `Remove ${l.name}` : `Decrease ${l.name}`} onClick={() => setQty(l.key, l.qty - 1)}>{l.qty === 1 ? <Trash2 size={18} /> : <Minus size={18} />}</button><output aria-live="polite">{l.qty}</output><button type="button" aria-label={`Increase ${l.name}`} onClick={() => setQty(l.key, l.qty + 1)}><Plus size={18} /></button></div>
            <b className="num" style={{ minWidth: 80, textAlign: 'right' }}>{formatINR(l.unit * l.qty)}</b></div>
        ))}</div></section>
        <section className="card stack">
          <div className="totals">{t.lines.map((l, i) => <div key={i} className="tl"><span>{l.label}</span><Money p={l.amount} /></div>)}<div className="tl total"><span>Total</span><Money p={t.total} /></div></div>
          {t.subtotal < DELIVERY_FREE_ABOVE && <Alert kind="info" title="Almost free delivery">Add {formatINR(DELIVERY_FREE_ABOVE - t.subtotal)} more for free delivery.</Alert>}
          <div className="small muted">Deliver to {addresses[0].label}: {addresses[0].line}</div>
          <Btn size="lg" block onClick={checkoutNow}>Checkout · {formatINR(t.total)}</Btn>
        </section>
      </div>
    </>
  );
}
