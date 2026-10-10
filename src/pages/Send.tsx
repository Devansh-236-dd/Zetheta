import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Lock, Plus, Search, Star, UserPlus, X } from 'lucide-react';
import { store, useStore } from '../store';
import { navigate } from '../router';
import { DomainError, PER_TXN_LIMIT, myBalance, transfer } from '../lib/ledger';
import type { User } from '../lib/types';
import { formatINR, parseAmount, rs, type Paise } from '../lib/money';
import { rid } from '../lib/ids';
import { usePay } from '../components/PaySheet';
import { PinEntry } from '../components/PinEntry';
import { Alert, AmountWords, Avatar, Btn, Field, Keypad, Money, PageHeader, Tick, announce, toast } from '../components/ui';
import { useQuery } from './common';

type Step = 'choose' | 'amount' | 'review' | 'pin' | 'processing' | 'done' | 'failed';

export function Send() {
  const q = useQuery();
  const st = useStore((s) => s);
  const bal = myBalance(st);
  const [step, setStep] = useState<Step>('choose');
  const [payee, setPayee] = useState<User | null>(null);
  const [amt, setAmt] = useState(''); // rupees as typed, may include "."
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<null | { title: string; body: string; fix: Paise }>(null);
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; ref?: string; id?: string; msg?: string } | null>(null);
  const [pop, setPop] = useState(false);
  const keyRef = useRef(rid('send_', 14));
  const busy = useRef(false);
  const { openAddMoney } = usePay();

  useEffect(() => {
    const to = q.get('to'); const a = q.get('amt');
    if (to) { const u = st.users.find((x) => x.id === to); if (u) { setPayee(u); setStep('amount'); } }
    if (a && /^\d{1,7}$/.test(a)) setAmt(a);
  }, []);

  const paise = parseAmount(amt || '0') ?? 0;
  const history = useMemo(() => payee ? st.txns.filter((t) => t.type === 'transfer_out' && t.to === payee.id && t.status === 'success') : [], [payee, st.txns]);
  const typical = useMemo(() => { if (!history.length) return null; const xs = history.map((t) => t.amount).sort((a, b) => a - b); return xs[Math.floor(xs.length / 2)]; }, [history]);

  const onKey = (k: string) => {
    setErr(null); setWarn(null); setAck(false);
    setAmt((a) => {
      let n = a;
      if (k === 'del') n = a.slice(0, -1);
      else if (k === 'clear') n = '';
      else if (k === '.') n = a.includes('.') ? a : (a || '0') + '.';
      else if (/\d/.test(k)) {
        if (a === '' && k === '0') return a;
        if (a.includes('.') && a.split('.')[1].length >= 2) return a;
        if (a.replace('.', '').length >= 8) { toast('That’s the largest amount you can type', 'info'); return a; }
        n = a + k;
      }
      const p = parseAmount(n || '0') ?? 0;
      announce(p ? formatINR(p) : 'Amount empty');
      return n;
    });
    setPop(true); setTimeout(() => setPop(false), 300);
  };

  const toReview = () => {
    if (!paise) { setErr('Enter an amount greater than zero.'); return; }
    if (paise > PER_TXN_LIMIT) { setErr(`You can send up to ${formatINR(PER_TXN_LIMIT)} in one payment.`); return; }
    if (paise > bal) { setErr(`Not enough balance. You have ${formatINR(bal)}. Add demo money or send less.`); return; }
    if (!ack && payee) {
      if (typical && paise > rs(2000) && paise >= typical * 5) {
        const last = history[0]?.amount ?? typical;
        const extra = paise === typical * 10 || paise === last * 10;
        setWarn(extra
          ? { title: 'Did you add an extra zero?', body: `${formatINR(paise)} is 10 times what you usually send ${payee.first} (${formatINR(typical)}).`, fix: paise / 10 }
          : { title: 'This is much more than usual', body: `You usually send ${payee.first} about ${formatINR(typical)}. ${formatINR(paise)} is ${Math.round(paise / typical)} times more.`, fix: typical });
        announce('Warning. Check this amount.');
        return;
      }
      if (payee.isNew && paise > rs(5000)) {
        setWarn({ title: 'Large first payment', body: `You haven’t paid ${payee.name} before. Many people send a small amount first to check it arrives.`, fix: rs(2000) });
        return;
      }
    }
    setStep('review');
  };

  const pay = () => {
    if (busy.current || !payee) return;
    busy.current = true;
    setStep('processing');
    announce(`Sending ${formatINR(paise)} to ${payee.name}. Please wait.`);
    setTimeout(() => {
      try {
        const r = transfer(store.get(), payee.id, paise, keyRef.current, note.trim() || undefined);
        store.set(r.state);
        if (r.txn.status === 'success') { setResult({ ok: true, ref: r.txn.ref, id: r.txn.id }); setStep('done'); announce(`Payment successful. ${formatINR(paise)} sent to ${payee.name}.`); }
        else { setResult({ ok: false, msg: r.txn.failureReason, id: r.txn.id, ref: r.txn.ref }); setStep('failed'); announce('Payment failed. ' + r.txn.failureReason); }
      } catch (e) {
        const msg = e instanceof DomainError ? e.message : 'Something went wrong. No money was sent.';
        setResult({ ok: false, msg }); setStep('failed'); announce('Payment failed. ' + msg);
      }
    }, 1400);
  };
  const restart = (keepPayee = false) => { keyRef.current = rid('send_', 14); busy.current = false; setResult(null); setAmt(''); setNote(''); setWarn(null); setAck(false); setErr(null); if (!keepPayee) setPayee(null); setStep(keepPayee ? 'amount' : 'choose'); };
  const cancel = () => { toast('Payment cancelled. Nothing was sent.', 'info'); restart(); navigate('/'); };

  if (step === 'choose') return <ChooseRecipient onPick={(u) => { setPayee(u); setStep('amount'); }} />;
  if (!payee) return null;
  const lookalike = payee.lookalikeOf ? st.users.find((u) => u.id === payee.lookalikeOf) : undefined;

  return (
    <>
      <PageHeader title={step === 'amount' ? 'Enter amount' : step === 'review' ? 'Check details' : step === 'pin' ? 'Confirm with PIN' : step === 'processing' ? 'Sending money' : step === 'done' ? 'Payment successful' : 'Payment failed'} onBack={step === 'amount' ? () => restart() : step === 'review' ? () => setStep('amount') : step === 'pin' ? () => setStep('review') : undefined}
        actions={['amount', 'review', 'pin'].includes(step) ? <Btn variant="quiet" size="sm" icon={<X />} onClick={cancel}>Cancel</Btn> : undefined} />
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto' }} className="stack lg">
        {step === 'amount' && (
          <>
            <div className="card row nowrap" style={{ padding: 14 }}>
              <Avatar name={payee.name} color={payee.color} verified={!payee.isNew} />
              <div className="grow"><div className="small muted">Paying</div><b>{payee.name}</b><div className="small muted mono">{payee.upi}</div></div>
              <button type="button" className="link" onClick={() => restart()}>Change</button>
            </div>
            {payee.isNew && <Alert kind="warn" title="New person · never paid">{lookalike ? <>Their name looks like <b>{lookalike.name}</b>, who you pay often. Check before you send.</> : 'Check their details before you send.'}</Alert>}
            <div className="stack sm" style={{ alignItems: 'center', textAlign: 'center' }} aria-live="polite">
              <div className="bigamt" style={{ transform: pop ? 'scale(1.04)' : undefined, transition: 'transform .15s', color: paise ? undefined : 'var(--dim)' }}><span className="cur">₹</span>{paise ? formatINR(paise, { plain: true }) : '0'}</div>
              {paise ? <AmountWords p={paise} /> : <span className="muted">Type the amount with the keys below</span>}
            </div>
            <Field label="Amount in rupees (keyboard)" hint={`Balance ${formatINR(bal)} · Limit ${formatINR(PER_TXN_LIMIT)} per payment`} error={err}>
              {(id, d) => <input id={id} aria-describedby={d} className="input num" inputMode="decimal" value={amt} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); if (v === '' || parseAmount(v) !== null) { setAmt(v); setErr(null); setWarn(null); setAck(false); } }} placeholder="0" />}
            </Field>
            {err?.startsWith('Not enough') && <Btn variant="warn" icon={<Plus />} onClick={() => openAddMoney(Math.ceil((paise - bal + rs(100)) / rs(100)) * rs(100))}>Add demo money</Btn>}
            {typical && !warn && <div className="chips" style={{ justifyContent: 'center' }}><button type="button" className="chip" onClick={() => { setAmt(String(typical / 100)); setErr(null); }}>{formatINR(typical)} · same as usual</button></div>}
            {warn && (
              <Alert kind="warn" title={warn.title} actions={<><Btn variant="ghost" onClick={() => { setAmt(String(warn.fix / 100)); setWarn(null); toast('Amount changed to ' + formatINR(warn.fix)); }}>Change to {formatINR(warn.fix)}</Btn><Btn variant="warn" onClick={() => { setAck(true); setWarn(null); setStep('review'); }}>Yes, send {formatINR(paise)}</Btn></>}>
                {warn.body}
              </Alert>
            )}
            <Keypad onKey={onKey} allowDot label="Amount number pad" />
            <Field label="Note (optional)" hint="Up to 50 characters, e.g. “Rent” or “Dinner split”">
              {(id, d) => <input id={id} aria-describedby={d} className="input" maxLength={50} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
            <Btn size="lg" block onClick={toReview}>Continue{paise ? ` with ${formatINR(paise)}` : ''}</Btn>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="stack sm">
              <span className="muted">You’re sending</span>
              <div className="bigamt"><span className="cur">₹</span>{formatINR(paise, { plain: true })}</div>
              <div><AmountWords p={paise} /></div>
              <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setStep('amount')}>Change amount</button>
            </div>
            <div className="card stack" aria-label={`To ${payee.name}. Name on bank account ${payee.bankName}. ID ${payee.upi}, ${payee.bank}. ${history.length ? `You’ve paid ${payee.first} ${history.length} times.` : 'You have never paid this person.'}`}>
              <span className="muted small">To</span>
              <div className="row nowrap"><Avatar name={payee.name} color={payee.color} size="lg" verified={!payee.isNew} /><div className="grow"><b className="h3">{payee.name}</b><div className="small muted">{payee.upi} · {payee.bank}</div></div></div>
              <ul className="steps" aria-hidden="true">
                <li className={payee.isNew ? '' : 'done'} style={payee.isNew ? { color: 'var(--warn)', fontWeight: 700 } : undefined}><span className="si" style={payee.isNew ? { background: 'var(--warn-solid)', borderColor: 'var(--warn-solid)', color: '#14171F' } : undefined}>{payee.isNew ? <AlertTriangle size={14} style={{ opacity: 1 }} /> : <Check />}</span>Name on bank account: {payee.bankName}</li>
                <li className={history.length ? 'done' : ''} style={!history.length ? { color: 'var(--warn)', fontWeight: 700 } : undefined}><span className="si" style={!history.length ? { background: 'var(--warn-solid)', borderColor: 'var(--warn-solid)', color: '#14171F' } : undefined}>{history.length ? <Check /> : <AlertTriangle size={14} style={{ opacity: 1 }} />}</span>{history.length ? `You’ve paid ${payee.first} ${history.length} times, last ${formatINR(history[0].amount)}` : 'You have never paid this person'}</li>
                <li className={ack ? '' : 'done'} style={ack ? { color: 'var(--warn)', fontWeight: 700 } : undefined}><span className="si" style={ack ? { background: 'var(--warn-solid)', borderColor: 'var(--warn-solid)', color: '#14171F' } : undefined}>{ack ? <AlertTriangle size={14} style={{ opacity: 1 }} /> : <Check />}</span>{ack ? 'Larger than usual — you confirmed it' : 'Amount looks normal'}</li>
              </ul>
            </div>
            {lookalike && (
              <Alert kind="warn" title="First payment to this person" actions={<Btn variant="ghost" onClick={() => { setPayee(lookalike); toast('Now paying ' + lookalike.name); }}>Pay {lookalike.name} instead</Btn>}>
                Did you mean <b>{lookalike.name}</b>? Only continue if you know {payee.name}.
              </Alert>
            )}
            <dl className="kv card">
              <dt>From</dt><dd>Zetheta Wallet (demo)</dd>
              {note && <><dt>Note</dt><dd>{note}</dd></>}
              <dt>Fee</dt><dd>No fee</dd>
              <dt>Balance after</dt><dd><Money p={bal - paise} /></dd>
            </dl>
            <Btn size="lg" block icon={<Lock />} onClick={() => setStep('pin')}>Pay {formatINR(paise)}</Btn>
            <p className="xs muted" style={{ textAlign: 'center', margin: 0 }}>You’ll enter your PIN next. Money isn’t sent until then. No swiping needed.</p>
          </>
        )}

        {step === 'pin' && (
          <>
            <div className="card row between"><span className="muted">{formatINR(paise)} to</span><b>{payee.name}</b></div>
            <PinEntry onSuccess={pay} />
          </>
        )}

        {step === 'processing' && (
          <div className="card stack lg" role="status" aria-live="polite">
            <ul className="steps"><li className="done"><span className="si"><Check /></span>PIN verified</li><li className="now"><span className="si"><Check /></span>Sending {formatINR(paise)} to {payee.name}</li><li><span className="si"><Check /></span>Updating your balance</li></ul>
            <p className="small muted" style={{ margin: 0 }}>Please keep the app open.</p>
          </div>
        )}

        {step === 'done' && result?.ok && (
          <div className="card stack lg" style={{ textAlign: 'center' }}>
            <Tick />
            <h2 className="h2" style={{ color: 'var(--ok)' }}>Payment successful</h2>
            <div className="bigamt"><span className="cur">₹</span>{formatINR(paise, { plain: true })}</div>
            <div><AmountWords p={paise} /></div>
            <p className="muted" style={{ margin: 0 }}>sent to <b style={{ color: 'var(--ink)' }}>{payee.name}</b> · Ref <span className="mono">{result.ref}</span></p>
            <p className="small muted" style={{ margin: 0 }}>New balance: <Money p={bal} /></p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Btn onClick={() => navigate('/txn/' + result.id)}>View receipt</Btn>
              <Btn variant="ghost" onClick={() => restart(true)}>Send again</Btn>
              <Btn variant="quiet" onClick={() => navigate('/')}>Done</Btn>
            </div>
          </div>
        )}

        {step === 'failed' && result && (
          <div className="card stack lg" style={{ textAlign: 'center' }}>
            <Tick err />
            <Alert kind="err" title="Payment didn’t go through">{result.msg} {result.ref && <>Reference <span className="mono">{result.ref}</span> is saved as failed.</>}</Alert>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Btn onClick={() => { keyRef.current = rid('send_', 14); busy.current = false; setStep('review'); }}>Try again</Btn>
              <Btn variant="quiet" onClick={() => navigate('/')}>Back to home</Btn>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ChooseRecipient({ onPick }: { onPick: (u: User) => void }) {
  const st = useStore((s) => s);
  const [q, setQ] = useState('');
  const others = st.users.filter((u) => u.id !== st.me);
  const paidCount = (id: string) => st.txns.filter((t) => t.to === id && t.type === 'transfer_out' && t.status === 'success').length;
  const lastPaid = (id: string) => st.txns.find((t) => t.to === id && t.type === 'transfer_out' && t.status === 'success');
  const recentIds = [...new Set(st.txns.filter((t) => t.type === 'transfer_out').map((t) => t.to))].slice(0, 4);
  const t = q.trim().toLowerCase();
  const list = t ? others.filter((u) => (u.name + ' ' + u.upi + ' ' + u.phone + ' ' + (u.tagline ?? '')).toLowerCase().includes(t)) : others.filter((u) => !u.isNew);
  const favs = st.favourites.map((id) => others.find((u) => u.id === id)).filter(Boolean) as User[];
  const toggleFav = (id: string) => store.update((s) => ({ ...s, favourites: s.favourites.includes(id) ? s.favourites.filter((x) => x !== id) : [...s.favourites, id] }));
  return (
    <>
      <PageHeader title="Send money" sub="Pick who to pay. Every row shows their ID and your past payments." backTo="/" />
      <div className="field">
        <label htmlFor="rq">Search by name, phone or Zetheta ID</label>
        <div style={{ position: 'relative' }}><Search aria-hidden="true" style={{ position: 'absolute', left: 14, top: 15, width: 20, height: 20, color: 'var(--muted)' }} />
          <input id="rq" className="input" style={{ paddingLeft: 44 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Rahul, 98xx, meera.nair@zetheta" autoComplete="off" aria-describedby="rq-count" /></div>
        <span id="rq-count" className="hint" aria-live="polite">{t ? `${list.length} ${list.length === 1 ? 'match' : 'matches'}` : `${others.length - 1} people in this demo`}</span>
      </div>
      {!t && favs.length > 0 && (
        <section className="stack sm" aria-labelledby="fav-h">
          <h2 id="fav-h" className="h3">Favourites</h2>
          <div className="row">{favs.map((u) => <button key={u.id} type="button" className="card click" style={{ width: 'auto', padding: 12, display: 'flex', gap: 10, alignItems: 'center' }} onClick={() => onPick(u)}><Avatar name={u.name} color={u.color} size="sm" verified /><b>{u.first}</b></button>)}</div>
        </section>
      )}
      <section className="card" aria-labelledby="ppl-h">
        <h2 id="ppl-h" className="h3" style={{ marginBottom: 6 }}>{t ? 'Results' : 'People you’ve paid recently'}</h2>
        <div className="list">
          {(t ? list : [...recentIds.map((id) => others.find((u) => u.id === id)).filter(Boolean) as User[], ...list.filter((u) => !recentIds.includes(u.id))]).map((u) => {
            const n = paidCount(u.id), last = lastPaid(u.id), look = u.lookalikeOf ? st.users.find((x) => x.id === u.lookalikeOf) : null;
            return (
              <div key={u.id} className="row nowrap" style={{ borderBottom: '1px solid var(--line)' }}>
                <button type="button" className="li" style={{ borderBottom: 0, ...(u.isNew ? { background: 'var(--warn-bg)', borderRadius: 12 } : {}) }} onClick={() => onPick(u)}
                  aria-label={u.isNew ? `${u.name}. Warning: new person, never paid.${look ? ` Name looks like ${look.name}.` : ''} ID ${u.upi}.` : `${u.name}${u.tagline ? ', ' + u.tagline : ''}. ID ${u.upi}. ${n ? `Paid ${n} times, last ${formatINR(last!.amount)}.` : 'Not paid yet.'}`}>
                  <Avatar name={u.name} color={u.color} verified={n > 0} />
                  <span className="t"><b>{u.name}{u.tagline ? <span className="muted" style={{ fontWeight: 400 }}> ({u.tagline})</span> : null}</b>
                    <small className="mono">{u.upi} · {u.phone}</small>
                    {u.isNew ? <small style={{ color: 'var(--warn)', fontWeight: 700 }}><AlertTriangle size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> New · never paid{look ? ` · looks like ${look.name}` : ''}</small> : <small>{n ? `Paid ${n} times · last ${formatINR(last!.amount)}` : 'Not paid yet'}</small>}
                  </span>
                  <ChevronRight aria-hidden="true" color="var(--dim)" />
                </button>
                {!u.isNew && <button type="button" className="iconbtn" style={{ border: 0, background: 'none' }} aria-pressed={st.favourites.includes(u.id)} aria-label={`${st.favourites.includes(u.id) ? 'Remove' : 'Add'} ${u.name} ${st.favourites.includes(u.id) ? 'from' : 'to'} favourites`} onClick={() => toggleFav(u.id)}><Star fill={st.favourites.includes(u.id) ? '#FFC861' : 'none'} color={st.favourites.includes(u.id) ? '#FFC861' : 'var(--dim)'} /></button>}
              </div>
            );
          })}
          {t && !list.length && <div className="empty"><UserPlus aria-hidden="true" /><b>No one found</b><span>Check the spelling, or search by phone or Zetheta ID. Try “rahul” to see the look-alike warning.</span></div>}
        </div>
      </section>
    </>
  );
}
