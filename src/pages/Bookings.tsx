import { Fragment, useMemo, useState } from 'react';
import { BadgeCheck, Bus, Camera, Car, Clapperboard, CalendarHeart, Hotel, ImageUp, Plane, ScanLine, Ticket, Train, TrainFront, ParkingCircle, XCircle } from 'lucide-react';
import { store, useStore } from '../store';
import { navigate } from '../router';
import { refund, DomainError } from '../lib/ledger';
import type { Booking } from '../lib/types';
import { encodeTicket, parseQr } from '../lib/qr';
import { decodeFromFile, decodeFromUrl, qrDataUrl } from '../lib/qrimage';
import { formatINR, bps } from '../lib/money';
import { refundFor } from '../lib/pricing';
import { Alert, Btn, Dialog, DemoNote, Empty, Field, Money, PageHeader, QrImg, Seg, StatusBadge, announce, toast } from '../components/ui';
import { fmtDate, useQuery } from './common';

export const KIND_ICON: Record<string, JSX.Element> = { train: <Train />, flight: <Plane />, bus: <Bus />, hotel: <Hotel />, movie: <Clapperboard />, event: <CalendarHeart />, metro: <TrainFront />, buspass: <Bus />, parking: <ParkingCircle />, taxi: <Car /> };
const KIND_LABEL: Record<string, string> = { train: 'Train', flight: 'Flight', bus: 'Bus', hotel: 'Hotel', movie: 'Movie', event: 'Event', metro: 'Metro pass', buspass: 'Bus pass', parking: 'Parking', taxi: 'Ride' };

export function Bookings() {
  const st = useStore((s) => s);
  const q = useQuery();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const now = Date.now();
  const list = useMemo(() => st.bookings.filter((b) => {
    const start = Number(b.details.start ?? b.ts);
    if (tab === 'cancelled') return b.status === 'cancelled';
    if (b.status === 'cancelled') return false;
    return tab === 'upcoming' ? start >= now - 6 * 3600000 && !b.redeemedAt : start < now - 6 * 3600000 || !!b.redeemedAt;
  }), [st.bookings, tab]);
  return (
    <>
      <PageHeader title="My bookings" sub="Tickets, stays, passes and rides — all in one place." actions={<Btn variant="ghost" size="sm" icon={<ScanLine />} onClick={() => navigate('/validate')}>Validate a ticket</Btn>} />
      {q.get('new') && st.bookings[0] && <Alert kind="ok" title="Booking confirmed" actions={<Btn size="sm" onClick={() => navigate('/booking/' + st.bookings[0].id)}>Open {KIND_LABEL[st.bookings[0].kind].toLowerCase()} ticket</Btn>}>{st.bookings[0].title} · {st.bookings[0].ref}</Alert>}
      <div className="grid sm">
        {[['Travel', '/travel', <Plane key="p" />], ['Movies & events', '/fun', <Clapperboard key="c" />], ['Food orders', '/orders', <Ticket key="t" />], ['Local transport', '/transport', <Bus key="b" />]].map(([l, p, i]) => (
          <button key={l as string} type="button" className="card click row nowrap" onClick={() => navigate(p as string)}><span className="ticon">{i}</span><b>{l}</b></button>
        ))}
      </div>
      <Seg label="Show bookings" value={tab} onChange={setTab} options={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past & used' }, { id: 'cancelled', label: 'Cancelled' }]} />
      {list.length === 0 ? <Empty icon={<Ticket />} title={tab === 'upcoming' ? 'No upcoming bookings' : tab === 'past' ? 'Nothing here yet' : 'No cancelled bookings'} action={tab === 'upcoming' ? <Btn onClick={() => navigate('/travel')}>Plan a trip</Btn> : undefined}>Bookings you make with the demo wallet show up here.</Empty> : (
        <div className="stack">
          {list.map((b) => (
            <button key={b.id} type="button" className="card click row nowrap" onClick={() => navigate('/booking/' + b.id)} aria-label={`${KIND_LABEL[b.kind]}: ${b.title}, ${b.when}, ${b.status}`}>
              <span className="ticon" style={{ width: 52, height: 52 }}>{KIND_ICON[b.kind]}</span>
              <span className="grow min0"><b className="h3">{b.title}</b><span className="small muted" style={{ display: 'block' }}>{b.subtitle}</span><span className="small" style={{ display: 'block' }}>{b.when}</span></span>
              <span className="stack sm" style={{ alignItems: 'flex-end' }}><StatusBadge status={b.redeemedAt ? 'completed' : b.status} /><span className="mono xs muted">{b.ref}</span></span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function refundQuote(b: Booking): { amount: number; rule: string; allowed: boolean } {
  if (b.status !== 'confirmed') return { amount: 0, rule: 'Already cancelled', allowed: false };
  if (b.redeemedAt) return { amount: 0, rule: 'Ticket already used', allowed: false };
  const hours = (Number(b.details.start ?? b.ts) - Date.now()) / 3600000;
  if (b.kind === 'hotel' && b.details.Cancellation?.startsWith('Non')) return { amount: 0, rule: 'Non-refundable room', allowed: true };
  if (b.kind === 'metro' || b.kind === 'buspass') { const fresh = Date.now() - b.ts < 86400000; return { amount: fresh ? b.amount : 0, rule: fresh ? 'Full refund within 24 hours of purchase if unused' : 'Passes can’t be refunded after 24 hours', allowed: true }; }
  if (b.kind === 'taxi') return hours > -0.2 ? { amount: b.amount, rule: 'Full refund — ride not started (demo)', allowed: true } : { amount: 0, rule: 'Ride already completed', allowed: false };
  if (b.kind === 'parking') return hours > 0 ? { amount: bps(b.amount, 10000), rule: 'Full refund before your slot starts', allowed: true } : { amount: 0, rule: 'Parking already started', allowed: false };
  const r = refundFor(b.amount, hours);
  return { ...r, allowed: hours > 0 };
}

export function BookingDetail({ id }: { id: string }) {
  const st = useStore((s) => s);
  const b = st.bookings.find((x) => x.id === id);
  const [confirm, setConfirm] = useState(false);
  if (!b) return <><PageHeader title="Booking" backTo="/bookings" /><Empty icon={<Ticket />} title="Booking not found" /></>;
  const q = refundQuote(b);
  const doCancel = () => {
    try {
      let s = store.get();
      if (q.amount > 0) s = refund(s, b.txnId, q.amount, `Cancelled ${KIND_LABEL[b.kind].toLowerCase()} ${b.ref}`).state;
      s = { ...s, bookings: s.bookings.map((x) => x.id === b.id ? { ...x, status: 'cancelled' as const, refundAmount: q.amount } : x) };
      store.set(s);
      setConfirm(false);
      const msg = q.amount > 0 ? `Booking cancelled. ${formatINR(q.amount)} refunded to your wallet.` : 'Booking cancelled. No refund under the policy.';
      toast(msg); announce(msg);
    } catch (e) { toast(e instanceof DomainError ? e.message : 'Couldn’t cancel', 'err'); }
  };
  return (
    <>
      <PageHeader title={b.title} eyebrow={`${KIND_LABEL[b.kind]} · demo booking`} sub={b.subtitle} backTo="/bookings" />
      <div className="stack lg" style={{ maxWidth: 760 }}>
        <div className={`ticket ${b.redeemedAt ? 'redeemed' : ''}`}>
          <div className="stack sm min0">
            <div className="row"><StatusBadge status={b.redeemedAt ? 'completed' : b.status} />{b.redeemedAt && <span className="stamp"><BadgeCheck size={16} aria-hidden="true" />Used {fmtDate(b.redeemedAt)}</span>}</div>
            <b className="h2">{b.when}</b>
            <div className="small muted">Booking ref <span className="mono" style={{ color: 'var(--ink)' }}>{b.ref}</span></div>
            {b.ticketCode && <div className="small muted">Ticket code <span className="mono" style={{ color: 'var(--ink)' }}>{b.ticketCode}</span></div>}
            <div className="small muted">Paid <Money p={b.amount} />{b.refundAmount ? <> · refunded <Money p={b.refundAmount} /></> : null}</div>
          </div>
          {b.ticketCode && b.status === 'confirmed' && <QrImg className="qr" text={encodeTicket(b.id, b.ticketCode)} alt={`Ticket QR code for ${b.title}, code ${b.ticketCode}`} size={300} />}
        </div>
        <dl className="kv card">{Object.entries(b.details).filter(([k]) => k !== 'start').map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
        {b.passengers && b.passengers.length > 0 && (
          <section className="card" aria-labelledby="bp-h"><h2 id="bp-h" className="h3" style={{ marginBottom: 6 }}>Passengers</h2>
            <div className="list">{b.passengers.map((p, i) => <div key={i} className="li"><span className="t"><b>{p.name}</b><small>Age {p.age}</small></span>{p.seat && <span className="badge info">Seat {p.seat}</span>}</div>)}</div></section>
        )}
        <div className="row">
          <Btn variant="ghost" onClick={() => navigate('/txn/' + b.txnId)}>View payment receipt</Btn>
          {b.status === 'confirmed' && q.allowed && <Btn variant="danger" icon={<XCircle />} onClick={() => setConfirm(true)}>Cancel booking</Btn>}
          {b.status === 'confirmed' && b.ticketCode && <Btn variant="quiet" icon={<ScanLine />} onClick={() => navigate('/validate?b=' + b.id)}>Validate at venue (demo)</Btn>}
        </div>
        {b.status === 'confirmed' && !q.allowed && <p className="small muted" style={{ margin: 0 }}>Cancellation not available: {q.rule}.</p>}
        <DemoNote>Demo cancellation policy: 90% refund 48+ hours before start, 50% between 4 and 48 hours, none within 4 hours. Refunds go back to the Zetheta wallet as a ledger entry.</DemoNote>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Cancel this booking?">
        <p style={{ margin: 0 }}>{b.title} · {b.when}</p>
        <dl className="kv card"><dt>You paid</dt><dd><Money p={b.amount} /></dd><dt>Refund</dt><dd style={{ color: q.amount ? 'var(--ok)' : 'var(--err)' }}><Money p={q.amount} /></dd><dt>Rule</dt><dd>{q.rule}</dd></dl>
        <Btn variant="danger" size="lg" block data-autofocus onClick={doCancel}>Yes, cancel{q.amount ? ` and refund ${formatINR(q.amount)}` : ''}</Btn>
        <Btn variant="quiet" block onClick={() => setConfirm(false)}>Keep booking</Btn>
      </Dialog>
    </>
  );
}

export function ValidateTicket() {
  const st = useStore((s) => s);
  const q = useQuery();
  const directory = useMemo(() => [...st.users, ...st.merchants].map((x) => ({ id: x.id, upi: x.upi, name: x.name })), [st.users, st.merchants]);
  const [code, setCode] = useState('');
  const [res, setRes] = useState<{ kind: 'ok' | 'used' | 'bad'; b?: Booking; msg: string } | null>(null);
  const tickets = st.bookings.filter((b) => b.ticketCode && b.status === 'confirmed');
  const check = (text: string | null) => {
    if (!text) { setRes({ kind: 'bad', msg: 'No QR code found in that image.' }); return; }
    let b: Booking | undefined;
    if (/^[A-Z0-9]{8}$/.test(text.trim().toUpperCase())) b = st.bookings.find((x) => x.ticketCode === text.trim().toUpperCase());
    else {
      const r = parseQr(text, directory);
      if (!r.ok) { setRes({ kind: 'bad', msg: r.message }); announce('Rejected. ' + r.message); return; }
      if (r.kind !== 'ticket') { setRes({ kind: 'bad', msg: 'That is a payment QR, not a ticket.' }); return; }
      b = st.bookings.find((x) => x.id === r.data.id && x.ticketCode === r.data.code);
    }
    if (!b) { setRes({ kind: 'bad', msg: 'No booking matches this ticket. It may be fake or from another account.' }); announce('Rejected. Unknown ticket.'); return; }
    if (b.status === 'cancelled') { setRes({ kind: 'bad', b, msg: 'This booking was cancelled. Do not admit.' }); announce('Rejected. Cancelled ticket.'); return; }
    if (b.redeemedAt) { setRes({ kind: 'used', b, msg: `Already used at ${fmtDate(b.redeemedAt)}. Do not admit again.` }); announce('Warning. Ticket already used.'); return; }
    setRes({ kind: 'ok', b, msg: 'Valid ticket. Not used yet.' }); announce('Valid ticket.');
  };
  const admit = () => {
    if (!res?.b) return;
    const id = res.b.id;
    store.update((s) => ({ ...s, bookings: s.bookings.map((x) => x.id === id && !x.redeemedAt ? { ...x, redeemedAt: Date.now() } : x) }));
    setRes({ kind: 'used', b: { ...res.b, redeemedAt: Date.now() }, msg: 'Admitted. This ticket is now marked as used and can’t be used again.' });
    toast('Admitted · ticket marked as used'); announce('Admitted.');
  };
  const preset = q.get('b');
  return (
    <>
      <PageHeader title="Validate a ticket" sub="Venue staff screen (demo): scan a ticket QR to check it and admit once." backTo="/bookings" />
      <DemoNote>Ticket QR codes carry the booking ID, a ticket code and a checksum. The validator rejects edited codes, cancelled bookings and tickets that were already used.</DemoNote>
      <div className="grid two">
        <section className="card stack" aria-labelledby="vt-h">
          <h2 id="vt-h" className="h3">Scan one of your tickets</h2>
          {tickets.length === 0 ? <p className="muted">Book a movie, event or trip first — its ticket QR will appear here.</p> : tickets.slice(0, 6).map((b) => (
            <div key={b.id} className="row nowrap" style={preset === b.id ? { outline: '2px solid var(--accent)', borderRadius: 12, padding: 6 } : undefined}>
              <span className="ticon">{KIND_ICON[b.kind]}</span><span className="grow min0"><b>{b.title}</b><span className="xs muted" style={{ display: 'block' }}>{b.when} · {b.ticketCode}{b.redeemedAt ? ' · used' : ''}</span></span>
              <Btn size="sm" icon={<ScanLine />} onClick={async () => { const url = await qrDataUrl(encodeTicket(b.id, b.ticketCode!), 300); check(await decodeFromUrl(url)); }}>Scan</Btn>
            </div>
          ))}
        </section>
        <section className="card stack" aria-labelledby="vt2-h">
          <h2 id="vt2-h" className="h3">Other ways to check</h2>
          <label className="btn btn-quiet" style={{ width: 'max-content' }}><ImageUp aria-hidden="true" />Upload ticket image<input type="file" accept="image/*" className="vh" onChange={async (e) => { const f = e.target.files?.[0]; if (f) check(await decodeFromFile(f)); e.target.value = ''; }} /></label>
          <Field label="Or type the 8-character ticket code">{(id) => <div className="row nowrap"><input id={id} className="input mono" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /><Btn variant="ghost" onClick={() => check(code)}>Check</Btn></div>}</Field>
          <Btn variant="quiet" icon={<Camera />} onClick={() => navigate('/scan')}>Use camera on Scan & Pay</Btn>
        </section>
      </div>
      {res && (
        <div aria-live="assertive">
          {res.kind === 'ok' && <Alert kind="ok" title="Valid ticket" actions={<Btn onClick={admit} icon={<BadgeCheck />}>Admit & mark as used</Btn>}>{res.b!.title} · {res.b!.when} · {res.b!.passengers?.length ?? 1} guest(s). {res.msg}</Alert>}
          {res.kind === 'used' && <Alert kind="warn" title="Already used">{res.b?.title}. {res.msg}</Alert>}
          {res.kind === 'bad' && <Alert kind="err" title="Do not admit">{res.msg}</Alert>}
        </div>
      )}
    </>
  );
}
