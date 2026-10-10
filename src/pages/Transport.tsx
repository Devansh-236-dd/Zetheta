import { useState } from 'react';
import { Car, MapPin } from 'lucide-react';
import { checkout } from '../lib/ledger';
import { formatINR } from '../lib/money';
import { simpleTotals } from '../lib/pricing';
import { BUS_PASSES, METRO_PASSES, PARKING_SPOTS, PLACES, RIDE_TYPES, rideQuote } from '../data/catalog';
import { usePay } from '../components/PaySheet';
import { Alert, Btn, DemoNote, Field, PageHeader, Seg, Stepper } from '../components/ui';
import { makeBooking } from './bookingKit';
import { useQuery } from './common';

type Tab = 'metro' | 'buspass' | 'parking' | 'ride';

export function Transport() {
  const q = useQuery();
  const [tab, setTab] = useState<Tab>((['metro', 'buspass', 'parking', 'ride'].includes(q.get('t') ?? '') ? q.get('t') : 'metro') as Tab);
  const { openPay } = usePay();
  const success = { label: 'View pass', to: () => '/bookings?new=1' };
  const buyPass = (kind: 'metro' | 'buspass', p: { id: string; label: string; price: number; desc: string }) => openPay({
    title: `${p.label} · ${p.desc}`, payee: { name: kind === 'metro' ? 'City Metro (demo)' : 'City Bus (demo)', color: '#0369A1' }, category: 'transport', couponable: true,
    totals: (d) => simpleTotals(p.label, p.price, d),
    commit: (s, x) => checkout(s, { key: x.key, category: 'transport', merchantId: 'm_move', title: p.label, total: x.total, coupon: x.coupon,
      attach: (txn) => ({ bookings: [makeBooking(kind, txn, { title: p.label, subtitle: p.desc, when: `Valid from ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, start: Date.now(), details: { Pass: p.label, Validity: p.desc, Use: 'Show the QR at the gate (demo)' } })] }) }),
    success,
  });
  return (
    <>
      <PageHeader title="Local transport" sub="Metro and bus passes, parking, and ride fare estimates." backTo="/" />
      <DemoNote>Passes, parking and fares are simulated. Use <b className="mono">RIDE20</b> for 20% off (up to ₹60).</DemoNote>
      <Seg label="Transport type" value={tab} onChange={setTab} options={[{ id: 'metro', label: 'Metro pass' }, { id: 'buspass', label: 'Bus pass' }, { id: 'parking', label: 'Parking' }, { id: 'ride', label: 'Auto & cab' }]} />
      {tab === 'metro' && <div className="grid">{METRO_PASSES.map((p) => <div key={p.id} className="card stack sm"><b className="h3">{p.label}</b><span className="small muted">{p.desc}</span><b className="h2 num">{formatINR(p.price)}</b><Btn onClick={() => buyPass('metro', p)}>Buy pass</Btn></div>)}</div>}
      {tab === 'buspass' && <div className="grid">{BUS_PASSES.map((p) => <div key={p.id} className="card stack sm"><b className="h3">{p.label}</b><span className="small muted">{p.desc}</span><b className="h2 num">{formatINR(p.price)}</b><Btn onClick={() => buyPass('buspass', p)}>Buy pass</Btn></div>)}</div>}
      {tab === 'parking' && <Parking />}
      {tab === 'ride' && <Ride />}
    </>
  );
}

function Parking() {
  const { openPay } = usePay();
  const [spot, setSpot] = useState(PARKING_SPOTS[0].id);
  const [hours, setHours] = useState(2);
  const [plate, setPlate] = useState('MH02AB1234');
  const [err, setErr] = useState<string | null>(null);
  const s = PARKING_SPOTS.find((x) => x.id === spot)!;
  const pay = () => {
    if (!/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(plate)) { setErr('Enter a vehicle number like MH02AB1234.'); return; }
    setErr(null);
    const start = Date.now() + 10 * 60000;
    openPay({
      title: `${s.label} · ${hours} h · ${plate}`, payee: { name: s.label, color: '#4338CA' }, category: 'transport', couponable: true,
      totals: (d) => simpleTotals(`Parking (${hours} h × ${formatINR(s.perHour)})`, s.perHour * hours, d),
      commit: (st, x) => checkout(st, { key: x.key, category: 'transport', merchantId: 'm_move', title: `Parking: ${s.label}`, total: x.total, coupon: x.coupon,
        attach: (txn) => ({ bookings: [makeBooking('parking', txn, { title: s.label, subtitle: `${hours} hours · ${plate}`, when: `From ${new Date(start).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} for ${hours} h`, start, details: { Location: s.label, Vehicle: plate, Duration: `${hours} hours`, Rate: `${formatINR(s.perHour)}/hour` } })] }) }),
      success: { label: 'View parking pass', to: () => '/bookings?new=1' },
    });
  };
  return (
    <section className="card stack" style={{ maxWidth: 640 }}>
      <Field label="Parking location">{(id) => <select id={id} className="select" value={spot} onChange={(e) => setSpot(e.target.value)}>{PARKING_SPOTS.map((p) => <option key={p.id} value={p.id}>{p.label} · {formatINR(p.perHour)}/h</option>)}</select>}</Field>
      <Field label="Vehicle number" error={err}>{(id, d) => <input id={id} aria-describedby={d} className="input mono" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />}</Field>
      <div className="row"><span className="lbl">Hours</span><Stepper label="Hours" value={hours} min={1} max={12} onChange={setHours} /><b className="h2 num" style={{ marginLeft: 'auto' }}>{formatINR(s.perHour * hours)}</b></div>
      <Btn size="lg" onClick={pay}>Pay for parking</Btn>
    </section>
  );
}

function Ride() {
  const { openPay } = usePay();
  const [from, setFrom] = useState('bandra'); const [to, setTo] = useState('bkc'); const [type, setType] = useState('auto');
  const quote = rideQuote(from, to, type);
  const a = PLACES.find((p) => p.id === from)!, b = PLACES.find((p) => p.id === to)!, r = RIDE_TYPES.find((x) => x.id === type)!;
  const book = () => {
    if (!quote) return;
    openPay({
      title: `${r.label} · ${a.label} → ${b.label} · ${quote.km} km`, payee: { name: 'Zetheta Move (demo)', color: '#9333EA' }, category: 'transport', couponable: true,
      totals: (d) => simpleTotals(`Fare (${quote.km} km estimate)`, quote.fare, d),
      commit: (s, x) => checkout(s, { key: x.key, category: 'transport', merchantId: 'm_move', title: `Ride: ${a.label} → ${b.label}`, total: x.total, coupon: x.coupon,
        attach: (txn) => ({ bookings: [makeBooking('taxi', txn, { title: `${a.label} → ${b.label}`, subtitle: `${r.label} · ${quote.km} km`, when: `Pickup in about 4 min (demo)`, start: Date.now() + 4 * 60000, details: { Ride: r.label, Pickup: a.label, Drop: b.label, Distance: `${quote.km} km`, 'Est. time': `${quote.mins} min`, Driver: 'Demo driver · MH 02 XY 0000' } })] }) }),
      success: { label: 'View ride', to: () => '/bookings?new=1' },
    });
  };
  return (
    <section className="card stack" style={{ maxWidth: 640 }}>
      <div className="formgrid">
        <Field label="Pickup">{(id) => <select id={id} className="select" value={from} onChange={(e) => setFrom(e.target.value)}>{PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>}</Field>
        <Field label="Drop">{(id) => <select id={id} className="select" value={to} onChange={(e) => setTo(e.target.value)}>{PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>}</Field>
      </div>
      <div className="stack sm" role="radiogroup" aria-label="Ride type">
        {RIDE_TYPES.map((x) => { const qq = rideQuote(from, to, x.id); return <button key={x.id} type="button" role="radio" aria-checked={type === x.id} className="card click row between" style={type === x.id ? { borderColor: 'var(--accent)' } : undefined} onClick={() => setType(x.id)}><span className="row nowrap"><Car aria-hidden="true" /><span><b>{x.label}</b><span className="xs muted" style={{ display: 'block' }}>{x.seats} seats</span></span></span><b className="num">{qq ? formatINR(qq.fare) : '—'}</b></button>; })}
      </div>
      {!quote ? <Alert kind="warn" title="Pick two different places" /> : <div className="row small muted"><MapPin size={16} aria-hidden="true" />{quote.km} km · about {quote.mins} min · fare estimate (demo formula)</div>}
      <Btn size="lg" disabled={!quote} onClick={book}>Book {r.label.toLowerCase()} {quote ? '· ' + formatINR(quote.fare) : ''}</Btn>
    </section>
  );
}
