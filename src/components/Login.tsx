import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { session, useSession } from '../session';
import { Alert, Btn, Logo, Ribbon, reducedMotion } from './ui';
import { PinEntry } from './PinEntry';

export function Login() {
  const sess = useSession();
  const [intro, setIntro] = useState(!sess.introSeen && !reducedMotion());
  return (
    <div className="login">
      {intro && <Intro onDone={() => { setIntro(false); session.set({ introSeen: true }); }} />}
      <section className="login-hero">
        <Ribbon opts={{ x0: 0.15, y0: 1.25, x1: 1.15, y1: -0.3, bw: 0.9, n: 70, a: 0.4, base: 0.5, amp: 0.1 }} />
        <span className="veil deco" aria-hidden="true" />
        <div className="row"><Logo size={40} /><span className="h2">Zetheta</span><span className="badge demo">Demo mode</span></div>
        <p className="hero-line">Payments, trips and tickets — for everyone.</p>
      </section>
      <section className="panel" aria-labelledby="login-h">
        <h1 className="h1" id="login-h">Welcome back, Ramesh</h1>
        <Alert kind="info" title="Fingerprint and face unlock are off">Log in with your 4-digit PIN or a one-time code. Both are just as safe. <b>Demo PIN: 1234</b></Alert>
        <PinEntry label="Enter your 4-digit login PIN" onSuccess={() => session.unlock()} />
        <p className="xs muted row nowrap" style={{ margin: 0 }}><ShieldCheck size={16} aria-hidden="true" />No real money, bank or UPI account is used in this demo.</p>
      </section>
    </div>
  );
}

/** ~8 s opening: flat tiles pop in, shuffle in waves, gather into the petal logo, then three short lines. Skippable. */
export function Intro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mosRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState('');
  useEffect(() => {
    const host = ref.current, mos = mosRef.current;
    if (!host || !mos) return;
    const C = ['#2B5BFF', '#8B5CF6', '#FF3D7F', '#FF8A3D', '#FFC861', '#00C2FF', '#43E3B7'];
    const rc = () => C[Math.floor(Math.random() * C.length)];
    const SH: ((a: string, b: string) => string)[] = [
      (a) => `background:radial-gradient(circle,${a} 0 46%,transparent 47%)`,
      (a) => `background:${a};border-radius:100% 0 0 0`,
      (a) => `background:repeating-linear-gradient(90deg,${a} 0 6px,transparent 6px 12px)`,
      (a, b) => `background:radial-gradient(circle at 30% 30%,${a} 0 22%,transparent 23%),radial-gradient(circle at 70% 30%,${b} 0 22%,transparent 23%),radial-gradient(circle at 30% 70%,${b} 0 22%,transparent 23%),radial-gradient(circle at 70% 70%,${a} 0 22%,transparent 23%)`,
      (a) => `background:${a};clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)`,
      (a) => `background:${a};border-radius:50%;clip-path:inset(0 0 50% 0)`,
      (a) => `background:radial-gradient(circle,transparent 0 26%,${a} 27% 46%,transparent 47%)`,
      (a) => `background:${a};clip-path:polygon(0 100%,100% 100%,100% 0)`,
      (a) => `background:repeating-radial-gradient(circle at 50% 100%,${a} 0 5px,transparent 5px 10px)`,
      (a, b) => `background:linear-gradient(90deg,${a} 0 50%,${b} 50%);border-radius:0 100% 0 100%`,
      (a) => `background:${a};border-radius:50% 50% 0 0`,
    ];
    const shape = (sp: HTMLElement) => { sp.style.cssText = SH[Math.floor(Math.random() * SH.length)](rc(), rc()); };
    const R = host.getBoundingClientRect();
    const W = R.width, H = R.height, cell = 74;
    const cols = Math.max(4, Math.round(W / cell)), rows = Math.max(7, Math.round(H / cell));
    mos.style.gridTemplateColumns = `repeat(${cols},1fr)`; mos.style.gridTemplateRows = `repeat(${rows},1fr)`;
    const tiles: HTMLDivElement[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const d = Math.hypot((c - (cols - 1) / 2) / (cols / 2), (r - (rows - 1) / 2) / (rows / 2)) / Math.SQRT2;
      const t = document.createElement('div'); t.className = 'tile';
      t.style.setProperty('--d', Math.round(d * 700) + 'ms'); t.style.setProperty('--o', Math.round((1 - d) * 260) + 'ms');
      t.style.background = Math.random() < 0.22 ? rc() + '33' : '#0D0F1E';
      const sp = document.createElement('span'); shape(sp); t.appendChild(sp); mos.appendChild(t); tiles.push(t);
    }
    requestAnimationFrame(() => {
      const cx = R.left + W / 2, cy = R.top + H / 2;
      tiles.forEach((t) => { const r = t.getBoundingClientRect(); t.style.setProperty('--tx', cx - r.left - r.width / 2 + 'px'); t.style.setProperty('--ty', cy - r.top - r.height / 2 + 'px'); });
    });
    // shuffle in diagonal waves, like a flip board
    let rot = 0, wave = 0;
    const shuffle = setInterval(() => {
      rot += 90; wave = (wave + 1) % (cols + rows);
      tiles.forEach((t, i) => { const r = Math.floor(i / cols), c = i % cols; if ((r + c) % (cols + rows) === wave || Math.random() < 0.08) { const sp = t.firstChild as HTMLElement; shape(sp); sp.style.transform = `rotate(${rot}deg)`; } });
    }, 130);
    const ts = [
      setTimeout(() => clearInterval(shuffle), 3300),
      setTimeout(() => setPhase('collapse'), 3400),
      setTimeout(() => setPhase('collapse bloomed'), 3800),
      setTimeout(() => setPhase('collapse bloomed told'), 5000),
      setTimeout(() => setPhase('collapse bloomed told fade'), 7700),
      setTimeout(onDone, 8300),
    ];
    return () => { clearInterval(shuffle); ts.forEach(clearTimeout); };
  }, []);
  return (
    <div ref={ref} className={`splash ${phase}`}>
      <div ref={mosRef} className="mos" aria-hidden="true" />
      <div className="bloom" aria-hidden="true"><Logo size={120} /><div className="wm">Zetheta</div><div className="tl2">Payments for everyone</div></div>
      <div className="lines" aria-hidden="true"><span>Pay <i>anyone</i>.</span><span>Book <i>anything</i>.</span><span>Built for <i>everyone</i>.</span></div>
      <div className="bar2" aria-hidden="true"><i /></div>
      <Btn variant="quiet" size="sm" className="skipbtn" onClick={onDone}>Skip intro</Btn>
    </div>
  );
}
