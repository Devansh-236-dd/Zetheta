import { useMemo, useState } from 'react';
import { Accessibility, Clapperboard, Clock, MapPin } from 'lucide-react';
import { navigate } from '../router';
import { checkout } from '../lib/ledger';
import { formatINR, type Paise } from '../lib/money';
import { ticketTotalsFromBase } from '../lib/pricing';
import { CITIES, EVENT_ZONES, SEAT_ROWS, SHOWS, bookedSeats, type Show } from '../data/catalog';
import { usePay } from '../components/PaySheet';
import { Alert, Btn, DemoNote, Empty, PageHeader, Seg, Stepper } from '../components/ui';
import { makeBooking } from './bookingKit';
import { useQuery } from './common';

const art = (s: Show) => `hsl(${s.hue} 55% 32%)`;
const dayLabel = (off: number) => { const d = new Date(Date.now() + off * 86400000); return off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); };
const dayDate = (off: number) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10);

export function FunList() {
  const q = useQuery();
  const [kind, setKind] = useState<'all' | 'movie' | 'event'>((q.get('k') as 'movie' | 'event') ?? 'all');
  const [city, setCity] = useState('Mumbai');
  const [genre, setGenre] = useState('All');
  const [text, setText] = useState('');
  const list = useMemo(() => SHOWS.filter((s) => (kind === 'all' || s.kind === kind) && s.city.includes(city) && (genre === 'All' || s.genre.includes(genre)) && (s.title + s.genre + s.lang).toLowerCase().includes(text.toLowerCase())), [kind, city, genre, text]);
  const genres = ['All', ...new Set(SHOWS.flatMap((s) => s.genre.split(' · ')))];
  return (
    <>
      <PageHeader title="Movies & events" sub="Find a show, pick seats and get a QR ticket." backTo="/" />
      <DemoNote>All titles, venues and showtimes are invented for the demo. Use <b className="mono">MOVIE75</b> for ₹75 off tickets of ₹300 or more.</DemoNote>
      <div className="row">
        <Seg label="Type" value={kind} onChange={setKind} options={[{ id: 'all', label: 'All' }, { id: 'movie', label: 'Movies' }, { id: 'event', label: 'Events' }]} />
        <div className="field" style={{ minWidth: 160 }}><label htmlFor="fc" className="vh">City</label><select id="fc" className="select" value={city} onChange={(e) => setCity(e.target.value)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field grow" style={{ minWidth: 180 }}><label htmlFor="fq" className="vh">Search shows</label><input id="fq" className="input" placeholder="Search title, genre or language" value={text} onChange={(e) => setText(e.target.value)} /></div>
      </div>
      <div className="chips" role="group" aria-label="Genre">{genres.map((g) => <button key={g} type="button" className="chip" aria-pressed={genre === g} onClick={() => setGenre(g)}>{g}</button>)}</div>
      {list.length === 0 ? <Empty icon={<Clapperboard />} title="Nothing matches">Try another city or genre.</Empty> : (
        <div className="grid sm">
          {list.map((s) => (
            <button key={s.id} type="button" className="poster" style={{ background: art(s), cursor: 'pointer' }} onClick={() => navigate('/fun/' + s.id)} aria-label={`${s.title}, ${s.kind}, ${s.genre}, ${s.lang}, from ${formatINR(s.price)}`}>
              <span className="badge" style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,.5)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>{s.kind === 'movie' ? 'Movie' : 'Event'}</span>
              <b className="h3" style={{ textAlign: 'left' }}>{s.title}</b>
              <span className="xs" style={{ color: '#FFFFFF', textAlign: 'left' }}>{s.genre} · {s.lang}</span>
              <span className="small" style={{ fontWeight: 700, textAlign: 'left' }}>from {formatINR(s.price)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function ShowDetail({ id }: { id: string }) {
  const s = SHOWS.find((x) => x.id === id);
  const { openPay } = usePay();
  const [day, setDay] = useState(s?.dates[0] ?? 0);
  const [time, setTime] = useState(s?.times[0] ?? '');
  const [seats, setSeats] = useState<string[]>([]);
  const [zone, setZone] = useState('ga');
  const [qty, setQty] = useState(2);
  const [err, setErr] = useState<string | null>(null);
  const booked = useMemo(() => bookedSeats(`${id}${day}${time}`), [id, day, time]);
  if (!s) return <><PageHeader title="Show" backTo="/fun" /><Empty icon={<Clapperboard />} title="Show not found" /></>;
  const seatPrice = (row: string): Paise => Math.round(s.price * (SEAT_ROWS.find((g) => g.rows.includes(row))!.mult) / 100) * 100;
  const z = EVENT_ZONES.find((x) => x.id === zone)!;
  const unit = s.kind === 'movie' ? (seats.length ? Math.round(seats.reduce((a, x) => a + seatPrice(x[0]), 0) / seats.length) : s.price) : Math.round((s.price * z.mult) / 100) * 100;
  const count = s.kind === 'movie' ? seats.length : qty;
  const base = s.kind === 'movie' ? seats.reduce((a, x) => a + seatPrice(x[0]), 0) : unit * qty;
  const toggle = (k: string) => { setErr(null); setSeats((x) => x.includes(k) ? x.filter((y) => y !== k) : x.length >= 8 ? x : [...x, k]); };
  const book = () => {
    if (!count) { setErr('Pick at least one seat.'); return; }
    const start = new Date(`${dayDate(day)}T${time}:00`).getTime();
    if (start < Date.now()) { setErr('That showtime has already started. Pick a later one.'); return; }
    openPay({
      title: `${s.title} · ${dayLabel(day)} ${time} · ${s.kind === 'movie' ? 'Seats ' + seats.join(', ') : `${qty} × ${z.label}`}`,
      payee: { name: 'Zetheta Shows (demo)', color: `hsl(${s.hue} 60% 40%)`, sub: s.venue },
      category: 'entertainment', couponable: true,
      totals: (d) => ticketTotalsFromBase(base, count, d),
      commit: (st, x) => checkout(st, { key: x.key, category: 'entertainment', merchantId: 'm_shows', title: `${s.kind === 'movie' ? 'Movie' : 'Event'}: ${s.title}`, total: x.total, coupon: x.coupon,
        attach: (txn) => ({ bookings: [makeBooking(s.kind, txn, { title: s.title, subtitle: `${s.venue} · ${s.lang}`, when: `${dayLabel(day)} · ${time}`, start,
          details: { Venue: s.venue, City: 'Mumbai', Show: `${new Date(start).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`, Duration: `${s.mins} min`, Rating: s.rating, ...(s.kind === 'movie' ? { Seats: seats.join(', ') } : { Zone: z.label, Tickets: String(qty) }), Entry: 'Show the QR at the gate. It works once.' },
          passengers: Array.from({ length: count }, (_, i) => ({ name: i === 0 ? 'Ramesh Kumar' : `Guest ${i + 1}`, age: 0, seat: s.kind === 'movie' ? seats[i] : z.label })) })] }) }),
      success: { label: 'View QR ticket', to: () => '/bookings?new=1' },
    });
  };
  return (
    <>
      <PageHeader title={s.title} eyebrow={s.kind === 'movie' ? 'Movie · demo listing' : 'Event · demo listing'} backTo="/fun" />
      <div className="grid two">
        <div className="poster" style={{ background: art(s), aspectRatio: '16/10' }}>
          <span className="small">{s.genre} · {s.lang} · {s.rating}</span>
          <b className="h1">{s.title}</b>
        </div>
        <div className="stack">
          <p style={{ margin: 0 }}>{s.blurb}</p>
          <div className="row small muted"><span><MapPin size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> {s.venue}</span><span><Clock size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> {s.mins} min</span>{s.accessible && <span className="badge ok"><Accessibility aria-hidden="true" />Wheelchair access</span>}</div>
          <div className="field"><span className="lbl">Date</span><div className="chips" role="group" aria-label="Date">{s.dates.map((d) => <button key={d} type="button" className="chip" aria-pressed={day === d} onClick={() => { setDay(d); setSeats([]); }}>{dayLabel(d)}</button>)}</div></div>
          <div className="field"><span className="lbl">Time</span><div className="chips" role="group" aria-label="Showtime">{s.times.map((t) => <button key={t} type="button" className="chip" aria-pressed={time === t} onClick={() => { setTime(t); setSeats([]); }}>{t}</button>)}</div></div>
        </div>
      </div>
      {s.kind === 'movie' ? (
        <section className="card stack" aria-labelledby="seats-h">
          <h2 id="seats-h" className="h2">Choose seats (up to 8)</h2>
          <div className="screenbar" aria-hidden="true" /><div className="xs muted" style={{ textAlign: 'center', marginTop: -10 }}>Screen this way</div>
          <div className="seatmap" role="group" aria-label="Cinema seats">
            {SEAT_ROWS.map((g) => (
              <div key={g.label} className="stack sm" style={{ alignItems: 'center' }}>
                <span className="xs muted">{g.label} · {formatINR(seatPrice(g.rows[0]))}</span>
                {g.rows.map((r) => (
                  <div key={r} className="seatrow">
                    <span className="rl" aria-hidden="true">{r}</span>
                    {Array.from({ length: 12 }, (_, i) => { const k = r + (i + 1), isB = booked.has(k); return <button key={k} type="button" className={`seat ${i === 6 ? 'gap' : ''}`} disabled={isB} aria-pressed={seats.includes(k)} aria-label={`Row ${r} seat ${i + 1}, ${g.label}, ${formatINR(seatPrice(r))}${isB ? ', booked' : ''}`} onClick={() => toggle(k)}>{i + 1}</button>; })}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="legend" aria-hidden="true"><span><i />Free</span><span><i style={{ background: 'var(--ok)', borderColor: 'var(--ok)' }} />Selected</span><span><i style={{ background: '#262B4A', borderColor: 'transparent' }} />Booked</span></div>
          <p aria-live="polite" className="small" style={{ textAlign: 'center', margin: 0 }}>{seats.length ? `Selected ${seats.join(', ')} · ${formatINR(base)}` : 'No seats selected yet'}</p>
        </section>
      ) : (
        <section className="card stack" aria-labelledby="zone-h">
          <h2 id="zone-h" className="h2">Tickets</h2>
          <div className="stack sm" role="radiogroup" aria-label="Zone">
            {EVENT_ZONES.map((x) => <button key={x.id} type="button" role="radio" aria-checked={zone === x.id} className="card click row between" style={zone === x.id ? { borderColor: 'var(--accent)' } : undefined} onClick={() => setZone(x.id)}><b>{x.label}</b><span className="num">{formatINR(Math.round((s.price * x.mult) / 100) * 100)}</span></button>)}
          </div>
          <div className="row"><span className="lbl">Quantity</span><Stepper label="Tickets" value={qty} min={1} max={8} onChange={setQty} /></div>
        </section>
      )}
      {err && <Alert kind="err" title="Can’t continue">{err}</Alert>}
      <div className="cartbar" role="region" aria-label="Booking summary"><span className="grow">{count ? `${count} ticket${count > 1 ? 's' : ''} · ${formatINR(base)} + fees` : 'Select tickets'}</span><Btn onClick={book} disabled={!count}>Continue</Btn></div>
      <p className="small muted" style={{ margin: 0 }}>Convenience fee: 6% of the ticket price plus 18% GST on the fee. You see the full breakdown before paying.</p>
    </>
  );
}
