import { useState } from 'react';
import type { Booking, BookingKind, Txn } from '../lib/types';
import { bookingRef, code, pnr, rid } from '../lib/ids';
import { Field } from '../components/ui';

export function makeBooking(kind: BookingKind, txn: Txn, b: { title: string; subtitle: string; when: string; start: number; details: Record<string, string>; passengers?: Booking['passengers'] }): Booking {
  return {
    id: rid('b_', 12), kind, ref: kind === 'train' ? pnr() : bookingRef(kind), title: b.title, subtitle: b.subtitle, when: b.when, ts: txn.ts,
    amount: txn.amount, txnId: txn.id, status: 'confirmed', details: { ...b.details, start: String(b.start) }, passengers: b.passengers, ticketCode: code(8),
  };
}

export interface Pax { name: string; age: string }
export const validPax = (p: Pax[]) => p.every((x) => x.name.trim().length >= 2 && /^\d{1,3}$/.test(x.age) && +x.age >= 1 && +x.age <= 110);

export function PassengerForm({ pax, setPax, labels, showErrors }: { pax: Pax[]; setPax: (p: Pax[]) => void; labels?: string[]; showErrors: boolean }) {
  return (
    <div className="stack">
      {pax.map((p, i) => (
        <fieldset key={i} className="card" style={{ border: '1px solid var(--line)', margin: 0 }}>
          <legend className="h3" style={{ padding: '0 6px' }}>{labels?.[i] ?? `Passenger ${i + 1}`}</legend>
          <div className="formgrid">
            <Field label="Full name (as on ID)" error={showErrors && p.name.trim().length < 2 ? 'Enter the passenger’s name.' : null}>
              {(id, d) => <input id={id} aria-describedby={d} className="input" value={p.name} autoComplete="name" onChange={(e) => setPax(pax.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />}
            </Field>
            <Field label="Age" error={showErrors && !(/^\d{1,3}$/.test(p.age) && +p.age >= 1 && +p.age <= 110) ? 'Enter an age from 1 to 110.' : null}>
              {(id, d) => <input id={id} aria-describedby={d} className="input num" inputMode="numeric" maxLength={3} value={p.age} onChange={(e) => setPax(pax.map((x, j) => j === i ? { ...x, age: e.target.value.replace(/\D/g, '') } : x))} />}
            </Field>
          </div>
        </fieldset>
      ))}
    </div>
  );
}
export function usePax(n: number) {
  const [pax, setPax] = useState<Pax[]>(() => Array.from({ length: n }, (_, i) => (i === 0 ? { name: 'Ramesh Kumar', age: '68' } : { name: '', age: '' })));
  const resize = (m: number) => setPax((p) => Array.from({ length: m }, (_, i) => p[i] ?? { name: '', age: '' }));
  return { pax, setPax, resize };
}
export const startTs = (date: string, hhmm = '09:00') => new Date(`${date}T${hhmm.slice(0, 5)}:00`).getTime();
export const prettyDate = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
