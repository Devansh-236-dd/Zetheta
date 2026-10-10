import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, ImageUp, Keyboard, QrCode, ScanLine, Ticket } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { checkout, transfer } from '../lib/ledger';
import { encodePay, parseQr, PAY_PREFIX, type QrResult } from '../lib/qr';
import { decodeFromFile, decodeFromSource, decodeFromUrl, qrDataUrl } from '../lib/qrimage';
import { formatINR, parseAmount } from '../lib/money';
import { simpleTotals } from '../lib/pricing';
import { usePay } from '../components/PaySheet';
import { Alert, AmountWords, Avatar, Btn, DemoNote, Field, PageHeader, Seg, announce } from '../components/ui';

export const SAMPLE_QRS = [
  { id: 's1', label: 'Gupta Kirana Store', sub: 'Shop counter code · you enter the amount', valid: true, text: encodePay({ type: 'pay', to: 'gupta.kirana@zetheta', name: 'Gupta Kirana Store' }) },
  { id: 's2', label: 'Café Monsoon bill', sub: 'Fixed amount ₹260 with bill reference', valid: true, text: encodePay({ type: 'pay', to: 'cafe.monsoon@zetheta', name: 'Café Monsoon', amt: 26000, ref: 'BILL-2041' }) },
  { id: 's3', label: 'Rahul Sharma', sub: 'Personal payment code', valid: true, text: encodePay({ type: 'pay', to: 'rahul.sharma@zetheta', name: 'Rahul Sharma' }) },
  { id: 's4', label: 'Free cashback link', sub: 'Invalid: a web link, never opened', valid: false, text: 'https://free-cashback.example/claim?wallet=all' },
  { id: 's5', label: 'Foreign currency code', sub: 'Invalid: asks for USD', valid: false, text: PAY_PREFIX + JSON.stringify({ zth: 1, type: 'pay', to: 'gupta.kirana@zetheta', amt: 5000, cur: 'USD', purpose: 'DEMO-ONLY' }) },
  { id: 's6', label: '“Quick Loans” merchant', sub: 'Invalid: recipient doesn’t exist', valid: false, text: encodePay({ type: 'pay', to: 'quickloans@zetheta', name: 'Quick Loans', amt: 99900 }) },
  { id: 's7', label: 'Tampered code', sub: 'Invalid: unexpected extra field', valid: false, text: PAY_PREFIX + JSON.stringify({ zth: 1, type: 'pay', to: 'cafe.monsoon@zetheta', cur: 'INR', purpose: 'DEMO-ONLY', redirect: 'https://x.example' }) },
];

type Mode = 'samples' | 'camera' | 'upload' | 'id';

export function Scan() {
  const st = useStore((s) => s);
  const directory = useMemo(() => [...st.users, ...st.merchants].map((x) => ({ id: x.id, upi: x.upi, name: x.name })), [st.users, st.merchants]);
  const [mode, setMode] = useState<Mode>('samples');
  const [raw, setRaw] = useState<string | null>(null);
  const [result, setResult] = useState<QrResult | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const handle = (text: string | null, source: string) => {
    if (!text) { setScanMsg(`No QR code found in the ${source}. Try a clearer, closer image.`); announce('No QR code found.'); return; }
    setScanMsg(null);
    setRaw(text);
    let r = parseQr(text, directory);
    if (r.ok && r.kind === 'pay' && r.recipientId === st.me) r = { ok: false, code: 'unknown_recipient', message: 'This is your own QR code. You can’t pay yourself.' };
    setResult(r);
    announce(r.ok ? (r.kind === 'pay' ? `QR read. Pay ${r.recipientName}${r.amount ? ', ' + formatINR(r.amount) : ''}.` : 'Ticket QR read.') : 'QR not accepted. ' + r.message);
  };
  const reset = () => { setRaw(null); setResult(null); setScanMsg(null); };

  return (
    <>
      <PageHeader title="Scan & Pay" sub="Scan a Zetheta QR with your camera, upload a picture of one, use a sample, or type an ID." backTo="/" actions={<Btn variant="ghost" size="sm" icon={<Ticket />} onClick={() => navigate('/validate')}>Validate a ticket</Btn>} />
      {!result ? (
        <>
          <Seg label="How to scan" value={mode} onChange={(m) => { setMode(m); setScanMsg(null); }} options={[{ id: 'samples', label: 'Sample QR codes' }, { id: 'camera', label: 'Camera' }, { id: 'upload', label: 'Upload image' }, { id: 'id', label: 'Type an ID' }]} />
          {scanMsg && <Alert kind="warn" title="Couldn’t read a QR code">{scanMsg}</Alert>}
          {mode === 'samples' && <Samples onScan={handle} />}
          {mode === 'camera' && <CameraScan onScan={(t) => handle(t, 'camera')} />}
          {mode === 'upload' && <UploadScan onScan={handle} />}
          {mode === 'id' && <IdEntry onScan={(t) => handle(t, 'ID')} />}
        </>
      ) : (
        <ScanResult raw={raw!} result={result} onReset={reset} />
      )}
    </>
  );
}

function Samples({ onScan }: { onScan: (t: string | null, src: string) => void }) {
  const [imgs, setImgs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { let on = true; Promise.all(SAMPLE_QRS.map(async (s) => [s.id, await qrDataUrl(s.text, 300)] as const)).then((xs) => on && setImgs(Object.fromEntries(xs))); return () => { on = false; }; }, []);
  return (
    <section className="stack" aria-labelledby="samp-h">
      <h2 id="samp-h" className="h3">Sample QR codes for judges</h2>
      <DemoNote>Each sample is a real QR image. “Scan this” decodes the picture pixel by pixel (the same decoder the camera uses), then validates it. You can also point another phone running this demo at these codes, or download them from the Receive page.</DemoNote>
      <div className="grid two">
        {SAMPLE_QRS.map((s) => (
          <div key={s.id} className="card row nowrap" style={{ alignItems: 'flex-start' }}>
            <div className="sampleqr">{imgs[s.id] ? <img src={imgs[s.id]} alt={`Sample QR: ${s.label}`} /> : <div className="skel" style={{ aspectRatio: '1' }} />}</div>
            <div className="stack sm grow">
              <b>{s.label}</b>
              <span className="small muted">{s.sub}</span>
              <span className={`badge ${s.valid ? 'ok' : 'err'}`} style={{ width: 'max-content' }}>{s.valid ? 'Valid sample' : 'Should be rejected'}</span>
              <Btn size="sm" icon={<ScanLine />} disabled={!imgs[s.id] || busy === s.id} onClick={async () => { setBusy(s.id); const t = await decodeFromUrl(imgs[s.id]); setBusy(null); onScan(t, 'sample image'); }}>{busy === s.id ? 'Reading…' : 'Scan this'}</Btn>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CameraScan({ onScan }: { onScan: (t: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [err, setErr] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => () => stop(), []);
  const start = async () => {
    setState('starting'); setErr('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!; v.srcObject = stream; await v.play();
      setState('live'); announce('Camera on. Point it at a Zetheta QR code.');
      let last = 0;
      const tick = (t: number) => {
        if (!streamRef.current) return;
        if (t - last > 220 && v.videoWidth) {
          last = t;
          const text = decodeFromSource(v, v.videoWidth, v.videoHeight);
          if (text) { if (navigator.vibrate) navigator.vibrate(60); stop(); onScan(text); return; }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e) {
      const name = (e as Error).name;
      setState('error');
      setErr(name === 'NotAllowedError' || name === 'SecurityError' ? 'Camera access isn’t allowed here. Inside the shared demo link, browsers block the camera — use “Upload image” or “Sample QR codes” instead. When the app runs on its own website, allow camera access when asked.'
        : name === 'NotFoundError' ? 'No camera was found on this device. Use “Upload image” or a sample instead.'
        : 'This browser can’t open the camera. Use “Upload image” or a sample instead.');
    }
  };
  return (
    <section className="stack" aria-labelledby="cam-h">
      <h2 id="cam-h" className="h3">Scan with camera</h2>
      <div className="scanbox">
        <video ref={videoRef} playsInline muted aria-label="Camera preview" />
        {state === 'live' && <><div className="frame deco" aria-hidden="true" /><div className="laser deco" aria-hidden="true" /></>}
        {state !== 'live' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>{state === 'error' ? <CameraOff size={48} aria-hidden="true" /> : <Camera size={48} aria-hidden="true" />}</div>}
      </div>
      {state === 'error' && <Alert kind="warn" title="Camera unavailable">{err}</Alert>}
      {state === 'live' ? <Btn variant="quiet" onClick={() => { stop(); setState('idle'); }}>Stop camera</Btn> : <Btn icon={<Camera />} onClick={start} disabled={state === 'starting'}>{state === 'starting' ? 'Starting camera…' : 'Start camera'}</Btn>}
      <p className="small muted" style={{ margin: 0 }}>The camera image never leaves your device. It is only scanned for a QR code.</p>
    </section>
  );
}

function UploadScan({ onScan }: { onScan: (t: string | null, src: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="card stack" aria-labelledby="up-h">
      <h2 id="up-h" className="h3">Upload a QR image</h2>
      <p className="muted" style={{ margin: 0 }}>Choose a photo or screenshot of a Zetheta QR code (PNG or JPG, up to 8 MB). Tip: download one from the Receive page.</p>
      <label className="btn btn-primary" style={{ width: 'max-content' }}>
        <ImageUp aria-hidden="true" />{busy ? 'Reading…' : 'Choose image'}
        <input type="file" accept="image/*" className="vh" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); const t = await decodeFromFile(f); setBusy(false); e.target.value = ''; onScan(t, 'image'); }} />
      </label>
    </section>
  );
}

function IdEntry({ onScan }: { onScan: (t: string) => void }) {
  const [id, setId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="card stack" aria-labelledby="id-h">
      <h2 id="id-h" className="h3">Pay by Zetheta ID</h2>
      <p className="muted" style={{ margin: 0 }}>An accessible alternative to scanning — type the shop’s or person’s ID.</p>
      <Field label="Zetheta ID" hint="e.g. gupta.kirana@zetheta" error={err}>
        {(fid, d) => <input id={fid} aria-describedby={d} className="input mono" value={id} onChange={(e) => { setId(e.target.value.trim().toLowerCase()); setErr(null); }} autoCapitalize="none" />}
      </Field>
      <Btn icon={<Keyboard />} onClick={() => { if (!/^[a-z0-9._-]{3,40}@zetheta$/.test(id)) { setErr('IDs look like name@zetheta.'); return; } onScan(encodePay({ type: 'pay', to: id })); }}>Continue</Btn>
    </section>
  );
}

function ScanResult({ raw, result, onReset }: { raw: string; result: QrResult; onReset: () => void }) {
  const st = useStore((s) => s);
  const { openPay } = usePay();
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!result.ok) return (
    <div className="stack" style={{ maxWidth: 620 }}>
      <Alert kind="err" title="This QR code can’t be paid" actions={<Btn onClick={onReset} icon={<QrCode />}>Scan another code</Btn>}>{result.message}</Alert>
      <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>What the code contains (shown as text, never opened)</summary><pre className="mono xs" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '10px 0 0' }}>{raw.slice(0, 600)}</pre></details>
    </div>
  );
  if (result.kind === 'ticket') return (
    <Alert kind="info" title="This is a Zetheta ticket QR" actions={<><Btn onClick={() => navigate('/validate')}>Open ticket validator</Btn><Btn variant="quiet" onClick={onReset}>Scan another</Btn></>}>Tickets are checked on the Validate ticket screen, not paid.</Alert>
  );
  const merchant = st.merchants.find((m) => m.id === result.recipientId);
  const user = st.users.find((u) => u.id === result.recipientId);
  const fixed = result.amount;
  const paise = fixed ?? parseAmount(amt || '0') ?? 0;
  const go = () => {
    if (!paise) { setErr('Enter an amount greater than zero.'); return; }
    const name = merchant?.name ?? user!.name;
    openPay({
      title: merchant ? `Payment to ${name}${result.data.ref ? ' · ' + result.data.ref : ''}` : `Send to ${name}`,
      payee: { name, color: merchant?.color ?? user?.color, sub: result.data.to },
      category: merchant ? 'merchant' : 'transfer',
      totals: () => simpleTotals(merchant ? 'Amount' : 'Transfer', paise),
      commit: (s, a) => merchant
        ? checkout(s, { key: a.key, category: 'merchant', merchantId: merchant.id, title: `QR payment: ${name}`, total: a.total, meta: { qr: true, ref: result.data.ref ?? null } })
        : transfer(s, user!.id, a.total, a.key, 'Paid by QR'),
      onSuccess: () => onReset(),
    });
  };
  return (
    <div className="stack lg" style={{ maxWidth: 560 }}>
      <Alert kind="ok" title="QR code verified">Schema v1 · INR · demo-only · recipient found in the Zetheta directory.</Alert>
      <div className="card stack">
        <div className="row nowrap"><Avatar name={result.recipientName} color={merchant?.color ?? user?.color ?? '#3A4BD6'} size="lg" verified /><div className="grow"><b className="h3">{result.recipientName}</b><div className="small muted mono">{result.data.to}</div><div className="small muted">{merchant ? `Merchant · ${merchant.city}` : `Person · ${user?.bank}`}</div></div></div>
        {result.data.name && result.data.name !== result.recipientName && <Alert kind="warn" title="Name doesn’t match">The code says “{result.data.name}”, but this ID belongs to {result.recipientName}. Only pay if you trust it.</Alert>}
        {result.data.ref && <div className="row between small"><span className="muted">Reference</span><span className="mono">{result.data.ref}</span></div>}
      </div>
      {fixed ? (
        <div className="stack sm"><span className="muted">Amount set by the code</span><div className="bigamt"><span className="cur">₹</span>{formatINR(fixed, { plain: true })}</div><AmountWords p={fixed} /></div>
      ) : (
        <Field label="Amount to pay (₹)" error={err}>{(id, d) => <input id={id} aria-describedby={d} className="input num" inputMode="decimal" value={amt} autoFocus onChange={(e) => { setAmt(e.target.value.replace(/[^\d.]/g, '')); setErr(null); }} placeholder="e.g. 340" />}</Field>
      )}
      {!fixed && paise > 0 && <AmountWords p={paise} />}
      <div className="row"><Btn size="lg" onClick={go}>Review payment</Btn><Btn variant="quiet" onClick={onReset}>Cancel</Btn></div>
      <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Decoded payload</summary><pre className="mono xs" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '10px 0 0' }}>{JSON.stringify(result.data, null, 2)}</pre></details>
    </div>
  );
}
