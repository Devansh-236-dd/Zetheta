import { useEffect, useId, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, Check, CheckCircle2, Delete, Info, X } from 'lucide-react';
import type { Paise } from '../lib/money';
import { cap, formatINR, wordsEn, wordsHi } from '../lib/money';
import { qrDataUrl } from '../lib/qrimage';
import { back } from '../router';
import { useStore } from '../store';

export const reducedMotion = () => {
  const m = document.documentElement.dataset.motion;
  if (m === 'reduce') return true;
  if (m === 'allow') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
};

/* ---------- brand ---------- */
const PETALS = ['#2B5BFF', '#8B5CF6', '#FF3D7F', '#FF8A3D', '#FFC861', '#00C2FF'];
export function Logo({ size = 34, className = 'logo' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g>{PETALS.map((f, i) => { const a = (i * Math.PI) / 3; return <circle key={i} style={{ ['--i' as string]: i }} cx={50 + Math.cos(a) * 17} cy={50 + Math.sin(a) * 17} r={24} fill={f} opacity={0.88} />; })}</g>
      <polygon points={[0, 1, 2, 3, 4, 5].map((i) => { const a = (i * Math.PI) / 3 + Math.PI / 6; return `${50 + Math.cos(a) * 8},${50 + Math.sin(a) * 8}`; }).join(' ')} fill="#05060C" />
    </svg>
  );
}

/** Animated iridescent ribbon (decorative canvas). */
export function Ribbon({ opts, className = 'rib' }: { opts?: Partial<RibbonOpts>; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; if (!c) return; return ribbon(c, { ...DEFAULT_RIB, ...opts }); }, []);
  return <canvas ref={ref} className={className + ' deco'} aria-hidden="true" />;
}
interface RibbonOpts { x0: number; y0: number; x1: number; y1: number; amp: number; bw: number; f: number; tw: number; n: number; a: number; sp: number; lw: number; base: number }
const DEFAULT_RIB: RibbonOpts = { x0: 0.25, y0: 1.2, x1: 1.15, y1: -0.25, amp: 0.12, bw: 0.75, f: 1.3, tw: 0.9, n: 60, a: 0.42, sp: 0.007, lw: 1.3, base: 0.45 };
function ribbon(cv: HTMLCanvasElement, o: RibbonOpts) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  let t = Math.random() * 6, w = 0, h = 0, raf = 0, alive = true, vis = true;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { vis = es[0].isIntersecting; }) : null;
  io?.observe(cv);
  const draw = () => {
    const r = cv.getBoundingClientRect();
    if (r.width !== w || r.height !== h) { w = r.width; h = r.height; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (!w || !h) return false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(o.x0 * w, o.y0 * h, o.x1 * w, o.y1 * h);
    g.addColorStop(0, '#2B5BFF'); g.addColorStop(0.42, '#7B5CFF'); g.addColorStop(0.7, '#FF3D9A'); g.addColorStop(1, '#FF9A3D');
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = o.lw; ctx.strokeStyle = g;
    const S = 44, m = Math.min(w, h);
    for (let i = 0; i < o.n; i++) {
      const k = i / (o.n - 1) - 0.5; ctx.beginPath();
      for (let j = 0; j <= S; j++) {
        const q = j / S;
        const cx = o.x0 * w + (o.x1 - o.x0) * w * q, cy = o.y0 * h + (o.y1 - o.y0) * h * q + Math.sin(q * Math.PI * o.f + t) * o.amp * m;
        const tw = (o.base + Math.cos(q * Math.PI * o.tw + t * 0.8)) * o.bw * m;
        const x = cx + k * tw * 0.55, y = cy + k * tw;
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.globalAlpha = o.a * (1.15 - Math.abs(k) * 1.6); ctx.stroke();
    }
    ctx.globalAlpha = 1; return true;
  };
  const loop = () => { if (!alive) return; if (vis && !document.hidden) { draw(); if (!reducedMotion()) t += o.sp; } raf = requestAnimationFrame(loop); };
  loop();
  return () => { alive = false; cancelAnimationFrame(raf); io?.disconnect(); };
}

/* ---------- buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' | 'danger' | 'warn'; size?: 'sm' | 'lg'; block?: boolean; icon?: ReactNode };
export function Btn({ variant = 'primary', size, block, icon, className = '', children, onPointerDown, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} className={`btn btn-${variant} ${size ? 'btn-' + size : ''} ${block ? 'btn-block' : ''} ${className}`} onPointerDown={(e) => { ripple(e); onPointerDown?.(e); }} {...rest}>
      {icon}{children}
    </button>
  );
}
export function ripple(e: React.PointerEvent<HTMLElement>) {
  if (reducedMotion()) return;
  const b = e.currentTarget, r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, sp = document.createElement('span');
  sp.className = 'rip'; sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.appendChild(sp); setTimeout(() => sp.remove(), 600);
}
export function IconBtn({ label, children, badge, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; badge?: number }) {
  return <button type="button" className="iconbtn" aria-label={label + (badge ? `, ${badge} unread` : '')} {...rest}>{children}{badge ? <span className="dot" aria-hidden="true">{badge > 9 ? '9+' : badge}</span> : null}</button>;
}

/* ---------- page header ---------- */
export function PageHeader({ title, sub, backTo, onBack, actions, eyebrow }: { title: string; sub?: ReactNode; backTo?: string; onBack?: () => void; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="phead">
      {(backTo !== undefined || onBack) && <IconBtn label="Back" onClick={() => (onBack ? onBack() : back(backTo))}><ArrowLeft /></IconBtn>}
      <div className="titles">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

/* ---------- form fields ---------- */
export function Field({ label, hint, error, ok, children, id }: { label: string; hint?: string; error?: string | null; ok?: string | null; children: (id: string, describedBy: string | undefined) => ReactNode; id?: string }) {
  const auto = useId(); const fid = id ?? auto;
  const hid = hint ? fid + '-h' : undefined, eid = error ? fid + '-e' : ok ? fid + '-o' : undefined;
  const describedBy = [hid, eid].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      {children(fid, describedBy)}
      {hint && <span className="hint" id={hid}>{hint}</span>}
      {error && <span className="ferr" id={eid} role="alert"><AlertCircle aria-hidden="true" />{error}</span>}
      {!error && ok && <span className="fok" id={eid} role="status"><CheckCircle2 aria-hidden="true" />{ok}</span>}
    </div>
  );
}
export function Switch({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="t"><b>{label}</b>{sub && <small>{sub}</small>}</span><span className="sw" aria-hidden="true" />
    </button>
  );
}
export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite" aria-label={`${label}: ${value}`}>{value}</output>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

/* ---------- money ---------- */
export function Money({ p, className = '', sign }: { p: Paise; className?: string; sign?: boolean }) {
  return <span className={`num ${className}`} aria-label={(sign && p > 0 ? 'plus ' : p < 0 ? 'minus ' : '') + wordsEn(p)}>{formatINR(p, { sign })}</span>;
}
export function AmountWords({ p }: { p: Paise }) {
  const hi = useStore((s) => s.settings.a11y.hindiAmounts);
  return <span className={`words-pill ${hi ? 'hi' : ''}`}>{hi ? wordsHi(p) : cap(wordsEn(p))}</span>;
}

/* ---------- avatar ---------- */
export function Avatar({ name, color, size, verified }: { name: string; color: string; size?: 'sm' | 'lg'; verified?: boolean }) {
  const ini = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return <span className={`av ${size ?? ''}`} style={{ background: color }} aria-hidden="true">{ini}{verified && <span className="vt"><Check /></span>}</span>;
}

/* ---------- alerts / status ---------- */
export function Alert({ kind, title, children, actions }: { kind: 'info' | 'ok' | 'warn' | 'err'; title: string; children?: ReactNode; actions?: ReactNode }) {
  const Icon = kind === 'ok' ? CheckCircle2 : kind === 'warn' ? AlertTriangle : kind === 'err' ? AlertCircle : Info;
  return (
    <div className={`alert ${kind}`} role={kind === 'err' || kind === 'warn' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div className="grow"><b>{title}</b>{children && <div>{children}</div>}{actions && <div className="acts">{actions}</div>}</div>
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string, ReactNode]> = {
    success: ['ok', 'Successful', <CheckCircle2 key="i" aria-hidden="true" />], confirmed: ['ok', 'Confirmed', <CheckCircle2 key="i" aria-hidden="true" />],
    paid: ['ok', 'Paid', <CheckCircle2 key="i" aria-hidden="true" />], delivered: ['ok', 'Delivered', <CheckCircle2 key="i" aria-hidden="true" />],
    completed: ['ok', 'Completed', <CheckCircle2 key="i" aria-hidden="true" />], failed: ['err', 'Failed', <AlertCircle key="i" aria-hidden="true" />],
    cancelled: ['err', 'Cancelled', <X key="i" aria-hidden="true" />], refunded: ['info', 'Refunded', <Info key="i" aria-hidden="true" />],
    partially_refunded: ['info', 'Partly refunded', <Info key="i" aria-hidden="true" />], placed: ['info', 'Placed', <Info key="i" aria-hidden="true" />],
    preparing: ['warn', 'Preparing', <Info key="i" aria-hidden="true" />], out_for_delivery: ['warn', 'Out for delivery', <Info key="i" aria-hidden="true" />],
    open: ['warn', 'Waiting for payment', <Info key="i" aria-hidden="true" />],
  };
  const [k, l, i] = map[status] ?? ['info', status, null];
  return <span className={`badge ${k}`}>{i}{l}</span>;
}
export function DemoNote({ children }: { children: ReactNode }) {
  return <div className="demo-note"><Info aria-hidden="true" /><span>{children}</span></div>;
}
export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty">{icon}<b>{title}</b>{children && <span>{children}</span>}{action}</div>;
}
export function Tick({ err }: { err?: boolean }) {
  return <svg className={`tick ${err ? 'err' : ''}`} viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" />{err ? <path d="M34 34 66 66M66 34 34 66" /> : <path d="M30 52 44 66 71 37" />}</svg>;
}

/* ---------- dialog ---------- */
export function Dialog({ open, onClose, title, children, wide, sheet = true, labelledBy }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; sheet?: boolean; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tid = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    setTimeout(() => { (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]'))?.focus(); }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className={`scrim ${sheet ? 'sheet' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`dlg ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? tid}>
        <div className="dhead"><h2 className="h2" id={tid}>{title}</h2><IconBtn label="Close" onClick={onClose}><X /></IconBtn></div>
        {children}
      </div>
    </div>
  );
}

/* ---------- toasts + announcer ---------- */
type ToastT = { id: number; kind: 'ok' | 'err' | 'warn' | 'info'; text: string };
let toastId = 0;
const toastListeners = new Set<(t: ToastT[]) => void>();
let toasts: ToastT[] = [];
export function toast(text: string, kind: ToastT['kind'] = 'ok') {
  const t = { id: ++toastId, kind, text };
  toasts = [...toasts.slice(-2), t]; toastListeners.forEach((l) => l(toasts));
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); toastListeners.forEach((l) => l(toasts)); }, 3800);
}
export function Toasts() {
  const [list, setList] = useState<ToastT[]>([]);
  useEffect(() => { toastListeners.add(setList); return () => { toastListeners.delete(setList); }; }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'err' ? <AlertCircle aria-hidden="true" /> : t.kind === 'warn' ? <AlertTriangle aria-hidden="true" /> : t.kind === 'info' ? <Info aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<span>{t.text}</span></div>)}
    </div>
  );
}
let announceEl: HTMLElement | null = null;
export function announce(text: string) {
  if (!announceEl) return;
  announceEl.textContent = '';
  setTimeout(() => { if (announceEl) announceEl.textContent = text; }, 60);
}
export function Announcer() {
  return <div className="vh" aria-live="assertive" ref={(el) => { announceEl = el; }} />;
}

/* ---------- QR image ---------- */
export function QrImg({ text, alt, size = 360, className = 'qrbox' }: { text: string; alt: string; size?: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let on = true; qrDataUrl(text, size).then((u) => on && setUrl(u)).catch(() => on && setUrl(null)); return () => { on = false; }; }, [text, size]);
  return <div className={className}>{url ? <img src={url} alt={alt} /> : <div className="skel" style={{ aspectRatio: '1' }} aria-label="Generating QR code" />}</div>;
}

/* ---------- keypad + PIN ---------- */
export function Keypad({ onKey, label = 'Number pad', allowDot }: { onKey: (k: string) => void; label?: string; allowDot?: boolean }) {
  const last = useRef({ k: '', t: 0 });
  const press = (k: string, el: HTMLButtonElement) => {
    const now = Date.now();
    if (k === last.current.k && now - last.current.t < 250 && /\d/.test(k)) return; // tremor guard: ignore accidental double taps
    last.current = { k, t: now };
    el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 130);
    onKey(k);
  };
  return (
    <div className="kp" role="group" aria-label={label}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" className="key" onClick={(e) => press(k, e.currentTarget)}>{k}</button>)}
      {allowDot ? <button type="button" className="key fn" aria-label="Decimal point" onClick={(e) => press('.', e.currentTarget)}>.</button> : <button type="button" className="key fn" aria-label="Clear all" onClick={(e) => press('clear', e.currentTarget)}>Clear</button>}
      <button type="button" className="key" onClick={(e) => press('0', e.currentTarget)}>0</button>
      <button type="button" className="key fn" aria-label="Delete last digit" onClick={(e) => press('del', e.currentTarget)}><Delete aria-hidden="true" /></button>
    </div>
  );
}
