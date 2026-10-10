import { useState } from 'react';
import { Accessibility, Bell, CheckCircle2, Clock, Lock, QrCode, RotateCcw, ShieldAlert, Type } from 'lucide-react';
import { store, useStore } from '../store';
import { navigate } from '../router';
import { session } from '../session';
import { ledgerIsConsistent, myBalance } from '../lib/ledger';
import type { A11ySettings, Settings } from '../lib/types';
import { formatINR, rs } from '../lib/money';
import { Alert, AmountWords, Avatar, Btn, Dialog, Empty, PageHeader, Seg, Switch, announce, toast } from '../components/ui';
import { fmtDate } from './common';

const setSettings = (p: Partial<Settings>) => store.update((s) => ({ ...s, settings: { ...s.settings, ...p } }));
const setA11y = (p: Partial<A11ySettings>) => store.update((s) => ({ ...s, settings: { ...s.settings, a11y: { ...s.settings.a11y, ...p } } }));

export function Profile() {
  const st = useStore((s) => s);
  const me = st.users.find((u) => u.id === st.me)!;
  const [reset, setReset] = useState(false);
  const ok = ledgerIsConsistent(st);
  return (
    <>
      <PageHeader title="Profile & settings" />
      <section className="card row nowrap">
        <Avatar name={me.name} color={me.color} size="lg" />
        <div className="grow"><b className="h2">{me.name}</b><div className="small muted mono">{me.upi} · {me.phone}</div><div className="small muted">{me.bank} (demo) · KYC: demo account</div></div>
        <Btn variant="ghost" size="sm" icon={<QrCode />} onClick={() => navigate('/receive')}>My QR</Btn>
      </section>
      <div className="grid two" style={{ alignItems: 'start' }}>
        <section className="card stack" aria-labelledby="pp-h">
          <h2 id="pp-h" className="h3">Payment preferences</h2>
          <Switch checked={st.settings.hideBalance} onChange={(v) => setSettings({ hideBalance: v })} label="Hide balance by default" sub="Blurs your balance on the home screen until you tap Show" />
          <div className="field"><span className="lbl">Ask for extra confirmation above</span>
            <Seg label="Large payment threshold" value={String(st.settings.confirmLargeAbove)} onChange={(v) => setSettings({ confirmLargeAbove: +v })} options={[rs(1000), rs(2000), rs(5000)].map((v) => ({ id: String(v), label: formatINR(v) }))} /></div>
          <h2 className="h3" style={{ marginTop: 8 }}><Bell size={18} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Notifications</h2>
          <Switch checked={st.settings.notifyPayments} onChange={(v) => setSettings({ notifyPayments: v })} label="Payment and booking updates" sub="In-app only — the demo never sends SMS, email or push" />
          <Switch checked={st.settings.notifyOffers} onChange={(v) => setSettings({ notifyOffers: v })} label="Offer and coupon reminders" />
        </section>
        <section className="card stack" aria-labelledby="ss-h">
          <h2 id="ss-h" className="h3"><Clock size={18} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Session</h2>
          <div className="field"><span className="lbl">Log out after inactivity</span>
            <Seg label="Idle timeout" value={String(st.settings.a11y.idleMinutes)} onChange={(v) => setA11y({ idleMinutes: +v as A11ySettings['idleMinutes'] })} options={[{ id: '2', label: '2 min' }, { id: '5', label: '5 min' }, { id: '10', label: '10 min' }, { id: '0', label: 'Never' }]} /></div>
          <span className="small muted">You always get a 60-second warning with a “Stay logged in” button.</span>
          <div className="row">
            <Btn variant="quiet" icon={<Clock />} disabled={!st.settings.a11y.idleMinutes} onClick={() => { window.dispatchEvent(new Event('zth:idle-demo')); toast('Warning will appear in about a second', 'info'); }}>Show timeout warning now</Btn>
            <Btn variant="quiet" icon={<Lock />} onClick={() => session.lock()}>Lock app</Btn>
          </div>
          <h2 className="h3" style={{ marginTop: 8 }}><ShieldAlert size={18} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Demo tools</h2>
          <Switch checked={st.settings.simulateFailureNext} onChange={(v) => setSettings({ simulateFailureNext: v })} label="Make the next payment fail" sub="Shows the failure state. The wallet is not charged." />
          <div className="row small">{ok ? <CheckCircle2 color="#5BE49B" aria-hidden="true" /> : <ShieldAlert color="#FF8F87" aria-hidden="true" />}<span>Ledger check: {ok ? 'every transaction balances to zero' : 'inconsistency found'} · {st.txns.length} transactions · balance {formatINR(myBalance(st))}</span></div>
          <Btn variant="danger" icon={<RotateCcw />} onClick={() => setReset(true)}>Reset demo data</Btn>
        </section>
      </div>
      <button type="button" className="card click row nowrap" onClick={() => navigate('/a11y')}><Accessibility aria-hidden="true" /><span className="grow"><b>Accessibility Center</b><span className="small muted" style={{ display: 'block' }}>Text size, reduced motion, high contrast, screen-reader mode, simpler navigation</span></span></button>
      <Dialog open={reset} onClose={() => setReset(false)} title="Reset all demo data?">
        <p style={{ margin: 0 }}>This restores the starting balance, sample history and coupons, and removes your bookings and orders. It only affects this browser.</p>
        <Btn variant="danger" size="lg" block data-autofocus onClick={() => { store.reset(); try { localStorage.removeItem('zetheta-carts'); } catch { /* ignore */ } setReset(false); toast('Demo data reset'); announce('Demo data reset.'); navigate('/'); }}>Reset demo data</Btn>
        <Btn variant="quiet" block onClick={() => setReset(false)}>Cancel</Btn>
      </Dialog>
    </>
  );
}

export function A11yCenter() {
  const a = useStore((s) => s.settings.a11y);
  return (
    <>
      <PageHeader title="Accessibility Center" sub="Make Zetheta easier to see, hear and use. Changes apply straight away and are saved." backTo="/profile" />
      <div className="grid two" style={{ alignItems: 'start' }}>
        <section className="card stack" aria-labelledby="ac1">
          <h2 id="ac1" className="h3"><Type size={18} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Text and display</h2>
          <div className="field"><span className="lbl">Text size</span><Seg label="Text size" value={String(a.textScale)} onChange={(v) => setA11y({ textScale: +v as A11ySettings['textScale'] })} options={[{ id: '100', label: '100%' }, { id: '125', label: '125%' }, { id: '150', label: '150%' }, { id: '200', label: '200%' }]} /></div>
          <Switch checked={a.highContrast} onChange={(v) => setA11y({ highContrast: v })} label="High contrast" sub="Pure black and white with solid borders" />
          <div className="field"><span className="lbl">Motion</span><Seg label="Motion" value={a.reduceMotion} onChange={(v) => setA11y({ reduceMotion: v })} options={[{ id: 'system', label: 'Follow device' }, { id: 'on', label: 'Reduce motion' }, { id: 'off', label: 'Allow motion' }]} /></div>
        </section>
        <section className="card stack" aria-labelledby="ac2">
          <h2 id="ac2" className="h3"><Accessibility size={18} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Screen reader and navigation</h2>
          <Switch checked={a.srMode} onChange={(v) => setA11y({ srMode: v })} label="Screen-reader friendly mode" sub="Hides decorative animation and keeps announcements short and clear" />
          <Switch checked={a.simpleNav} onChange={(v) => setA11y({ simpleNav: v })} label="Simplified navigation" sub="Fewer tiles on the home screen, no offer carousel" />
          <Switch checked={a.hindiAmounts} onChange={(v) => setA11y({ hindiAmounts: v })} label="Show amounts in Hindi words" sub="₹1,50,000 → एक लाख पचास हज़ार रुपये" />
        </section>
      </div>
      <section className="card stack" aria-labelledby="ac3">
        <h2 id="ac3" className="h3">Preview</h2>
        <div className="row"><b className="h1 num">{formatINR(rs(150000))}</b><AmountWords p={rs(150000)} /></div>
        <Alert kind="ok" title="Payment successful">Success, warning and error messages always use an icon and words, never colour alone.</Alert>
        <p className="small muted" style={{ margin: 0 }}>Everything works with a keyboard: Tab to move, Enter or Space to press, Esc to close dialogs. All buttons are at least 48 px tall. No action needs swiping.</p>
      </section>
    </>
  );
}

export function Notifications() {
  const list = useStore((s) => s.notifications);
  return (
    <>
      <PageHeader title="Notifications" sub="In-app demo notifications. No SMS, email or push messages are sent." backTo="/" actions={<Btn variant="quiet" size="sm" onClick={() => store.update((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }))}>Mark all as read</Btn>} />
      {list.length === 0 ? <Empty icon={<Bell />} title="No notifications" /> : (
        <div className="card"><div className="list">{list.map((n) => (
          <div key={n.id} className="li" style={!n.read ? { background: 'var(--accent-bg)', borderRadius: 12, paddingLeft: 12 } : undefined}>
            <span className="t"><b style={{ whiteSpace: 'normal' }}>{!n.read && <span className="vh">Unread: </span>}{n.title}</b><small style={{ whiteSpace: 'normal' }}>{n.body}</small><small>{fmtDate(n.ts)}</small></span>
            {!n.read && <span className="badge info">New</span>}
          </div>
        ))}</div></div>
      )}
    </>
  );
}
