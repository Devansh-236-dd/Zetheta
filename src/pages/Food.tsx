import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, MapPin, Minus, Plus, ShoppingCart, Star, Trash2, UtensilsCrossed, XCircle } from 'lucide-react';
import { store, useStore } from '../store';
import { navigate } from '../router';
import { checkout, refund, DomainError } from '../lib/ledger';
import type { Order } from '../lib/types';
import { formatINR, type Paise } from '../lib/money';
import { foodTotals } from '../lib/pricing';
import { bookingRef, rid } from '../lib/ids';
import { RESTAURANTS, type MenuItem, type Restaurant } from '../data/catalog';
import { useCarts, type CartLine } from '../cart';
import { usePay } from '../components/PaySheet';
import { Alert, Btn, Dialog, DemoNote, Empty, Money, PageHeader, StatusBadge, Switch, announce, toast } from '../components/ui';
import { fmtDate } from './common';

const art = (r: Restaurant) => `hsl(${r.hue} 45% 20%)`;

export function FoodList() {
  const [q, setQ] = useState('');
  const [cuisine, setCuisine] = useState('All');
  const [veg, setVeg] = useState(false);
  const [sort, setSort] = useState<'rating' | 'eta' | 'cost'>('rating');
  const { carts } = useCarts();
  const cuisines = ['All', ...new Set(RESTAURANTS.flatMap((r) => r.cuisine))];
  const list = useMemo(() => RESTAURANTS.filter((r) => (cuisine === 'All' || r.cuisine.includes(cuisine)) && (!veg || r.veg) && (r.name + r.cuisine.join(' ') + r.menu.map((m) => m.name).join(' ')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'rating' ? b.rating - a.rating : sort === 'eta' ? a.eta - b.eta : a.costForTwo - b.costForTwo), [q, cuisine, veg, sort]);
  const count = carts.food.lines.reduce((a, l) => a + l.qty, 0);
  return (
    <>
      <PageHeader title="Food" sub="Order from demo restaurants and pay with your wallet." backTo="/" actions={<><Btn variant="ghost" size="sm" onClick={() => navigate('/orders')}>Your orders</Btn>{count > 0 && <Btn size="sm" icon={<ShoppingCart />} onClick={() => navigate('/food/cart')}>Cart ({count})</Btn>}</>} />
      <DemoNote>Restaurants and menus are sample data. Try <b className="mono">FOOD50</b> (50% off up to ₹120 on ₹199+, one use).</DemoNote>
      <div className="row">
        <div className="field grow" style={{ minWidth: 200 }}><label htmlFor="foodq" className="vh">Search restaurants or dishes</label><input id="foodq" className="input" placeholder="Search restaurants or dishes, e.g. dosa" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field" style={{ minWidth: 170 }}><label htmlFor="fsort" className="vh">Sort by</label><select id="fsort" className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="rating">Top rated</option><option value="eta">Fastest delivery</option><option value="cost">Lowest cost</option></select></div>
      </div>
      <div className="row">
        <div className="chips" role="group" aria-label="Cuisine">{cuisines.map((c) => <button key={c} type="button" className="chip" aria-pressed={cuisine === c} onClick={() => setCuisine(c)}>{c}</button>)}</div>
      </div>
      <div style={{ maxWidth: 320 }}><Switch checked={veg} onChange={setVeg} label="Pure veg only" /></div>
      <p className="small muted" aria-live="polite" style={{ margin: 0 }}>{list.length} restaurant{list.length === 1 ? '' : 's'}</p>
      {list.length === 0 ? <Empty icon={<UtensilsCrossed />} title="No restaurants match">Clear a filter to see more.</Empty> : (
        <div className="grid">
          {list.map((r) => (
            <button key={r.id} type="button" className="card click stack sm" style={{ padding: 0, overflow: 'hidden' }} onClick={() => navigate('/food/' + r.id)}>
              <div style={{ height: 110, background: art(r), position: 'relative', display: 'grid', placeItems: 'center' }} aria-hidden="true"><UtensilsCrossed size={40} color={`hsl(${r.hue} 85% 72%)`} />{r.tag && <span className="badge" style={{ position: 'absolute', left: 12, top: 12, background: 'rgba(0,0,0,.55)', color: '#fff' }}>{r.tag}</span>}</div>
              <div className="stack sm" style={{ padding: '4px 16px 16px' }}>
                <div className="row between nowrap"><b className="h3">{r.name}</b><span className="badge ok"><Star aria-hidden="true" />{r.rating}</span></div>
                <span className="small muted">{r.cuisine.join(' · ')}</span>
                <span className="small"><Clock size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {r.eta} min · {formatINR(r.costForTwo)} for two · min order {formatINR(r.minOrder)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function RestaurantPage({ id }: { id: string }) {
  const r = RESTAURANTS.find((x) => x.id === id);
  const { carts, setCarts } = useCarts();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [switchTo, setSwitchTo] = useState<CartLine | null>(null);
  if (!r) return <><PageHeader title="Restaurant" backTo="/food" /><Empty icon={<UtensilsCrossed />} title="Restaurant not found" /></>;
  const lines = carts.food.restaurantId === r.id ? carts.food.lines : [];
  const itemTotal = lines.reduce((a, l) => a + l.unit * l.qty, 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const addLine = (line: CartLine) => {
    if (carts.food.restaurantId && carts.food.restaurantId !== r.id && carts.food.lines.length) { setSwitchTo(line); return; }
    setCarts((c) => {
      const same = c.food.restaurantId === r.id ? c.food.lines : [];
      const ex = same.find((l) => l.key === line.key);
      return { ...c, food: { restaurantId: r.id, lines: ex ? same.map((l) => l.key === line.key ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l) : [...same, line] } };
    });
    toast(`${line.name} added`); announce(`${line.name} added to cart.`);
  };
  const qtyOf = (itemId: string) => lines.filter((l) => l.itemId === itemId).reduce((a, l) => a + l.qty, 0);
  return (
    <>
      <PageHeader title={r.name} eyebrow="Demo restaurant" sub={`${r.cuisine.join(' · ')} · ${r.eta} min · ★ ${r.rating}`} backTo="/food" />
      <div className="row small muted"><span>Delivery {formatINR(r.deliveryFee)}</span><span>· Packaging {formatINR(r.packaging)}</span><span>· Minimum order {formatINR(r.minOrder)}</span></div>
      <div style={{ maxWidth: 260 }}><Switch checked={vegOnly} onChange={setVegOnly} label="Veg dishes only" /></div>
      <section className="card" aria-label="Menu">
        <div className="list">
          {r.menu.filter((m) => !vegOnly || m.veg).map((m) => (
            <div key={m.id} className="li" style={{ alignItems: 'flex-start' }}>
              <span className={m.veg ? 'tag-veg' : 'tag-nonveg'} role="img" aria-label={m.veg ? 'Vegetarian' : 'Non-vegetarian'} style={{ marginTop: 4 }} />
              <span className="t"><b style={{ whiteSpace: 'normal' }}>{m.name}{m.bestseller && <span className="badge warn" style={{ marginLeft: 8 }}>Bestseller</span>}</b><small style={{ whiteSpace: 'normal' }}>{m.desc}</small><span className="num" style={{ fontWeight: 700 }}>{formatINR(m.price)}</span></span>
              <span className="stack sm" style={{ alignItems: 'flex-end' }}>
                <Btn size="sm" variant={qtyOf(m.id) ? 'quiet' : 'ghost'} icon={<Plus />} onClick={() => (m.size || m.options) ? setItem(m) : addLine({ key: m.id, itemId: m.id, name: m.name, unit: m.price, qty: 1, options: [], veg: m.veg })} aria-label={`Add ${m.name}, ${formatINR(m.price)}`}>Add</Btn>
                {qtyOf(m.id) > 0 && <span className="xs muted">{qtyOf(m.id)} in cart</span>}
                {(m.size || m.options) && <span className="xs dim">Customisable</span>}
              </span>
            </div>
          ))}
        </div>
      </section>
      {count > 0 && (
        <div className="cartbar" role="region" aria-label="Cart summary">
          <ShoppingCart aria-hidden="true" /><span className="grow">{count} item{count > 1 ? 's' : ''} · {formatINR(itemTotal)}{itemTotal < r.minOrder ? ` · add ${formatINR(r.minOrder - itemTotal)} more` : ''}</span>
          <Btn onClick={() => navigate('/food/cart')}>View cart</Btn>
        </div>
      )}
      {item && <ItemDialog item={item} onClose={() => setItem(null)} onAdd={(l) => { addLine(l); setItem(null); }} />}
      <Dialog open={!!switchTo} onClose={() => setSwitchTo(null)} title="Start a new cart?">
        <p style={{ margin: 0 }}>Your cart has items from {RESTAURANTS.find((x) => x.id === carts.food.restaurantId)?.name}. You can order from one restaurant at a time.</p>
        <Btn data-autofocus onClick={() => { const l = switchTo!; setCarts((c) => ({ ...c, food: { restaurantId: r.id, lines: [l] } })); setSwitchTo(null); toast('New cart started'); }}>Clear cart and add</Btn>
        <Btn variant="quiet" onClick={() => setSwitchTo(null)}>Keep my cart</Btn>
      </Dialog>
    </>
  );
}

function ItemDialog({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (l: CartLine) => void }) {
  const [size, setSize] = useState(item.size?.[0].id ?? '');
  const [opts, setOpts] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const sz = item.size?.find((s) => s.id === size);
  const unit: Paise = item.price + (sz?.price ?? 0) + (item.options ?? []).filter((o) => opts.includes(o.id)).reduce((a, o) => a + o.price, 0);
  const labels = [...(sz ? [sz.label] : []), ...(item.options ?? []).filter((o) => opts.includes(o.id)).map((o) => o.label)];
  return (
    <Dialog open onClose={onClose} title={item.name}>
      <p className="muted" style={{ margin: 0 }}>{item.desc}</p>
      {item.size && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="lbl" style={{ fontWeight: 700, marginBottom: 6 }}>Size</legend>
          <div className="stack sm" role="radiogroup">{item.size.map((s) => <button key={s.id} type="button" role="radio" aria-checked={size === s.id} className="card click row between" style={size === s.id ? { borderColor: 'var(--accent)' } : undefined} onClick={() => setSize(s.id)}><b>{s.label}</b><span>{s.price ? '+' + formatINR(s.price) : 'Included'}</span></button>)}</div>
        </fieldset>
      )}
      {item.options && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="lbl" style={{ fontWeight: 700, marginBottom: 6 }}>Add-ons</legend>
          <div className="stack sm">{item.options.map((o) => <button key={o.id} type="button" role="checkbox" aria-checked={opts.includes(o.id)} className="card click row between" style={opts.includes(o.id) ? { borderColor: 'var(--accent)' } : undefined} onClick={() => setOpts((x) => x.includes(o.id) ? x.filter((y) => y !== o.id) : [...x, o.id])}><span className="row nowrap">{opts.includes(o.id) ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}<b>{o.label}</b></span><span>+{formatINR(o.price)}</span></button>)}</div>
        </fieldset>
      )}
      <div className="row between"><div className="stepper" role="group" aria-label="Quantity"><button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button><output aria-live="polite">{qty}</output><button type="button" aria-label="Increase quantity" disabled={qty >= 10} onClick={() => setQty(qty + 1)}>+</button></div><b className="h2 num">{formatINR(unit * qty)}</b></div>
      <Btn size="lg" block onClick={() => onAdd({ key: `${item.id}|${size}|${[...opts].sort().join(',')}`, itemId: item.id, name: item.name, unit, qty, options: labels, veg: item.veg })}>Add to cart · {formatINR(unit * qty)}</Btn>
    </Dialog>
  );
}

export function FoodCart() {
  const { carts, setCarts } = useCarts();
  const addresses = useStore((s) => s.addresses);
  const [addr, setAddr] = useState(addresses[0]?.id ?? '');
  const { openPay } = usePay();
  const r = RESTAURANTS.find((x) => x.id === carts.food.restaurantId);
  const lines = carts.food.lines;
  if (!r || !lines.length) return <><PageHeader title="Your cart" backTo="/food" /><Empty icon={<ShoppingCart />} title="Your cart is empty" action={<Btn onClick={() => navigate('/food')}>Browse restaurants</Btn>}>Add dishes from a restaurant to get started.</Empty></>;
  const setQty = (key: string, q: number) => setCarts((c) => ({ ...c, food: { ...c.food, lines: q <= 0 ? c.food.lines.filter((l) => l.key !== key) : c.food.lines.map((l) => l.key === key ? { ...l, qty: Math.min(20, q) } : l) } }));
  const t = foodTotals(lines, r);
  const under = t.subtotal < r.minOrder;
  const address = addresses.find((a) => a.id === addr);
  const place = () => {
    if (under || !address) return;
    const snapshot = lines.map((l) => ({ ...l }));
    openPay({
      title: `${r.name} · ${snapshot.reduce((a, l) => a + l.qty, 0)} items · deliver to ${address.label}`,
      payee: { name: r.name, color: `hsl(${r.hue} 70% 38%)`, sub: 'via Zetheta Food (demo)' },
      category: 'food', couponable: true,
      totals: (d) => foodTotals(snapshot, r, d),
      commit: (s, x) => {
        const tt = foodTotals(snapshot, r, x.coupon?.discount ?? 0);
        return checkout(s, { key: x.key, category: 'food', merchantId: 'm_food', title: `Food: ${r.name}`, total: x.total, coupon: x.coupon,
          attach: (txn) => ({ orders: [{ id: rid('o_'), kind: 'food', ref: bookingRef('food'), merchantId: 'm_food', merchantName: r.name, lines: snapshot.map((l) => ({ itemId: l.itemId, name: l.name, unit: l.unit, qty: l.qty, options: l.options })), totals: tt.lines.filter((l) => l.amount !== 0).map((l) => ({ label: l.label, amount: l.amount })), total: tt.total, ts: txn.ts, txnId: txn.id, status: 'placed', address: address.line, couponCode: x.coupon?.code } as Order] }) });
      },
      onSuccess: () => setCarts((c) => ({ ...c, food: { restaurantId: null, lines: [] } })),
      success: { label: 'Track order', to: () => '/orders?new=1' },
    });
  };
  return (
    <>
      <PageHeader title="Your cart" sub={r.name} backTo={'/food/' + r.id} />
      <div className="grid two" style={{ alignItems: 'start' }}>
        <section className="card" aria-label="Items">
          <div className="list">
            {lines.map((l) => (
              <div key={l.key} className="li">
                <span className={l.veg ? 'tag-veg' : 'tag-nonveg'} role="img" aria-label={l.veg ? 'Vegetarian' : 'Non-vegetarian'} />
                <span className="t"><b>{l.name}</b><small>{l.options.join(', ') || 'Regular'} · {formatINR(l.unit)} each</small></span>
                <div className="stepper" role="group" aria-label={`Quantity of ${l.name}`}>
                  <button type="button" aria-label={l.qty === 1 ? `Remove ${l.name}` : `Decrease ${l.name}`} onClick={() => setQty(l.key, l.qty - 1)}>{l.qty === 1 ? <Trash2 size={18} /> : <Minus size={18} />}</button>
                  <output aria-live="polite">{l.qty}</output>
                  <button type="button" aria-label={`Increase ${l.name}`} onClick={() => setQty(l.key, l.qty + 1)}><Plus size={18} /></button>
                </div>
                <b className="num" style={{ minWidth: 70, textAlign: 'right' }}>{formatINR(l.unit * l.qty)}</b>
              </div>
            ))}
          </div>
          <Btn variant="ghost" size="sm" icon={<Plus />} onClick={() => navigate('/food/' + r.id)}>Add more items</Btn>
        </section>
        <section className="stack">
          <div className="card stack">
            <h2 className="h3"><MapPin size={18} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Deliver to</h2>
            <div className="stack sm" role="radiogroup" aria-label="Delivery address">{addresses.map((a) => <button key={a.id} type="button" role="radio" aria-checked={addr === a.id} className="card click" style={addr === a.id ? { borderColor: 'var(--accent)' } : undefined} onClick={() => setAddr(a.id)}><b>{a.label}</b><div className="small muted">{a.line}</div></button>)}</div>
          </div>
          <div className="card stack">
            <h2 className="h3">Bill details</h2>
            <div className="totals">{t.lines.map((l, i) => <div key={i} className="tl"><span>{l.label}</span><Money p={l.amount} /></div>)}<div className="tl total"><span>To pay</span><Money p={t.total} /></div></div>
            <p className="xs muted" style={{ margin: 0 }}>Coupons are applied on the next screen. The total always equals the lines above.</p>
            {under && <Alert kind="warn" title={`Minimum order is ${formatINR(r.minOrder)}`}>Add {formatINR(r.minOrder - t.subtotal)} more to place this order.</Alert>}
            <Btn size="lg" block disabled={under} onClick={place}>Place order · {formatINR(t.total)}</Btn>
          </div>
        </section>
      </div>
    </>
  );
}

const STAGES = [
  { id: 'placed', label: 'Order placed', sub: 'Restaurant has your order', at: 0 },
  { id: 'preparing', label: 'Preparing', sub: 'Your food is being cooked', at: 20 },
  { id: 'out_for_delivery', label: 'Out for delivery', sub: 'Rider is on the way (demo)', at: 60 },
  { id: 'delivered', label: 'Delivered', sub: 'Enjoy your meal', at: 120 },
] as const;
export function orderStage(o: Order, now = Date.now()) {
  if (o.status === 'cancelled') return 'cancelled';
  if (o.kind !== 'food') return o.status;
  const s = (now - o.ts) / 1000;
  return [...STAGES].reverse().find((x) => s >= x.at)!.id;
}
function useNow(ms = 1000) { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; }

export function Orders() {
  const orders = useStore((s) => s.orders);
  const now = useNow(5000);
  return (
    <>
      <PageHeader title="Your orders" sub="Food, shopping and bill payments." backTo="/food" />
      {orders.length === 0 ? <Empty icon={<UtensilsCrossed />} title="No orders yet" action={<Btn onClick={() => navigate('/food')}>Order food</Btn>} /> : (
        <div className="stack">{orders.map((o) => (
          <button key={o.id} type="button" className="card click row nowrap" onClick={() => navigate('/order/' + o.id)}>
            <span className="ticon"><UtensilsCrossed aria-hidden="true" /></span>
            <span className="grow min0"><b>{o.merchantName}</b><span className="small muted" style={{ display: 'block' }}>{o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</span><span className="xs muted">{fmtDate(o.ts)} · {o.ref}</span></span>
            <span className="stack sm" style={{ alignItems: 'flex-end' }}><StatusBadge status={orderStage(o, now)} /><b className="num">{formatINR(o.total)}</b></span>
          </button>
        ))}</div>
      )}
    </>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const o = useStore((s) => s.orders.find((x) => x.id === id));
  const now = useNow(1000);
  const [confirm, setConfirm] = useState(false);
  if (!o) return <><PageHeader title="Order" backTo="/orders" /><Empty icon={<UtensilsCrossed />} title="Order not found" /></>;
  const stage = orderStage(o, now);
  const idx = STAGES.findIndex((s) => s.id === stage);
  const canCancel = o.kind === 'food' && (stage === 'placed' || stage === 'preparing');
  const cancel = () => {
    try {
      let s = store.get();
      s = refund(s, o.txnId, o.total, `Cancelled order ${o.ref}`).state;
      s = { ...s, orders: s.orders.map((x) => x.id === o.id ? { ...x, status: 'cancelled' as const, refundAmount: o.total } : x) };
      store.set(s); setConfirm(false);
      toast(`Order cancelled. ${formatINR(o.total)} refunded to your wallet.`); announce('Order cancelled and refunded.');
    } catch (e) { toast(e instanceof DomainError ? e.message : 'Couldn’t cancel', 'err'); }
  };
  return (
    <>
      <PageHeader title={o.merchantName} eyebrow={`Order ${o.ref}`} sub={fmtDate(o.ts)} backTo="/orders" />
      <div className="grid two" style={{ alignItems: 'start' }}>
        <section className="card stack" aria-labelledby="ot-h">
          <div className="row between"><h2 id="ot-h" className="h3">Order status</h2><StatusBadge status={stage} /></div>
          {stage === 'cancelled' ? <Alert kind="info" title="Order cancelled">{o.refundAmount ? `${formatINR(o.refundAmount)} was refunded to your wallet.` : ''}</Alert> : o.kind === 'food' ? (
            <ol className="timeline" aria-live="polite">
              {STAGES.map((s, i) => <li key={s.id} className={i < idx || stage === 'delivered' ? 'done' : i === idx ? 'now' : ''}><span className="si">{(i < idx || stage === 'delivered') && <Check aria-hidden="true" />}</span><span><b>{s.label}</b><small>{s.sub}</small></span></li>)}
            </ol>
          ) : <p className="muted" style={{ margin: 0 }}>Paid. {o.kind === 'shopping' ? 'Estimated delivery in 3 days (demo).' : ''}</p>}
          {o.kind === 'food' && stage !== 'cancelled' && stage !== 'delivered' && <p className="xs muted" style={{ margin: 0 }}>Demo timeline runs fast: delivered about 2 minutes after ordering.</p>}
          {canCancel && <Btn variant="danger" icon={<XCircle />} onClick={() => setConfirm(true)}>Cancel order (full refund)</Btn>}
          {o.address && <div className="small muted"><MapPin size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {o.address}</div>}
        </section>
        <section className="card stack" aria-labelledby="ob-h">
          <h2 id="ob-h" className="h3">Items & bill</h2>
          <div className="list">{o.lines.map((l, i) => <div key={i} className="li"><span className="t"><b>{l.qty}× {l.name}</b><small>{l.options.join(', ')}</small></span><span className="num">{formatINR(l.unit * l.qty)}</span></div>)}</div>
          <div className="totals">{o.totals.map((t, i) => <div key={i} className={`tl ${t.amount < 0 ? 'discount' : ''}`}><span>{t.label}</span><Money p={t.amount} /></div>)}<div className="tl total"><span>Paid</span><Money p={o.total} /></div></div>
          {o.couponCode && <span className="badge ok" style={{ width: 'max-content' }}>Coupon {o.couponCode}</span>}
          <Btn variant="ghost" onClick={() => navigate('/txn/' + o.txnId)}>View payment receipt</Btn>
        </section>
      </div>
      <DemoNote>Cancellation rule (demo): full refund until the rider picks up the order.</DemoNote>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Cancel this order?">
        <p style={{ margin: 0 }}>{formatINR(o.total)} goes back to your Zetheta wallet straight away.</p>
        <Btn variant="danger" size="lg" block data-autofocus onClick={cancel}>Yes, cancel and refund</Btn>
        <Btn variant="quiet" block onClick={() => setConfirm(false)}>Keep order</Btn>
      </Dialog>
    </>
  );
}
