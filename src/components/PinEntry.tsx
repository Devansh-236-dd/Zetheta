import { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { session, useSession } from '../session';
import { Alert, Btn, Keypad, Switch, announce } from './ui';

/** 4-digit demo PIN with keypad AND keyboard input, show-digits switch, wrong-PIN handling and OTP fallback. */
export function PinEntry({ onSuccess, label = 'Enter your 4-digit Zetheta PIN', busy }: { onSuccess: () => void; label?: string; busy?: boolean }) {
  const sess = useSession();
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [okAnim, setOkAnim] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = now < sess.lockUntil;
  useEffect(() => { if (!locked) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [locked]);
  useEffect(() => { inputRef.current?.focus(); }, [otpMode]);

  const submit = (p: string) => {
    const r = session.checkPin(p);
    if (r === 'ok') { setOkAnim(true); announce('PIN accepted.'); setTimeout(onSuccess, 380); return; }
    setShake(true); setTimeout(() => setShake(false), 460); setPin('');
    const left = 3 - session.get().pinFails;
    const msg = r === 'locked' ? 'Too many wrong tries. PIN entry is paused for 30 seconds. You can use a one-time code instead. No money has been sent.' : `That PIN didn’t match. ${left} ${left === 1 ? 'try' : 'tries'} left. No money has been sent.`;
    setErr(msg); announce(msg); setNow(Date.now());
  };
  const onKey = (k: string) => {
    if (busy || okAnim) return;
    if (otpMode) { setOtp((o) => k === 'del' ? o.slice(0, -1) : k === 'clear' ? '' : o.length < 6 ? o + k : o); return; }
    if (locked) return;
    setErr('');
    setPin((p) => {
      const n = k === 'del' ? p.slice(0, -1) : k === 'clear' ? '' : p.length < 4 ? p + k : p;
      announce(`${n.length} of 4 digits entered`);
      if (n.length === 4 && p.length === 3) setTimeout(() => submit(n), 250);
      return n;
    });
  };
  useEffect(() => { if (otpMode && otp.length === 6) { session.otpPass(); setOkAnim(true); announce('Code accepted.'); setTimeout(onSuccess, 380); } }, [otp, otpMode]);

  if (otpMode) return (
    <div className="stack">
      <Alert kind="info" title="Code sent by SMS (simulated)">We “texted” a 6-digit code to +91 ••••• ••821. No real SMS is sent in the demo.</Alert>
      <label className="vh" htmlFor="otp-in">One-time code</label>
      <input id="otp-in" ref={inputRef} className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-describedby="otp-hint" placeholder="6-digit code" />
      <span id="otp-hint" className="hint small muted">{otp.length} of 6 digits entered</span>
      <Btn icon={<MessageSquare />} onClick={() => setOtp('482913')} block>Fill code from SMS</Btn>
      <Keypad onKey={onKey} label="Number pad for one-time code" />
      <button type="button" className="link" onClick={() => { setOtpMode(false); setOtp(''); }}>Use my PIN instead</button>
    </div>
  );
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="pin-in" className="lbl" style={{ textAlign: 'center' }}>{label}</label>
        <input id="pin-in" ref={inputRef} className="vh" type={show ? 'text' : 'password'} inputMode="numeric" autoComplete="off" maxLength={4} value={pin} disabled={locked || busy}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setErr(''); setPin(v); if (v.length === 4) setTimeout(() => submit(v), 150); }}
          aria-describedby="pin-status" />
        <div className={`dots ${shake ? 'shake' : ''} ${okAnim ? 'ok' : ''}`} aria-hidden="true" onClick={() => inputRef.current?.focus()}>
          {[0, 1, 2, 3].map((i) => show ? <span key={i} className="digbox">{pin[i] ?? ''}</span> : <span key={i} className={`dot ${i < pin.length ? 'on' : ''}`} />)}
        </div>
        <span id="pin-status" className="vh">{pin.length} of 4 digits entered</span>
      </div>
      {err && <Alert kind="err" title={locked ? 'PIN paused' : 'PIN didn’t match'}>{err}{locked && <> Try again in {Math.ceil((sess.lockUntil - now) / 1000)} seconds.</>}</Alert>}
      <Switch checked={show} onChange={setShow} label="Show digits" sub="Helpful if your hands shake" />
      <Keypad onKey={onKey} label="PIN number pad" />
      <div className="row between">
        <button type="button" className="link" onClick={() => setOtpMode(true)}>Use a one-time code (OTP) instead</button>
        <span className="xs dim">Demo PIN: 1234</span>
      </div>
    </div>
  );
}
