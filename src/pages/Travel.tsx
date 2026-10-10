import { useEffect, useState } from 'react';
import { ArrowLeftRight, Bus as BusIcon, Hotel as HotelIcon, Plane, Search, Star, Train } from 'lucide-react';
import { navigate } from '../router';
import { checkout } from '../lib/ledger';
import { formatINR } from '../lib/money';
import { hotelTotals, travelTotals } from '../lib/pricing';
import { AIRPORTS, BUS_CITIES, HOTEL_CITIES, STATIONS, TRAIN_CLASSES, searchBuses, searchFlights, searchHotels, searchTrains, type BusResult, type FlightResult, type HotelResult, type TrainResult } from '../data/catalog';
import { usePay } from '../components/PaySheet';
import { Alert, Btn, DemoNote, Empty, Field, IconBtn, PageHeader, Seg, Stepper } from '../components/ui';
import { ICONS } from '../data/icons';
import { PassengerForm, makeBooking, prettyDate, startTs, usePax, validPax } from './bookingKit';
import { isoDay } from './common';

export function TravelHub() {
  const tiles = [
    { label: 'Trains', sub: 'Sleeper to AC, PNR tickets', path: '/travel/trains', icon: <Train />, color: '#1F7A6B' },
    { label: 'Flights', sub: 'One-way or return', path: '/travel/flights', icon: <Plane />, color: '#2B5BFF' },
    { label: 'Buses', sub: 'Pick your seat', path: '/travel/buses', icon: <BusIcon />, color: '#B8327A' },
    { label: 'Hotels', sub: 'Rooms with price breakdown', path: '/travel/hotels', icon: <HotelIcon />, color: '#7C3AED' },
  ];
  return (
    <>
      <PageHeader title="Travel" sub="Book trains, flights, buses and hotels with your Zetheta wallet." backTo="/" />
      <DemoNote>All schedules, fares and hotels are invented sample data for the demo. They are not live availability and no operator is contacted. Try coupon <b className="mono">TRAVEL100</b> on bookings of ₹999 or more.</DemoNote>
      <div className="grid">
        {tiles.map((t) => (
          <button key={t.label} type="button" className="card click stack sm" onClick={() => navigate(t.path)}>
            {ICONS[t.label] ? <img className="appimg" src={ICONS[t.label]} alt="" width={56} height={56} /> : <span className="ticon" style={{ background: t.color, color: '#fff', width: 52, height: 52 }}>{t.icon}</span>}
            <b className="h3">{t.label}</b><span className="small muted">{t.sub}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Loading() { return <div className="stack" aria-label="Searching" role="status">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 96 }} />)}<span className="vh">Searching demo inventory…</span></div>; }
function useFakeLoad<T>(fn: () => T, deps: unknown[], on: boolean): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => { if (!on) return; setV(null); const t = setTimeout(() => setV(fn()), 550); return () => clearTimeout(t); }, deps);
  return v;
}

/* ---------------- trains ---------------- */
export function Trains() {
  const { openPay } = usePay();
  const [form, setForm] = useState({ from: 'CSMT', to: 'PUNE', date: isoDay(3), pax: 1, cls: '3A' });
  const [searched, setSearched] = useState<typeof form | null>(null);
  const [sel, setSel] = useState<TrainResult | null>(null);
  const { pax, setPax, resize } = usePax(1);
  const [showErr, setShowErr] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const results = useFakeLoad(() => (searched ? searchTrains(searched.from, searched.to, searched.date, searched.cls) : []), [searched], !!searched);
  const search = () => {
    if (form.from === form.to) { setFormErr('Choose different From and To stations.'); return; }
    if (form.date < isoDay(0)) { setFormErr('Pick today or a future date.'); return; }
    setFormErr(null); setSel(null); resize(form.pax); setSearched({ ...form });
  };
  const book = () => {
    if (!sel || !searched) return;
    if (!validPax(pax)) { setShowErr(true); return; }
    const a = STATIONS.find((s) => s.code === sel.from)!, b = STATIONS.find((s) => s.code === sel.to)!;
    const cls = TRAIN_CLASSES.find((c) => c.id === searched.cls)!;
    openPay({
      title: `${sel.name} (${sel.number}) · ${a.name} → ${b.name} · ${prettyDate(searched.date)} · ${cls.label}`,
      payee: { name: 'Zetheta Rail (demo)', color: '#1F7A6B', sub: `${searched.pax} passenger${searched.pax > 1 ? 's' : ''}` },
      category: 'travel', couponable: true,
      totals: (d) => travelTotals(sel.fare, searched.pax, 'train', d),
      commit: (s, x) => checkout(s, { key: x.key, category: 'travel', merchantId: 'm_rail', title: `Train ${a.code} → ${b.code}`, total: x.total, coupon: x.coupon,
        attach: (txn) => ({ bookings: [makeBooking('train', txn, { title: `${a.city} → ${b.city}`, subtitle: `${sel.name} · ${sel.number} · ${cls.label}`, when: `${prettyDate(searched.date)} · ${sel.dep}`, start: startTs(searched.date, sel.dep),
          details: { Train: `${sel.name} (${sel.number})`, From: a.name, To: b.name, Departs: `${sel.dep}, ${prettyDate(searched.date)}`, Arrives: sel.arr, Duration: sel.duration, Class: cls.label, Status: sel.status.startsWith('Available') ? 'Confirmed (demo)' : sel.status + ' (demo)' },
          passengers: pax.map((p, i) => ({ name: p.name.trim(), age: +p.age, seat: `${searched.cls === 'CC' ? 'C' : 'B'}${2 + (i % 3)}-${10 + i * 3}` })) })] }) }),
      success: { label: 'View ticket', to: () => '/bookings?new=1' },
    });
  };
  return (
    <>
      <PageHeader title="Train tickets" sub="Search, pick a train, add passengers and pay." backTo="/travel" />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); search(); }} aria-label="Search trains">
        <div className="formgrid">
          <Field label="From">{(id) => <select id={id} className="select" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>{STATIONS.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}</select>}</Field>
          <IconBtn label="Swap From and To" onClick={() => setForm({ ...form, from: form.to, to: form.from })}><ArrowLeftRight /></IconBtn>
          <Field label="To">{(id) => <select id={id} className="select" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>{STATIONS.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}</select>}</Field>
          <Field label="Journey date">{(id) => <input id={id} type="date" className="input" min={isoDay(0)} max={isoDay(120)} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          <Field label="Class">{(id) => <select id={id} className="select" value={form.cls} onChange={(e) => setForm({ ...form, cls: e.target.value })}>{TRAIN_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>}</Field>
          <div className="field"><span className="lbl">Passengers</span><Stepper label="Passengers" value={form.pax} min={1} max={6} onChange={(v) => setForm({ ...form, pax: v })} /></div>
        </div>
        {formErr && <Alert kind="err" title="Check your search">{formErr}</Alert>}
        <Btn type="submit" icon={<Search />}>Search trains</Btn>
      </form>
      {searched && !results && <Loading />}
      {results && !sel && (
        <section className="stack" aria-label="Train results">
          <div className="row between"><h2 className="h2">{results.length} demo trains · {prettyDate(searched!.date)}</h2><span className="badge demo">Sample data</span></div>
          {results.length === 0 ? <Empty icon={<Train />} title="No trains on this route">Try another pair of stations.</Empty> : results.map((r) => (
            <div key={r.id} className="card row between" style={{ alignItems: 'center' }}>
              <div className="stack sm grow">
                <b className="h3">{r.name} <span className="mono small muted">#{r.number}</span></b>
                <div className="row small"><b className="num">{r.dep}</b><span className="muted">— {r.duration} —</span><b className="num">{r.arr}</b><span className="muted">· {r.km} km</span></div>
                <span className={`badge ${r.seats > 20 ? 'ok' : r.seats > 0 ? 'warn' : 'err'}`} style={{ width: 'max-content' }}>{r.status}</span>
              </div>
              <div className="stack sm" style={{ alignItems: 'flex-end' }}><b className="h2 num">{formatINR(r.fare)}</b><span className="xs muted">per person</span><Btn size="sm" onClick={() => setSel(r)}>Select</Btn></div>
            </div>
          ))}
        </section>
      )}
      {sel && searched && (
        <section className="stack" aria-labelledby="pax-h">
          <div className="card row between"><div><b>{sel.name} · {sel.dep} → {sel.arr}</b><div className="small muted">{prettyDate(searched.date)} · {TRAIN_CLASSES.find((c) => c.id === searched.cls)?.label}</div></div><Btn variant="quiet" size="sm" onClick={() => setSel(null)}>Change train</Btn></div>
          <h2 id="pax-h" className="h2">Passenger details</h2>
          <PassengerForm pax={pax} setPax={setPax} showErrors={showErr} />
          {showErr && !validPax(pax) && <Alert kind="err" title="Some details are missing">Fill in a name and age for every passenger.</Alert>}
          <Btn size="lg" onClick={book}>Review & pay {formatINR(travelTotals(sel.fare, searched.pax, 'train').total)}</Btn>
        </section>
      )}
    </>
  );
}

/* ---------------- flights ---------------- */
export function Flights() {
  const { openPay } = usePay();
  const [form, setForm] = useState({ from: 'BOM', to: 'DEL', date: isoDay(5), ret: '', pax: 1, cabin: 'economy' as 'economy' | 'business', trip: 'one' as 'one' | 'round' });
  const [searched, setSearched] = useState<typeof form | null>(null);
  const [out, setOut] = useState<FlightResult | null>(null);
  const [back, setBack] = useState<FlightResult | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const { pax, setPax, resize } = usePax(1);
  const [showErr, setShowErr] = useState(false);
  const outs = useFakeLoad(() => (searched ? searchFlights(searched.from, searched.to, searched.date, searched.cabin) : []), [searched], !!searched);
  const rets = searched?.trip === 'round' ? searchFlights(searched.to, searched.from, searched.ret, searched.cabin) : [];
  const search = () => {
    if (form.from === form.to) return setFormErr('Choose different origin and destination.');
    if (form.date < isoDay(0)) return setFormErr('Pick today or a future departure date.');
    if (form.trip === 'round' && (!form.ret || form.ret < form.date)) return setFormErr('The return date must be on or after the departure date.');
    setFormErr(null); setOut(null); setBack(null); resize(form.pax); setSearched({ ...form });
  };
  const ready = out && (searched?.trip === 'one' || back);
  const fare = (out?.fare ?? 0) + (back?.fare ?? 0);
  const book = () => {
    if (!out || !searched) return;
    if (!validPax(pax)) { setShowErr(true); return; }
    const a = AIRPORTS.find((x) => x.code === out.from)!, b = AIRPORTS.find((x) => x.code === out.to)!;
    openPay({
      title: `${out.airline} ${out.flightNo} · ${a.city} → ${b.city}${back ? ` · return ${back.flightNo}` : ''} · ${searched.cabin}`,
      payee: { name: 'Zetheta Flights (demo)', color: out.color, sub: `${searched.pax} traveller${searched.pax > 1 ? 's' : ''}` },
      category: 'travel', couponable: true,
      totals: (d) => travelTotals(fare, searched.pax, 'flight', d),
      commit: (s, x) => checkout(s, { key: x.key, category: 'travel', merchantId: 'm_air', title: `Flight ${a.code} → ${b.code}${back ? ' (return)' : ''}`, total: x.total, coupon: x.coupon,
        attach: (txn) => ({ bookings: [makeBooking('flight', txn, { title: `${a.city} → ${b.city}${back ? ' → ' + a.city : ''}`, subtitle: `${out.airline} ${out.flightNo}${back ? ' · ' + back.flightNo : ''} · ${searched.cabin === 'business' ? 'Business' : 'Economy'}`, when: `${prettyDate(searched.date)} · ${out.dep}`, start: startTs(searched.date, out.dep),
          details: { Outbound: `${out.flightNo} ${out.from} ${out.dep} → ${out.to} ${out.arr} (${out.duration}, ${out.stops})`, ...(back ? { Return: `${back.flightNo} ${back.from} ${back.dep} → ${back.to} ${back.arr}, ${prettyDate(searched.ret)}` } : {}), Cabin: searched.cabin === 'business' ? 'Business' : 'Economy', Baggage: searched.cabin === 'business' ? '35 kg check-in + 7 kg cabin' : '15 kg check-in + 7 kg cabin', 'Web check-in': 'Opens 48 h before departure (demo)' },
          passengers: pax.map((p, i) => ({ name: p.name.trim(), age: +p.age, seat: `${12 + i}${'ACDF'[i % 4]}` })) })] }) }),
      success: { label: 'View e-ticket', to: () => '/bookings?new=1' },
    });
  };
  const FlightCard = ({ f, onPick, picked }: { f: FlightResult; onPick: () => void; picked?: boolean }) => (
    <div className="card row between" style={picked ? { borderColor: 'var(--ok)' } : undefined}>
      <div className="row nowrap grow"><span className="ticon" style={{ background: f.color, color: '#fff' }}><Plane /></span>
        <div className="stack sm"><b>{f.airline} <span className="mono small muted">{f.flightNo}</span></b><div className="row small"><b className="num">{f.dep}</b><span className="muted">— {f.duration} —</span><b className="num">{f.arr}</b><span className={`badge ${f.stops === 'Non-stop' ? 'ok' : 'warn'}`}>{f.stops}</span></div><span className="xs muted">{f.seatsLeft} seats left at this fare (demo)</span></div></div>
      <div className="stack sm" style={{ alignItems: 'flex-end' }}><b className="h2 num">{formatINR(f.fare)}</b><Btn size="sm" variant={picked ? 'quiet' : 'primary'} onClick={onPick}>{picked ? 'Selected' : 'Select'}</Btn></div>
    </div>
  );
  return (
    <>
      <PageHeader title="Flights" sub="Domestic flights with clear fares, taxes and fees." backTo="/travel" />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); search(); }} aria-label="Search flights">
        <Seg label="Trip type" value={form.trip} onChange={(v) => setForm({ ...form, trip: v })} options={[{ id: 'one', label: 'One-way' }, { id: 'round', label: 'Return' }]} />
        <div className="formgrid">
          <Field label="From">{(id) => <select id={id} className="select" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>{AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}</select>}</Field>
          <Field label="To">{(id) => <select id={id} className="select" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>{AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}</select>}</Field>
          <Field label="Departure">{(id) => <input id={id} type="date" className="input" min={isoDay(0)} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          {form.trip === 'round' && <Field label="Return">{(id) => <input id={id} type="date" className="input" min={form.date} value={form.ret} onChange={(e) => setForm({ ...form, ret: e.target.value })} />}</Field>}
          <Field label="Cabin">{(id) => <select id={id} className="select" value={form.cabin} onChange={(e) => setForm({ ...form, cabin: e.target.value as 'economy' | 'business' })}><option value="economy">Economy</option><option value="business">Business</option></select>}</Field>
          <div className="field"><span className="lbl">Travellers</span><Stepper label="Travellers" value={form.pax} min={1} max={6} onChange={(v) => setForm({ ...form, pax: v })} /></div>
        </div>
        {formErr && <Alert kind="err" title="Check your search">{formErr}</Alert>}
        <Btn type="submit" icon={<Search />}>Search flights</Btn>
      </form>
      {searched && !outs && <Loading />}
      {outs && !ready && (
        <section className="stack" aria-label="Flight results">
          <div className="row between"><h2 className="h2">{!out ? `Outbound · ${prettyDate(searched!.date)}` : `Return · ${prettyDate(searched!.ret)}`}</h2><span className="badge demo">Sample fares</span></div>
          {(!out ? outs : rets).map((f) => <FlightCard key={f.id} f={f} onPick={() => (!out ? setOut(f) : setBack(f))} />)}
          {out && <Btn variant="quiet" onClick={() => setOut(null)}>Change outbound flight</Btn>}
        </section>
      )}
      {ready && searched && (
        <section className="stack" aria-labelledby="fpax-h">
          <FlightCard f={out!} picked onPick={() => { setOut(null); setBack(null); }} />
          {back && <FlightCard f={back} picked onPick={() => setBack(null)} />}
          <h2 id="fpax-h" className="h2">Traveller details</h2>
          <PassengerForm pax={pax} setPax={setPax} showErrors={showErr} labels={pax.map((_, i) => `Traveller ${i + 1}`)} />
          {showErr && !validPax(pax) && <Alert kind="err" title="Some details are missing">Fill in a name and age for every traveller.</Alert>}
          <Btn size="lg" onClick={book}>Review & pay {formatINR(travelTotals(fare, searched.pax, 'flight').total)}</Btn>
        </section>
      )}
    </>
  );
}

/* ---------------- buses ---------------- */
export function Buses() {
  const { openPay } = usePay();
  const [form, setForm] = useState({ from: 'Mumbai', to: 'Pune', date: isoDay(2) });
  const [searched, setSearched] = useState<typeof form | null>(null);
  const [sel, setSel] = useState<BusResult | null>(null);
  const [seats, setSeats] = useState<number[]>([]);
  const [board, setBoard] = useState(''); const [drop, setDrop] = useState('');
  const { pax, setPax, resize } = usePax(1);
  const [showErr, setShowErr] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const results = useFakeLoad(() => (searched ? searchBuses(searched.from, searched.to, searched.date) : []), [searched], !!searched);
  useEffect(() => { resize(Math.max(1, seats.length)); }, [seats.length]);
  const search = () => { if (form.from === form.to) return setFormErr('Choose different cities.'); setFormErr(null); setSel(null); setSeats([]); setSearched({ ...form }); };
  const seatLabel = (n: number) => `${Math.floor(n / 3) + 1}${'ABC'[n % 3]}`;
  const toggleSeat = (n: number) => setSeats((s) => s.includes(n) ? s.filter((x) => x !== n) : s.length >= 6 ? s : [...s, n].sort((a, b) => a - b));
  const book = () => {
    if (!sel || !searched) return;
    if (!seats.length || !board || !drop || !validPax(pax)) { setShowErr(true); return; }
    openPay({
      title: `${sel.operator} · ${sel.from} → ${sel.to} · ${prettyDate(searched.date)} ${sel.dep} · Seats ${seats.map(seatLabel).join(', ')}`,
      payee: { name: 'Zetheta Bus (demo)', color: '#B8327A', sub: `${seats.length} seat${seats.length > 1 ? 's' : ''}` },
      category: 'travel', couponable: true,
      totals: (d) => travelTotals(sel.fare, seats.length, 'bus', d),
      commit: (s, x) => checkout(s, { key: x.key, category: 'travel', merchantId: 'm_bus', title: `Bus ${sel.from} → ${sel.to}`, total: x.total, coupon: x.coupon,
        attach: (txn) => ({ bookings: [makeBooking('bus', txn, { title: `${sel.from} → ${sel.to}`, subtitle: `${sel.operator} · ${sel.type}`, when: `${prettyDate(searched.date)} · ${sel.dep}`, start: startTs(searched.date, sel.dep),
          details: { Operator: sel.operator, Bus: sel.type, Boarding: board, 'Drop-off': drop, Departs: sel.dep, Arrives: sel.arr, Seats: seats.map(seatLabel).join(', ') },
          passengers: pax.map((p, i) => ({ name: p.name.trim(), age: +p.age, seat: seatLabel(seats[i]) })) })] }) }),
      success: { label: 'View ticket', to: () => '/bookings?new=1' },
    });
  };
  return (
    <>
      <PageHeader title="Bus tickets" sub="Choose your bus, pick seats, boarding and drop-off points." backTo="/travel" />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); search(); }} aria-label="Search buses">
        <div className="formgrid">
          <Field label="From">{(id) => <select id={id} className="select" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>{BUS_CITIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          <Field label="To">{(id) => <select id={id} className="select" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>{BUS_CITIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          <Field label="Date">{(id) => <input id={id} type="date" className="input" min={isoDay(0)} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
        </div>
        {formErr && <Alert kind="err" title="Check your search">{formErr}</Alert>}
        <Btn type="submit" icon={<Search />}>Search buses</Btn>
      </form>
      {searched && !results && <Loading />}
      {results && !sel && results.map((r) => (
        <div key={r.id} className="card row between">
          <div className="stack sm grow"><b className="h3">{r.operator}</b><span className="small muted">{r.type}</span><div className="row small"><b className="num">{r.dep}</b><span className="muted">— {r.duration} —</span><b className="num">{r.arr}</b><span className="muted">· {30 - r.booked.length} seats free</span></div></div>
          <div className="stack sm" style={{ alignItems: 'flex-end' }}><b className="h2 num">{formatINR(r.fare)}</b><Btn size="sm" onClick={() => { setSel(r); setBoard(r.boarding[0]); setDrop(r.drops[0]); }}>Select seats</Btn></div>
        </div>
      ))}
      {sel && searched && (
        <section className="stack" aria-labelledby="seat-h">
          <div className="card row between"><div><b>{sel.operator} · {sel.dep} → {sel.arr}</b><div className="small muted">{sel.type} · {formatINR(sel.fare)} per seat</div></div><Btn variant="quiet" size="sm" onClick={() => { setSel(null); setSeats([]); }}>Change bus</Btn></div>
          <h2 id="seat-h" className="h2">Pick seats (up to 6)</h2>
          <div className="card">
            <div className="legend" aria-hidden="true"><span><i />Free</span><span><i style={{ background: 'var(--ok)', borderColor: 'var(--ok)' }} />Selected</span><span><i style={{ background: '#262B4A', borderColor: 'transparent' }} />Booked</span></div>
            <div className="seatmap bus" role="group" aria-label="Bus seats, 10 rows, 2 plus 1 layout">
              {Array.from({ length: 10 }, (_, r) => (
                <div key={r} className="seatrow">
                  <span className="rl" aria-hidden="true">{r + 1}</span>
                  {[0, 1, 2].map((c) => { const n = r * 3 + c, booked = sel.booked.includes(n); return <button key={c} type="button" className={`seat ${c === 2 ? 'gap' : ''}`} disabled={booked} aria-pressed={seats.includes(n)} aria-label={`Seat ${seatLabel(n)}${c === 2 ? ', single window' : c === 0 ? ', window' : ', aisle'}${booked ? ', booked' : ''}`} onClick={() => toggleSeat(n)}>{seatLabel(n)}</button>; })}
                </div>
              ))}
            </div>
            <p className="small muted" aria-live="polite" style={{ textAlign: 'center' }}>{seats.length ? `Selected: ${seats.map(seatLabel).join(', ')} · ${formatINR(sel.fare * seats.length)}` : 'No seats selected'}</p>
          </div>
          {showErr && !seats.length && <Alert kind="err" title="Pick at least one seat" />}
          <div className="formgrid">
            <Field label="Boarding point">{(id) => <select id={id} className="select" value={board} onChange={(e) => setBoard(e.target.value)}>{sel.boarding.map((b) => <option key={b}>{b}</option>)}</select>}</Field>
            <Field label="Drop-off point">{(id) => <select id={id} className="select" value={drop} onChange={(e) => setDrop(e.target.value)}>{sel.drops.map((b) => <option key={b}>{b}</option>)}</select>}</Field>
          </div>
          {seats.length > 0 && <PassengerForm pax={pax} setPax={setPax} showErrors={showErr} labels={seats.map((n) => `Seat ${seatLabel(n)}`)} />}
          <Btn size="lg" disabled={!seats.length} onClick={book}>Review & pay {seats.length ? formatINR(travelTotals(sel.fare, seats.length, 'bus').total) : ''}</Btn>
        </section>
      )}
    </>
  );
}

/* ---------------- hotels ---------------- */
export function Hotels() {
  const { openPay } = usePay();
  const [form, setForm] = useState({ city: 'Goa', in: isoDay(7), out: isoDay(9), guests: 2, rooms: 1 });
  const [searched, setSearched] = useState<typeof form | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [guest, setGuest] = useState('Ramesh Kumar');
  const results = useFakeLoad(() => (searched ? searchHotels(searched.city, searched.in) : []), [searched], !!searched);
  const nights = searched ? Math.round((new Date(searched.out).getTime() - new Date(searched.in).getTime()) / 86400000) : 0;
  const search = () => {
    if (form.in < isoDay(0)) return setFormErr('Check-in can’t be in the past.');
    if (form.out <= form.in) return setFormErr('Check-out must be after check-in.');
    if (form.guests > form.rooms * 3) return setFormErr('Up to 3 guests per room. Add a room.');
    setFormErr(null); setSearched({ ...form });
  };
  const book = (h: HotelResult, room: HotelResult['rooms'][number]) => {
    if (!searched) return;
    if (guest.trim().length < 2) { setFormErr('Enter the lead guest’s name.'); return; }
    openPay({
      title: `${h.name} · ${room.name} · ${prettyDate(searched.in)} – ${prettyDate(searched.out)}`,
      payee: { name: 'Zetheta Stays (demo)', color: h.color, sub: `${nights} night${nights > 1 ? 's' : ''} · ${searched.rooms} room${searched.rooms > 1 ? 's' : ''}` },
      category: 'travel', couponable: true,
      totals: (d) => hotelTotals(room.rate, nights, searched.rooms, d),
      commit: (s, x) => checkout(s, { key: x.key, category: 'travel', merchantId: 'm_stay', title: `Hotel: ${h.name}`, total: x.total, coupon: x.coupon,
        attach: (txn) => ({ bookings: [makeBooking('hotel', txn, { title: h.name, subtitle: `${room.name} · ${searched.guests} guest${searched.guests > 1 ? 's' : ''}`, when: `${prettyDate(searched.in)} → ${prettyDate(searched.out)}`, start: startTs(searched.in, '14:00'),
          details: { Hotel: h.name, Area: h.area, Room: room.name, Rooms: String(searched.rooms), Guests: String(searched.guests), 'Lead guest': guest.trim(), 'Check-in': `${prettyDate(searched.in)}, 2 PM`, 'Check-out': `${prettyDate(searched.out)}, 11 AM`, Cancellation: room.refundable ? 'Refundable (demo policy)' : 'Non-refundable' } })] }) }),
      success: { label: 'View booking', to: () => '/bookings?new=1' },
    });
  };
  return (
    <>
      <PageHeader title="Hotels" sub="Search stays and see the full price before you pay." backTo="/travel" />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); search(); }} aria-label="Search hotels">
        <div className="formgrid">
          <Field label="City">{(id) => <select id={id} className="select" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>{HOTEL_CITIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          <Field label="Check-in">{(id) => <input id={id} type="date" className="input" min={isoDay(0)} value={form.in} onChange={(e) => setForm({ ...form, in: e.target.value })} />}</Field>
          <Field label="Check-out">{(id) => <input id={id} type="date" className="input" min={form.in} value={form.out} onChange={(e) => setForm({ ...form, out: e.target.value })} />}</Field>
          <div className="field"><span className="lbl">Guests</span><Stepper label="Guests" value={form.guests} min={1} max={9} onChange={(v) => setForm({ ...form, guests: v })} /></div>
          <div className="field"><span className="lbl">Rooms</span><Stepper label="Rooms" value={form.rooms} min={1} max={3} onChange={(v) => setForm({ ...form, rooms: v })} /></div>
        </div>
        {formErr && <Alert kind="err" title="Check your search">{formErr}</Alert>}
        <Btn type="submit" icon={<Search />}>Search hotels</Btn>
      </form>
      {searched && !results && <Loading />}
      {results && searched && (
        <section className="stack" aria-label="Hotel results">
          <div className="row between"><h2 className="h2">{results.length} demo stays in {searched.city} · {nights} night{nights > 1 ? 's' : ''}</h2><span className="badge demo">Sample hotels</span></div>
          <Field label="Lead guest name">{(id) => <input id={id} className="input" value={guest} onChange={(e) => setGuest(e.target.value)} style={{ maxWidth: 360 }} />}</Field>
          {results.map((h) => (
            <div key={h.id} className="card stack">
              <div className="row nowrap"><span className="ticon" style={{ background: h.color, color: '#fff', width: 56, height: 56 }}><HotelIcon /></span>
                <div className="grow"><b className="h3">{h.name}</b><div className="small muted">{h.area} · <Star size={13} fill="#FFC861" color="#FFC861" aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {h.rating} ({h.reviews} demo reviews)</div><div className="chips" style={{ marginTop: 6 }}>{h.amenities.map((a) => <span key={a} className="badge">{a}</span>)}</div></div></div>
              <div className="list">
                {h.rooms.map((r) => (
                  <div key={r.id} className="li"><span className="t"><b>{r.name}</b><small>{r.refundable ? 'Free cancellation 48 h before (demo)' : 'Non-refundable'} · {formatINR(r.rate)}/night</small></span>
                    <span className="stack sm" style={{ alignItems: 'flex-end' }}><b className="num">{formatINR(hotelTotals(r.rate, nights, searched.rooms).total)}</b><span className="xs muted">incl. 12% GST</span><Btn size="sm" onClick={() => book(h, r)}>Book</Btn></span></div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
