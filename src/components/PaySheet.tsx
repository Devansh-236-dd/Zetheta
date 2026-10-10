import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Lock, Plus, ShieldCheck, Tag } from 'lucide-react';
import type { Paise } from '../lib/money';
import { formatINR, rs } from '../lib/money';
import type { AppState, Category, Txn } from '../lib/types';
import type { Totals } from '../lib/pricing';
import { validateCoupon } from '../lib/coupons';
import { DomainError, myBalance, topUp } from '../lib/ledger';
import { rid } from '../lib/ids';
import { store, useStore } from '../store';
import { navigate } from '../router';
import { Alert, AmountWords, Avatar, Btn, Dialog, Field, Money, Tick, announce, toast } from './ui';
import { PinEntry } from './PinEntry';

export interface PaySpec {
  title: string;
  payee: { name: string; color?: string; sub?: string };
  category: Category;
  couponable?: boolean;
  initialCoupon?: string;
  totals: (discount: Paise) => Totals;
  commit: (s: AppState, a: { key: string; total: Paise; coupon?: { code: string; subtotal: Paise; discount: Paise } }) => { state: AppState; txn: Txn };
  success?: { label: string; to: (txn: Txn) => string };
  onSuccess?: (txn: Txn) => void;
}

const Ctx = createContext<{ openPay: (s: PaySpec) => void; openAddMoney: (suggest?: Paise) => void }>({ openPay: () => {}, openAddMoney: () => {} });
export const usePay = () => useContext(Ctx);

export function PayProvider({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<PaySpec | null>(null);
  const [nonce, setNonce] = useState(0);
  const [addOpen, setAddOpen] = useState<{ open: boolean; suggest?: Paise }>({ open: false });
  const api = useMemo(() => ({ openPay: (s: PaySpec) => { setSpec(s); setNonce((n) => n + 1); }, openAddMoney: (suggest?: Paise) => setAddOpen({ open: true, suggest }) }), []);
  return (
    <Ctx.Provider value={api}>
      {children}
      {spec && <PaySheet key={nonce} spec={spec} onClose={() => setSpec(null)} onAddMoney={(p) => setAddOpen({ open: true, suggest: p })} />}
      <AddMoneyDialog open={addOpen.open} suggest={addOpen.suggest} onClose={() => setAddOpen({ open: false })} />
    </Ctx.Provider>
  );
}

type Step = 'review' | 'pin' | 'processing' | 'done' | 'failed';

function PaySheet({ spec, onClose, onAddMoney }: { spec: PaySpec; onClose: () => void; onAddMoney: (p: Paise) => void }) {
  const bal = useStore(myBalance);
  const uses = useStore((s) => s.couponUses);
  const [step, setStep] = useState<Step>('review');
  const [code, setCode] = useState(spec.initialCoupon ?? '');
  const [applied, setApplied] = useState<{ code: string; discount: Paise } | null>(null);
  const [cMsg, setCMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [proc, setProc] = useState(0);
  const [txn, setTxn] = useState<Txn | null>(null);
  const [fail, setFail] = useState('');
  const keyRef = useRef(rid('pay_', 14));
  const committing = useRef(false);

  const base = spec.totals(0);
  const totals = spec.totals(applied?.discount ?? 0);
  const short = totals.total - bal;

  const apply = () => {
    const r = validateCoupon(code, { category: spec.category, subtotal: base.subtotal, now: Date.now(), uses });
    if (r.ok) { setApplied({ code: r.coupon.code, discount: r.discount }); setCMsg({ ok: true, text: r.message }); }
    else { setApplied(null); setCMsg({ ok: false, text: r.reason }); }
  };

  const run = () => {
    if (committing.current) return; // duplicate-click guard
    committing.current = true;
    setStep('processing'); setProc(0);
    announce(`Processing payment of ${formatINR(totals.total)}. Please wait.`);
    setTimeout(() => setProc(1), 500);
    setTimeout(() => setProc(2), 1000);
    setTimeout(() => {
      try {
        const r = spec.commit(store.get(), { key: keyRef.current, total: totals.total, coupon: applied ? { code: applied.code, subtotal: base.subtotal, discount: applied.discount } : undefined });
        store.set(r.state);
        setTxn(r.txn);
        if (r.txn.status === 'success') { setStep('done'); announce(`Payment successful. ${formatINR(r.txn.amount)} paid. Reference ${r.txn.ref}.`); spec.onSuccess?.(r.txn); }
        else { setFail(r.txn.failureReason ?? 'The payment failed.'); setStep('failed'); announce('Payment failed. ' + (r.txn.failureReason ?? '')); }
      } catch (e) {
        const msg = e instanceof DomainError ? e.message : 'Something went wrong. No money was taken.';
        setFail(msg); setStep('failed'); announce('Payment failed. ' + msg);
      }
    }, 1500);
  };
  const retry = () => { keyRef.current = rid('pay_', 14); committing.current = false; setStep('review'); setFail(''); };

  const title = step === 'done' ? 'Payment successful' : step === 'failed' ? 'Payment failed' : step === 'pin' ? 'Confirm with PIN' : step === 'processing' ? 'Processing payment' : 'Review & pay';
  return (
    <Dialog open onClose={() => { if (step !== 'processing') onClose(); }} title={title}>
      <div className="row nowrap">
        <Avatar name={spec.payee.name} color={spec.payee.color ?? '#3A4BD6'} />
        <div className="grow"><b>{spec.payee.name}</b><div className="small muted">{spec.payee.sub ?? spec.title}</div></div>
        <span className="badge demo">Demo</span>
      </div>

      {step === 'review' && (
        <>
          <div className="small muted">{spec.title}</div>
          <div className="totals" aria-label="Price breakdown">
            {totals.lines.filter((l) => l.amount !== 0 || l.kind === 'base').map((l, i) => (
              <div key={i} className={`tl ${l.kind === 'discount' ? 'discount' : ''}`}><span>{l.label}</span><Money p={l.amount} /></div>
            ))}
            <div className="tl total"><span>Total to pay</span><Money p={totals.total} /></div>
          </div>
          <AmountWords p={totals.total} />
          {spec.couponable && (
            <div className="stack sm">
              <Field label="Coupon code" hint="Try a demo code from the Offers page" error={cMsg && !cMsg.ok ? cMsg.text : null} ok={cMsg?.ok ? cMsg.text : null}>
                {(id, d) => (
                  <div className="row nowrap">
                    <input id={id} aria-describedby={d} className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. FOOD50" autoCapitalize="characters" onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} />
                    {applied ? <Btn variant="quiet" onClick={() => { setApplied(null); setCMsg(null); setCode(''); }}>Remove</Btn> : <Btn variant="ghost" icon={<Tag />} onClick={apply}>Apply</Btn>}
                  </div>
                )}
              </Field>
            </div>
          )}
          <div className="row between small"><span className="muted">Wallet balance</span><span className="num"><Money p={bal} /> → <b><Money p={Math.max(0, bal - totals.total)} /></b></span></div>
          {short > 0 && (
            <Alert kind="warn" title="Not enough demo balance" actions={<Btn size="sm" variant="warn" icon={<Plus />} onClick={() => onAddMoney(Math.ceil((short + rs(100)) / rs(100)) * rs(100))}>Add demo money</Btn>}>
              You need {formatINR(short)} more. Add demo money, or remove items. Nothing has been charged.
            </Alert>
          )}
          <Btn size="lg" block icon={<Lock />} disabled={short > 0 || totals.total <= 0} onClick={() => setStep('pin')}>Pay {formatINR(totals.total)}</Btn>
          <p className="xs muted" style={{ margin: 0, textAlign: 'center' }}><ShieldCheck size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> You’ll enter your PIN next. Nothing is charged until then.</p>
        </>
      )}

      {step === 'pin' && (
        <>
          <div className="row between"><span className="muted">Paying</span><b className="num"><Money p={totals.total} /></b></div>
          <PinEntry onSuccess={run} />
          <Btn variant="quiet" onClick={() => setStep('review')}>Back to review</Btn>
        </>
      )}

      {step === 'processing' && (
        <div className="stack lg" role="status" aria-live="polite" style={{ padding: '12px 0' }}>
          <ul className="steps">
            {['PIN verified', 'Contacting demo bank', 'Confirming payment'].map((l, i) => (
              <li key={l} className={i < proc ? 'done' : i === proc ? 'now' : ''}><span className="si"><Check aria-hidden="true" /></span>{l}</li>
            ))}
          </ul>
          <p className="small muted" style={{ margin: 0 }}>Please keep this window open.</p>
        </div>
      )}

      {step === 'done' && txn && (
        <div className="stack" style={{ textAlign: 'center' }}>
          <Tick />
          <div className="bigamt"><span className="cur">₹</span>{formatINR(txn.amount, { plain: true })}</div>
          <div><AmountWords p={txn.amount} /></div>
          <div className="small muted">Paid to {txn.counterparty} · Ref <span className="mono">{txn.ref}</span></div>
          <div className="row" style={{ justifyContent: 'center' }}>
            {spec.success && <Btn onClick={() => { onClose(); navigate(spec.success!.to(txn)); }}>{spec.success.label}</Btn>}
            <Btn variant="ghost" onClick={() => { onClose(); navigate('/txn/' + txn.id); }}>View receipt</Btn>
            {!spec.success && <Btn variant="quiet" onClick={onClose}>Done</Btn>}
          </div>
        </div>
      )}

      {step === 'failed' && (
        <div className="stack" style={{ textAlign: 'center' }}>
          <Tick err />
          <Alert kind="err" title="Payment didn’t go through">{fail} {txn ? <>Reference <span className="mono">{txn.ref}</span> is recorded as failed.</> : null}</Alert>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Btn onClick={retry}>Try again</Btn>
            <Btn variant="quiet" onClick={onClose}>Close</Btn>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function AddMoneyDialog({ open, onClose, suggest }: { open: boolean; onClose: () => void; suggest?: Paise }) {
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const keyRef = useRef(rid('add_'));
  const val = amt ? parseInt(amt, 10) * 100 : suggest ?? 0;
  const add = () => {
    if (!val || val <= 0) { setErr('Choose or type an amount.'); return; }
    if (val > rs(100000)) { setErr('Add up to ₹1,00,000 at a time in the demo.'); return; }
    try {
      store.update((s) => topUp(s, val, keyRef.current).state);
      keyRef.current = rid('add_');
      toast(`${formatINR(val)} demo money added`); announce(`${formatINR(val)} added to your wallet.`);
      setAmt(''); setErr(null); onClose();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add demo money">
      <Alert kind="info" title="Simulated top-up">Money comes from a pretend linked bank. No real bank is contacted.</Alert>
      <div className="chips" role="group" aria-label="Quick amounts">
        {[500, 1000, 2000, 5000].map((r) => <button key={r} type="button" className="chip" aria-pressed={val === rs(r)} onClick={() => { setAmt(String(r)); setErr(null); }}>₹{r.toLocaleString('en-IN')}</button>)}
      </div>
      <Field label="Amount in rupees" error={err}>
        {(id, d) => <input id={id} aria-describedby={d} className="input" inputMode="numeric" value={amt} placeholder={suggest ? String(suggest / 100) : 'e.g. 1500'} onChange={(e) => { setAmt(e.target.value.replace(/\D/g, '').slice(0, 7)); setErr(null); }} />}
      </Field>
      <Btn size="lg" block icon={<Plus />} onClick={add}>Add {val ? formatINR(val) : 'money'}</Btn>
    </Dialog>
  );
}
