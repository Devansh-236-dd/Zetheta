import { useMemo } from 'react';
import { ArrowRight, Eye, EyeOff, Info, Plus } from 'lucide-react';
import { QUICK, SERVICES } from '../nav';
import { navigate } from '../router';
import { store, useStore } from '../store';
import { myBalance, pointsBalance } from '../lib/ledger';
import { COUPONS } from '../lib/coupons';
import { formatINR } from '../lib/money';
import { usePay } from '../components/PaySheet';
import { AmountWords, Btn, Ribbon, ripple } from '../components/ui';
import { ICONS } from '../data/icons';
import { TxnRow } from './common';

const OFFER_BG = ['linear-gradient(135deg,#C2410C,#7C2D12)', 'linear-gradient(135deg,#1D4ED8,#3B0764)', 'linear-gradient(135deg,#BE185D,#4C0519)', 'linear-gradient(135deg,#0F766E,#042F2E)', 'linear-gradient(135deg,#4D7C0F,#1A2E05)', 'linear-gradient(135deg,#0369A1,#082F49)'];
const OFFER_TO: Record<string, string> = { FOOD50: '/food', TRAVEL100: '/travel', MOVIE75: '/fun', SHOP10: '/shop', BILL25: '/bills', RIDE20: '/transport' };

export function Home() {
  const bal = useStore(myBalance);
  const hide = useStore((s) => s.settings.hideBalance);
  const pts = useStore(pointsBalance);
  const txns = useStore((s) => s.txns);
  const simple = useStore((s) => s.settings.a11y.simpleNav);
  const { openAddMoney } = usePay();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const recent = useMemo(() => txns.slice(0, 6), [txns]);
  const toggle = () => store.update((s) => ({ ...s, settings: { ...s.settings, hideBalance: !s.settings.hideBalance } }));
  return (
    <>
      <div className="phead"><div className="titles"><div className="eyebrow">{greet}</div><h1 className="h1">Hi, Ramesh</h1></div></div>

      <section className="wallet stg" aria-labelledby="wal-h">
        <Ribbon opts={{ x0: 0.1, y0: 1.35, x1: 1.2, y1: -0.35, bw: 1.0, base: 0.55, n: 72, a: 0.5, amp: 0.1 }} />
        <span className="veil deco" aria-hidden="true" />
        <div className="row between">
          <h2 id="wal-h" className="small" style={{ fontWeight: 700 }}>Zetheta Wallet balance <span className="badge demo" style={{ marginLeft: 6 }}>Demo money</span></h2>
          <span className="small mono" style={{ color: '#DCE2FF' }}>ramesh.k@zetheta</span>
        </div>
        <div className="stack sm" style={{ margin: '14px 0 18px' }}>
          <div className={`bal num ${hide ? 'hid' : ''}`} aria-hidden={hide}>{formatINR(bal)}</div>
          {hide ? <span className="vh">Balance hidden. Use Show balance to reveal it.</span> : <div className="words"><AmountWords p={bal} /></div>}
        </div>
        <div className="row">
          <button type="button" className="glassbtn" aria-pressed={!hide} onPointerDown={ripple} onClick={toggle}>{hide ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}{hide ? 'Show balance' : 'Hide balance'}</button>
          <button type="button" className="glassbtn" onPointerDown={ripple} onClick={() => openAddMoney()}><Plus aria-hidden="true" />Add money</button>
          <button type="button" className="glassbtn" onPointerDown={ripple} onClick={() => navigate('/wallet')}><Info aria-hidden="true" />Wallet details</button>
          <span className="small" style={{ color: '#DCE2FF', marginLeft: 'auto' }}>{pts} reward points</span>
        </div>
      </section>

      <section aria-labelledby="qa-h" className="stack">
        <h2 id="qa-h" className="h2">Quick actions</h2>
        <div className="qa">
          {QUICK.map((q) => <button key={q.label} type="button" className="qab" onPointerDown={ripple} onClick={() => navigate(q.path)} ><span className="i">{q.icon}</span>{q.label}</button>)}
        </div>
      </section>

      <section aria-labelledby="svc-h" className="stack">
        <div className="row between"><h2 id="svc-h" className="h2">Book, order & pay</h2><span className="badge demo">Sample inventory</span></div>
        <div className="svc">
          {(simple ? SERVICES.slice(0, 8) : SERVICES).map((s) => (
            <button key={s.label} type="button" className="svcb" onClick={() => navigate(s.path)} onPointerDown={ripple}>
              {ICONS[s.label] ? <img className="appimg" src={ICONS[s.label]} alt="" width={56} height={56} /> : <span className="i" style={{ background: s.color }}>{s.icon}</span>}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {!simple && (
        <section aria-labelledby="off-h" className="stack advanced">
          <div className="row between"><h2 id="off-h" className="h2">Offers for you</h2><button type="button" className="link" onClick={() => navigate('/rewards')}>All offers</button></div>
          <div className="offers" role="list">
            {COUPONS.filter((c) => c.expiresAt > Date.now() && c.startsAt < Date.now()).map((c, i) => (
              <button type="button" role="listitem" key={c.code} className="offer" style={{ background: OFFER_BG[i % OFFER_BG.length], color: '#fff', borderColor: 'transparent' }} onClick={() => navigate(OFFER_TO[c.code] ?? '/rewards')}>
                <b className="h3">{c.title}</b>
                <span className="small" style={{ color: '#F1F3FF' }}>{c.description}</span>
                <span className="spacer" />
                <span className="row between"><span className="code">{c.code}</span><ArrowRight aria-hidden="true" /></span>
              </button>
            ))}
          </div>
          <p className="xs dim" style={{ margin: 0 }}>Example demo promotions only — no real cashback or discounts.</p>
        </section>
      )}

      <section aria-labelledby="rec-h" className="card">
        <div className="row between"><h2 id="rec-h" className="h2">Recent activity</h2><Btn size="sm" variant="ghost" onClick={() => navigate('/history')}>See all</Btn></div>
        <div className="list">{recent.map((t) => <TxnRow key={t.id} t={t} />)}</div>
      </section>
    </>
  );
}
