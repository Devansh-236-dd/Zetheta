import { useMemo, useRef, useState } from 'react';
import { Copy, Download, Plus, Send, Users } from 'lucide-react';
import { store, useStore } from '../store';
import { createRequest, DomainError, payRequest } from '../lib/ledger';
import { encodePay } from '../lib/qr';
import { qrDataUrl } from '../lib/qrimage';
import { dataUrlToBlob, saveFile } from '../lib/download';
import { formatINR, parseAmount } from '../lib/money';
import { rid } from '../lib/ids';
import { Alert, AmountWords, Btn, DemoNote, Field, PageHeader, QrImg, StatusBadge, announce, toast } from '../components/ui';
import { fmtDate } from './common';

export function Receive() {
  const st = useStore((s) => s);
  const me = st.users.find((u) => u.id === st.me)!;
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = st.requests.find((r) => r.id === activeId) ?? null;
  const staticPayload = useMemo(() => encodePay({ type: 'pay', to: me.upi, name: me.name }), [me]);
  const reqPayload = active ? encodePay({ type: 'request', to: me.upi, name: me.name, amt: active.amount ?? undefined, ref: active.ref }) : '';

  const copy = async () => {
    try { await navigator.clipboard.writeText(me.upi); toast('Zetheta ID copied'); }
    catch { const el = document.getElementById('my-id') as HTMLInputElement | null; el?.select(); toast('Press Ctrl+C to copy the selected ID', 'info'); }
  };
  const download = async (payload: string, name: string) => {
    const url = await qrDataUrl(payload, 720);
    const r = await saveFile(name, await dataUrlToBlob(url), 'image/png');
    toast(r === 'saved' ? 'QR code saved' : r === 'declined' ? 'Download cancelled' : 'Couldn’t save the file here', r === 'saved' ? 'ok' : 'info');
  };
  const create = () => {
    const p = amt ? parseAmount(amt) : null;
    if (amt && !p) { setErr('Enter a valid amount, like 250 or 99.50.'); return; }
    try {
      const r = createRequest(store.get(), p, note.trim() || undefined);
      store.set(r.state); setActiveId(r.request.id); setErr(null);
      announce(`Payment request ${r.request.ref} created${p ? ' for ' + formatINR(p) : ''}.`);
      toast('Request created — share the QR or simulate a payer');
    } catch (e) { setErr(e instanceof DomainError ? e.message : 'Couldn’t create the request.'); }
  };

  return (
    <>
      <PageHeader title="Receive money" sub="Show your QR code, share your ID, or create a request for a set amount." backTo="/" />
      <div className="grid two">
        <section className="card stack" aria-labelledby="myqr-h">
          <h2 id="myqr-h" className="h2">Your payment QR</h2>
          <QrImg text={staticPayload} alt={`Payment QR code for ${me.name}, ID ${me.upi}`} />
          <div className="field">
            <label htmlFor="my-id">Your Zetheta ID</label>
            <div className="row nowrap"><input id="my-id" className="input mono" readOnly value={me.upi} onFocus={(e) => e.currentTarget.select()} /><Btn variant="ghost" icon={<Copy />} onClick={copy}>Copy</Btn></div>
          </div>
          <Btn variant="quiet" icon={<Download />} onClick={() => download(staticPayload, 'zetheta-my-qr.png')}>Download QR (PNG)</Btn>
          <DemoNote>This QR encodes a structured Zetheta demo payload (schema v1, your ID, INR, “DEMO-ONLY”). Any device running this demo can scan it on the Scan & Pay page.</DemoNote>
        </section>

        <section className="card stack" aria-labelledby="req-h">
          <h2 id="req-h" className="h2">Request a payment</h2>
          <Field label="Amount (optional)" hint="Leave empty to let the payer choose" error={err}>
            {(id, d) => <input id={id} aria-describedby={d} className="input num" inputMode="decimal" value={amt} placeholder="e.g. 450" onChange={(e) => { setAmt(e.target.value.replace(/[^\d.]/g, '')); setErr(null); }} />}
          </Field>
          {amt && parseAmount(amt) ? <AmountWords p={parseAmount(amt)!} /> : null}
          <Field label="What’s it for? (optional)">
            {(id) => <input id={id} className="input" maxLength={40} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lunch split" />}
          </Field>
          <Btn icon={<Plus />} onClick={create}>Create request</Btn>
          {active && <RequestCard key={active.id} reqId={active.id} payload={reqPayload} onDownload={() => download(reqPayload, `zetheta-request-${active.ref}.png`)} />}
        </section>
      </div>

      <section className="card" aria-labelledby="open-h">
        <h2 id="open-h" className="h2" style={{ marginBottom: 8 }}>Your requests</h2>
        {st.requests.length === 0 ? <p className="muted">No requests yet. Create one above.</p> : (
          <div className="list">
            {st.requests.map((r) => (
              <button key={r.id} type="button" className="li" onClick={() => setActiveId(r.id)}>
                <span className="t"><b>{r.amount ? formatINR(r.amount) : 'Any amount'} · <span className="mono">{r.ref}</span></b><small>{r.note ? r.note + ' · ' : ''}{fmtDate(r.ts)}{r.paidBy ? ' · paid by ' + st.users.find((u) => u.id === r.paidBy)?.name : ''}</small></span>
                <StatusBadge status={r.status} />
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function RequestCard({ reqId, payload, onDownload }: { reqId: string; payload: string; onDownload: () => void }) {
  const st = useStore((s) => s);
  const req = st.requests.find((r) => r.id === reqId)!;
  const payers = st.users.filter((u) => u.id !== st.me && !u.isNew);
  const [payer, setPayer] = useState(payers[0].id);
  const [amt, setAmt] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const keyRef = useRef(rid('req_'));
  const simulate = () => {
    const p = req.amount ? null : parseAmount(amt);
    if (!req.amount && !p) { setMsg({ kind: 'err', text: 'Enter how much they pay.' }); return; }
    try {
      const r = payRequest(store.get(), req.id, payer, p, keyRef.current);
      store.set(r.state);
      keyRef.current = rid('req_');
      if (r.txn.status === 'success') { setMsg({ kind: 'ok', text: `${formatINR(r.txn.amount)} received from ${r.txn.counterparty}. Your balance and history are updated. Ref ${r.txn.ref}.` }); announce('Money received.'); }
      else setMsg({ kind: 'err', text: r.txn.failureReason ?? 'Payment failed.' });
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  };
  return (
    <div className="card stack" style={{ background: 'var(--card2)' }}>
      <div className="row between"><b>Request <span className="mono">{req.ref}</span></b><StatusBadge status={req.status} /></div>
      <QrImg text={payload} alt={`Payment request QR, reference ${req.ref}${req.amount ? ', ' + formatINR(req.amount) : ''}`} />
      <Btn variant="quiet" size="sm" icon={<Download />} onClick={onDownload}>Download request QR</Btn>
      {req.status === 'open' ? (
        <div className="stack sm">
          <div className="row nowrap"><Users aria-hidden="true" /><b>Simulate another demo user paying</b></div>
          <div className="field"><label htmlFor="payer">Who pays</label>
            <select id="payer" className="select" value={payer} onChange={(e) => setPayer(e.target.value)}>{payers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.upi})</option>)}</select></div>
          {!req.amount && <Field label="Amount they pay">{(id) => <input id={id} className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} />}</Field>}
          <Btn icon={<Send />} onClick={simulate}>Simulate payment</Btn>
        </div>
      ) : null}
      {msg && <Alert kind={msg.kind} title={msg.kind === 'ok' ? 'Payment received' : 'Couldn’t complete'}>{msg.text}</Alert>}
    </div>
  );
}
