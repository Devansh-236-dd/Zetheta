import { useState } from 'react';
import { Compass, Download, Landmark, Plus } from 'lucide-react';
import { QUICK } from '../nav';
import { navigate } from '../router';
import { useStore } from '../store';
import { myBalance, notify, post, SYS_BANK, pointsBalance } from '../lib/ledger';
import { formatINR, parseAmount } from '../lib/money';
import { simpleTotals } from '../lib/pricing';
import { usePay } from '../components/PaySheet';
import { AmountWords, Btn, DemoNote, Empty, Field, Money, PageHeader } from '../components/ui';
import { TxnRow } from './common';
import { downloadStatement } from './History';

export function PaymentsHub() {
  const txns = useStore((s) => s.txns);
  return (
    <>
      <PageHeader title="Payments" sub="Pay, receive and track money." />
      <div className="qa">{QUICK.map((q) => <button key={q.label} type="button" className="qab" onClick={() => navigate(q.path)}><span className="i">{q.icon}</span>{q.label}</button>)}</div>
      <section className="card"><div className="row between"><h2 className="h2">Recent</h2><Btn size="sm" variant="ghost" onClick={() => navigate('/history')}>All history</Btn></div><div className="list">{txns.slice(0, 5).map((t) => <TxnRow key={t.id} t={t} />)}</div></section>
    </>
  );
}

export function WalletPage() {
  const st = useStore((s) => s);
  const bal = myBalance(st);
  const { openAddMoney } = usePay();
  const credits = st.txns.filter((t) => t.direction === 'credit' && t.status !== 'failed').reduce((a, t) => a + t.amount, 0);
  const debits = st.txns.filter((t) => t.direction === 'debit' && t.status !== 'failed').reduce((a, t) => a + t.amount, 0);
  return (
    <>
      <PageHeader title="Wallet details" sub="Your demo wallet and how its balance is calculated." backTo="/" actions={<Btn size="sm" icon={<Plus />} onClick={() => openAddMoney()}>Add money</Btn>} />
      <div className="grid">
        <div className="card stack sm"><span className="eyebrow">Available balance</span><b className="h1 num"><Money p={bal} /></b><AmountWords p={bal} /></div>
        <div className="card stack sm"><span className="eyebrow">Money in (all time)</span><b className="h2 num" style={{ color: 'var(--ok)' }}><Money p={credits} /></b></div>
        <div className="card stack sm"><span className="eyebrow">Money out (all time)</span><b className="h2 num"><Money p={debits} /></b></div>
        <div className="card stack sm"><span className="eyebrow">Reward points</span><b className="h2 num">{pointsBalance(st)}</b></div>
      </div>
      <DemoNote>The balance is not a stored number: it is the sum of {st.entries.filter((e) => e.account === st.me).length} ledger entries for your account, all in whole paise. Every transaction writes a matching debit and credit, so money is never created or lost. Failed payments write no entries.</DemoNote>
      <section className="card"><div className="row between"><h2 className="h2">Recent transactions</h2><Btn size="sm" variant="quiet" icon={<Download />} onClick={() => downloadStatement(st.txns)}>CSV statement</Btn></div><div className="list">{st.txns.slice(0, 8).map((t) => <TxnRow key={t.id} t={t} />)}</div></section>
    </>
  );
}

export function BankTransfer() {
  const bal = useStore(myBalance);
  const { openPay } = usePay();
  const [name, setName] = useState('Ramesh Kumar');
  const [acct, setAcct] = useState('');
  const [acct2, setAcct2] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [amt, setAmt] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const paise = parseAmount(amt || '0') ?? 0;
  const go = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter the account holder’s name.';
    if (!/^\d{9,18}$/.test(acct)) e.acct = 'Account numbers have 9 to 18 digits.';
    if (acct2 !== acct) e.acct2 = 'Account numbers don’t match. Re-enter to confirm.';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) e.ifsc = 'IFSC looks like ABCD0123456 (4 letters, 0, then 6 letters or digits).';
    if (!paise) e.amt = 'Enter an amount.'; else if (paise > bal) e.amt = `Not enough balance (${formatINR(bal)}).`;
    setErrs(e);
    if (Object.keys(e).length) return;
    openPay({
      title: `Bank transfer to ${name.trim()} · A/c ••••${acct.slice(-4)} · ${ifsc}`, payee: { name: name.trim(), color: '#475569', sub: `A/c ••••${acct.slice(-4)} · ${ifsc}` }, category: 'transfer',
      totals: () => simpleTotals('Transfer amount', paise),
      commit: (s, x) => { const r = post(s, { key: x.key, type: 'transfer_out', category: 'transfer', from: s.me, to: SYS_BANK, amount: x.total, title: `Bank transfer to ${name.trim()} (••••${acct.slice(-4)})`, meta: { ifsc, last4: acct.slice(-4) } }); return r.txn.status === 'success' ? { ...r, state: notify(r.state, { kind: 'payment', title: 'Bank transfer sent (simulated)', body: `${formatINR(x.total)} to ••••${acct.slice(-4)}.` }) } : r; },
      onSuccess: () => { setAmt(''); },
    });
  };
  return (
    <>
      <PageHeader title="Bank transfer" sub="Move money from your wallet to a bank account." backTo="/" />
      <DemoNote>Simulated: no bank is contacted and no account details are stored beyond this demo browser. Don’t enter real account numbers.</DemoNote>
      <section className="card stack" style={{ maxWidth: 640 }}>
        <Field label="Account holder name" error={errs.name}>{(id, d) => <input id={id} aria-describedby={d} className="input" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Account number" error={errs.acct}>{(id, d) => <input id={id} aria-describedby={d} className="input mono" inputMode="numeric" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0, 18))} />}</Field>
        <Field label="Re-enter account number" error={errs.acct2}>{(id, d) => <input id={id} aria-describedby={d} className="input mono" inputMode="numeric" value={acct2} onChange={(e) => setAcct2(e.target.value.replace(/\D/g, '').slice(0, 18))} onPaste={(e) => e.preventDefault()} />}</Field>
        <Field label="IFSC code" error={errs.ifsc}>{(id, d) => <input id={id} aria-describedby={d} className="input mono" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} placeholder="DEMO0001234" />}</Field>
        <Field label="Amount (₹)" hint={`Balance ${formatINR(bal)}`} error={errs.amt}>{(id, d) => <input id={id} aria-describedby={d} className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} />}</Field>
        {paise > 0 && <AmountWords p={paise} />}
        <Btn size="lg" icon={<Landmark />} onClick={go}>Review transfer</Btn>
      </section>
    </>
  );
}

export function NotFound() {
  return <Empty icon={<Compass />} title="Page not found" action={<Btn onClick={() => navigate('/')}>Go home</Btn>}>That link doesn’t match anything in the demo.</Empty>;
}
