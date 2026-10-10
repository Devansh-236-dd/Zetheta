import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bell, Clock, Eye, EyeOff, LogOut, Menu, Search, X } from 'lucide-react';
import { BOTTOM, SERVICES, SIDEBAR } from '../nav';
import { navigate, usePath } from '../router';
import { store, useStore } from '../store';
import { session } from '../session';
import { myBalance, pointsBalance } from '../lib/ledger';
import { COUPONS } from '../lib/coupons';
import { RESTAURANTS, SHOWS } from '../data/catalog';
import { formatINR } from '../lib/money';
import { Btn, Dialog, IconBtn, Logo, Ribbon, toast } from './ui';

const isActive = (path: string, item: { path: string; match?: string[] }) =>
  item.path === '/' ? path === '/' : path.split('?')[0] === item.path.split('?')[0] || path.startsWith(item.path.split('?')[0] + '/') || (item.match ?? []).some((m) => path.startsWith(m));

export function Shell({ children }: { children: ReactNode }) {
  const path = usePath();
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  return (
    <div className="shell">
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <div className="main">
        <header className="topbar">
          <IconBtn label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}><Menu /></IconBtn>
          <button type="button" className="brand" onClick={() => window.dispatchEvent(new Event('zth:intro'))} aria-label="Zetheta — replay intro and go home"><Logo />Zetheta</button>
          <div className="spacer" />
          <IconBtn label="Search" onClick={() => setSearchOpen((v) => !v)} aria-expanded={searchOpen}><Search /></IconBtn>
          <IconBtn label="Notifications" badge={unread} onClick={() => navigate('/notifications')}><Bell /></IconBtn>
          <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        </header>
        <div className="demo-strip" role="note">DEMO MODE · all money and bookings are simulated</div>
        <main id="main" tabIndex={-1} className="content pagein" key={path}>{children}</main>
      </div>
      <nav className="bnav" aria-label="Main">
        {BOTTOM.map((it) => <button key={it.path} type="button" aria-current={isActive(path, it) ? 'page' : undefined} onClick={() => navigate(it.path)}>{it.icon}{it.label}</button>)}
      </nav>
      {menu && <Drawer path={path} onClose={() => setMenu(false)} />}
      <IdleGuard />
    </div>
  );
}

/** Everything that used to live in the desktop sidebar and right-hand panel, as a mobile slide-out menu. */
function Drawer({ path, onClose }: { path: string; onClose: () => void }) {
  const bal = useStore(myBalance);
  const pts = useStore(pointsBalance);
  const hide = useStore((s) => s.settings.hideBalance);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => ref.current?.querySelector<HTMLElement>('button')?.focus(), 30);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); prev?.focus?.(); };
  }, []);
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <div className="drawer-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="row between nowrap">
          <span className="brand"><Logo />Zetheta</span>
          <IconBtn label="Close menu" onClick={onClose}><X /></IconBtn>
        </div>
        <div className="card stack sm drawer-wallet">
          <Ribbon opts={{ n: 40, a: 0.35 }} />
          <span className="veil deco" aria-hidden="true" />
          <div className="eyebrow">Wallet (demo)</div>
          <div className="row between nowrap">
            <b className="h2 num" style={{ filter: hide ? 'blur(8px)' : undefined }} aria-hidden={hide}>{formatINR(bal)}</b>
            {hide && <span className="vh">Balance hidden</span>}
            <IconBtn label={hide ? 'Show balance' : 'Hide balance'} onClick={() => store.update((s) => ({ ...s, settings: { ...s.settings, hideBalance: !hide } }))}>{hide ? <Eye /> : <EyeOff />}</IconBtn>
          </div>
          <div className="small muted">{pts} reward points</div>
          <div className="row"><Btn size="sm" onClick={() => go('/scan')}>Scan & Pay</Btn><Btn size="sm" variant="ghost" onClick={() => go('/wallet')}>Details</Btn></div>
        </div>
        <nav aria-label="All sections">
          {SIDEBAR.map((g) => (
            <div key={g.group || 'top'}>
              {g.group && <div className="navgroup">{g.group}</div>}
              {g.items.map((it) => <button key={it.path} type="button" className="navlink" aria-current={isActive(path, it) ? 'page' : undefined} onClick={() => go(it.path)}>{it.icon}{it.label}</button>)}
            </div>
          ))}
        </nav>
        <div className="stack sm">
          <div className="navgroup">Demo offers</div>
          {COUPONS.slice(0, 4).map((c) => (
            <button key={c.code} type="button" className="card click" onClick={() => go('/rewards')}>
              <div className="row between nowrap"><b>{c.title}</b><span className="badge info mono">{c.code}</span></div>
              <div className="xs muted">{c.description}</div>
            </button>
          ))}
        </div>
        <button type="button" className="card click" onClick={() => go('/guide')}>
          <b>Judging? Start here</b>
          <div className="xs muted">Ten guided scenarios: payments, QR, bookings, coupons, refunds and rewards.</div>
        </button>
        <button type="button" className="navlink" onClick={() => { onClose(); session.lock(); toast('Locked. Your demo data is saved.', 'info'); }}><LogOut />Lock app</button>
      </div>
    </div>
  );
}

function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const st = useStore((s) => s);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const out: { label: string; sub: string; to: string }[] = [];
    SERVICES.forEach((s) => { if ((s.label + ' ' + s.sub).toLowerCase().includes(t)) out.push({ label: s.label, sub: 'Service', to: s.path }); });
    SIDEBAR.flatMap((g) => g.items).forEach((s) => { if (s.label.toLowerCase().includes(t) && !out.some((o) => o.to === s.path)) out.push({ label: s.label, sub: 'Page', to: s.path }); });
    st.users.filter((u) => u.id !== st.me && (u.name + u.upi).toLowerCase().includes(t)).forEach((u) => out.push({ label: u.name, sub: `Send money · ${u.upi}`, to: '/send?to=' + u.id }));
    st.merchants.filter((m) => (m.name + m.upi).toLowerCase().includes(t)).forEach((m) => out.push({ label: m.name, sub: `Merchant · ${m.upi}`, to: '/scan' }));
    RESTAURANTS.filter((r) => (r.name + r.cuisine.join(' ')).toLowerCase().includes(t)).forEach((r) => out.push({ label: r.name, sub: `Restaurant · ${r.cuisine.join(', ')}`, to: '/food/' + r.id }));
    SHOWS.filter((s) => (s.title + s.genre).toLowerCase().includes(t)).forEach((s) => out.push({ label: s.title, sub: `${s.kind === 'movie' ? 'Movie' : 'Event'} · ${s.genre}`, to: '/fun/' + s.id }));
    COUPONS.filter((c) => (c.code + c.title).toLowerCase().includes(t)).forEach((c) => out.push({ label: c.code, sub: `Offer · ${c.title}`, to: '/rewards' }));
    st.txns.filter((x) => (x.title + x.counterparty + x.ref).toLowerCase().includes(t)).slice(0, 5).forEach((x) => out.push({ label: x.title, sub: `Transaction · ${formatINR(x.amount)} · ${new Date(x.ts).toLocaleDateString('en-IN')}`, to: '/txn/' + x.id }));
    return out.slice(0, 12);
  }, [q, st]);
  const go = (to: string) => { setQ(''); setFocus(false); onClose(); navigate(to); };
  useEffect(() => { if (open) setTimeout(() => document.getElementById('gs')?.focus(), 30); }, [open]);
  return (
    <div className={`gsearch ${open ? 'open' : ''}`} role="search">
      <Search aria-hidden="true" />
      <label htmlFor="gs" className="vh">Search services, people, restaurants, shows, offers and transactions</label>
      <input id="gs" type="search" value={q} placeholder="Search services, people, food, shows, offers…" onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} aria-controls="gs-results" aria-expanded={focus && results.length > 0} autoComplete="off" onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); onClose(); } if (e.key === 'Enter' && results[0]) go(results[0].to); }} />
      {focus && q.trim().length >= 2 && (
        <div className="gresults" id="gs-results" role="listbox" aria-label="Search results">
          {results.length ? results.map((r, i) => <button key={i} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => go(r.to)}><span className="grow"><b>{r.label}</b><small>{r.sub}</small></span></button>)
            : <div className="small muted" style={{ padding: 12 }}>No matches for “{q}”. Try “food”, “Rahul”, “train” or “FOOD50”.</div>}
        </div>
      )}
      {open && <button type="button" className="vh" onClick={onClose}><X />Close search</button>}
    </div>
  );
}

/** Warns before logging out after inactivity, and lets the user ask for more time. */
function IdleGuard() {
  const minutes = useStore((s) => s.settings.a11y.idleMinutes);
  const [warn, setWarn] = useState(false);
  const [left, setLeft] = useState(60);
  const idle = useRef(0);
  useEffect(() => {
    const reset = () => { if (!warn) idle.current = 0; };
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((e) => window.addEventListener(e, reset, { passive: true }));
    const t = setInterval(() => {
      if (!minutes) return;
      if (warn) {
        setLeft((l) => {
          if (l <= 1) { setWarn(false); session.lock(); toast('Logged out to keep your money safe. Your demo data is saved.', 'info'); return 60; }
          return l - 1;
        });
      } else if (++idle.current >= minutes * 60 - 60) { setWarn(true); setLeft(60); }
    }, 1000);
    return () => { clearInterval(t); ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((e) => window.removeEventListener(e, reset)); };
  }, [minutes, warn]);
  useEffect(() => {
    const h = () => { idle.current = Math.max(0, (minutes || 5) * 60 - 61); };
    window.addEventListener('zth:idle-demo', h);
    return () => window.removeEventListener('zth:idle-demo', h);
  }, [minutes]);
  return (
    <Dialog open={warn} onClose={() => { setWarn(false); idle.current = 0; }} title="Are you still there?">
      <div className="row nowrap"><Clock aria-hidden="true" /><p style={{ margin: 0 }}>For your safety, Zetheta will log you out in <b className="num">{left} seconds</b>. Anything you entered is saved.</p></div>
      <Btn size="lg" block data-autofocus onClick={() => { setWarn(false); idle.current = 0; toast('You have 5 more minutes'); }}>Stay logged in</Btn>
      <Btn variant="quiet" block onClick={() => { setWarn(false); session.lock(); }}>Log out now</Btn>
    </Dialog>
  );
}
