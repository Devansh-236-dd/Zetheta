import { ArrowRight, RotateCcw } from 'lucide-react';
import { navigate } from '../router';
import { store } from '../store';
import { Alert, Btn, PageHeader, toast } from '../components/ui';

const SCENARIOS: { n: number; title: string; shows: string; steps: string[]; go: string; cta: string }[] = [
  { n: 1, title: 'Successful transfer', shows: 'Ledger debit + credit, receipt, balance update, screen-reader announcements.', steps: ['Pick Rahul Sharma', 'Tap “₹500 · same as usual” or type an amount', 'Review the bank-name check, tap Pay', 'Enter PIN 1234'], go: '/send?to=u_rahul', cta: 'Send to Rahul' },
  { n: 2, title: 'Insufficient balance', shows: 'Transfers above your balance are blocked with a clear message and an “Add demo money” option.', steps: ['The amount is pre-filled at ₹99,999', 'Tap Continue', 'Read the error; nothing is charged'], go: '/send?to=u_lakshmi&amt=99999', cta: 'Try ₹99,999' },
  { n: 3, title: 'Wrong payment PIN', shows: 'Tries left, “no money has been sent”, 30-second pause after 3 tries, OTP fallback.', steps: ['Start any payment', 'At the PIN step type 0000', 'Repeat to see the pause, then use “one-time code”'], go: '/send?to=u_meera&amt=200', cta: 'Pay Meera ₹200' },
  { n: 4, title: 'Valid QR payment', shows: 'Real QR decode → schema validation → review → PIN → receipt.', steps: ['Open Sample QR codes', 'Scan “Café Monsoon bill” (fixed ₹260)', 'Review and pay with PIN 1234'], go: '/scan', cta: 'Open Scan & Pay' },
  { n: 5, title: 'Invalid QR codes', shows: 'Web links, foreign currency, unknown merchants and tampered codes are refused safely.', steps: ['Open Sample QR codes', 'Scan “Free cashback link” and “Tampered code”', 'Notice the payload is shown as text and never opened'], go: '/scan', cta: 'Test bad QR codes' },
  { n: 6, title: 'Food order', shows: 'Cart, customisation, minimum order, fees, GST, coupon, live order timeline.', steps: ['Add a Thali (choose size) and a Chaas', 'Open cart, check the bill lines', 'Pay with coupon FOOD50, then track the order'], go: '/food/r1', cta: 'Order from Bombay Tiffin Co.' },
  { n: 7, title: 'Ticket booking + validation', shows: 'Seat map, fees, QR ticket, venue validator that admits only once.', steps: ['Pick a showtime and 2 seats', 'Pay with MOVIE75', 'Open the ticket → “Validate at venue” → Admit, then scan again'], go: '/fun/mv1', cta: 'Book Monsoon Express' },
  { n: 8, title: 'Coupon rejection', shows: 'Expired, wrong category, minimum spend and already-used coupons each give a specific reason.', steps: ['Try MONSOON30 (expired)', 'Try FOOD50 on travel (wrong category)', 'Try FOOD50 with ₹150 (minimum spend)'], go: '/rewards', cta: 'Open coupon checker' },
  { n: 9, title: 'Refund simulation', shows: 'Cancelling refunds by policy as a new ledger entry; points earned are reversed.', steps: ['Book a train or flight a few days ahead', 'Open the booking → Cancel', 'See the refund and the original marked “refunded”'], go: '/travel/trains', cta: 'Book a train' },
  { n: 10, title: 'Reward redemption', shows: 'Points ledger, tier progress, redemption that can’t be duplicated.', steps: ['Open Reward points', 'Redeem 100 points', 'Check the wallet credit in History'], go: '/rewards', cta: 'Open rewards' },
];

export function Guide() {
  return (
    <>
      <PageHeader title="Judge walkthrough" sub="Ten deterministic scenarios that cover the whole demo. Each takes under a minute." backTo="/" />
      <Alert kind="info" title="Demo credentials" actions={<Btn variant="quiet" size="sm" icon={<RotateCcw />} onClick={() => { store.reset(); toast('Demo data reset'); }}>Reset demo data</Btn>}>
        Login and payment PIN: <b className="mono">1234</b> (non-production demo PIN). Coupons: <span className="mono">FOOD50 · TRAVEL100 · MOVIE75 · SHOP10 · BILL25 · RIDE20</span>. All money, bookings and notifications are simulated.
      </Alert>
      <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {SCENARIOS.map((s) => (
          <li key={s.n} className="card row" style={{ alignItems: 'flex-start' }}>
            <span className="ticon mono" aria-hidden="true" style={{ fontWeight: 700 }}>{s.n}</span>
            <div className="grow stack sm" style={{ minWidth: 220 }}>
              <h2 className="h3">{s.n}. {s.title}</h2>
              <span className="small muted">{s.shows}</span>
              <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>{s.steps.map((x) => <li key={x}>{x}</li>)}</ol>
            </div>
            <Btn size="sm" icon={<ArrowRight />} onClick={() => navigate(s.go)}>{s.cta}</Btn>
          </li>
        ))}
      </ol>
    </>
  );
}
