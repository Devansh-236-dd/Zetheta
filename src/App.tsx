import { useEffect, useState, type ReactNode } from 'react';
import { usePath, match, resetTo } from './router';
import { useStore } from './store';
import { useSession } from './session';
import { Shell } from './components/Shell';
import { Login, Intro } from './components/Login';
import { PayProvider } from './components/PaySheet';
import { Announcer, Toasts } from './components/ui';
import { CartProvider } from './cart';
import { Home } from './pages/Home';
import { Send } from './pages/Send';
import { Receive } from './pages/Receive';
import { Scan } from './pages/Scan';
import { History, TxnDetail, Insights } from './pages/History';
import { TravelHub, Trains, Flights, Buses, Hotels } from './pages/Travel';
import { Bookings, BookingDetail, ValidateTicket } from './pages/Bookings';
import { FunList, ShowDetail } from './pages/Fun';
import { FoodList, RestaurantPage, FoodCart, OrderDetail, Orders } from './pages/Food';
import { Shop, ProductPage, ShopCart } from './pages/Shop';
import { Bills } from './pages/Bills';
import { Transport } from './pages/Transport';
import { Rewards } from './pages/Rewards';
import { Profile, A11yCenter, Notifications } from './pages/Profile';
import { Guide } from './pages/Guide';
import { PaymentsHub, WalletPage, BankTransfer, NotFound } from './pages/Misc';

type R = [string, (p: Record<string, string>) => ReactNode];
const ROUTES: R[] = [
  ['/', () => <Home />], ['/pay', () => <PaymentsHub />], ['/wallet', () => <WalletPage />], ['/bank', () => <BankTransfer />],
  ['/send', () => <Send />], ['/receive', () => <Receive />], ['/scan', () => <Scan />],
  ['/history', () => <History />], ['/insights', () => <Insights />], ['/txn/:id', (p) => <TxnDetail id={p.id} />],
  ['/travel', () => <TravelHub />], ['/travel/trains', () => <Trains />], ['/travel/flights', () => <Flights />], ['/travel/buses', () => <Buses />], ['/travel/hotels', () => <Hotels />],
  ['/bookings', () => <Bookings />], ['/booking/:id', (p) => <BookingDetail id={p.id} />], ['/validate', () => <ValidateTicket />],
  ['/fun', () => <FunList />], ['/fun/:id', (p) => <ShowDetail id={p.id} />],
  ['/food', () => <FoodList />], ['/food/cart', () => <FoodCart />], ['/food/:id', (p) => <RestaurantPage id={p.id} />], ['/orders', () => <Orders />], ['/order/:id', (p) => <OrderDetail id={p.id} />],
  ['/shop', () => <Shop />], ['/shop/cart', () => <ShopCart />], ['/shop/:id', (p) => <ProductPage id={p.id} />],
  ['/bills', () => <Bills />], ['/transport', () => <Transport />], ['/rewards', () => <Rewards />], ['/offers', () => <Rewards />],
  ['/profile', () => <Profile />], ['/a11y', () => <A11yCenter />], ['/notifications', () => <Notifications />], ['/guide', () => <Guide />],
];

function useA11yAttributes() {
  const a = useStore((s) => s.settings.a11y);
  useEffect(() => {
    const h = document.documentElement;
    h.dataset.scale = String(a.textScale);
    h.dataset.contrast = a.highContrast ? 'high' : 'normal';
    h.dataset.motion = a.reduceMotion === 'on' || a.srMode ? 'reduce' : a.reduceMotion === 'off' ? 'allow' : 'system';
    h.dataset.sr = a.srMode ? 'on' : 'off';
    h.dataset.simple = a.simpleNav ? 'on' : 'off';
    h.lang = 'en-IN';
  }, [a]);
}

export function App() {
  useA11yAttributes();
  const sess = useSession();
  const path = usePath();
  const clean = path.split('?')[0];
  const [replay, setReplay] = useState(0);
  useEffect(() => { const h = () => setReplay((n) => n + 1); window.addEventListener('zth:intro', h); return () => window.removeEventListener('zth:intro', h); }, []);
  let page: ReactNode = <NotFound />;
  for (const [pat, render] of ROUTES) { const m = match(pat, clean); if (m) { page = render(m); break; } }
  useEffect(() => {
    const t = ROUTES.find(([p]) => match(p, clean))?.[0] ?? '';
    document.title = 'Zetheta' + (t && t !== '/' ? ' · ' + t.split('/')[1].replace(/^\w/, (c) => c.toUpperCase()) : '');
  }, [clean]);
  return (
    <div className="stage">
      <div className="device">
        <div className="scroller" id="scroller">
          <PayProvider>
            <CartProvider>
              {sess.unlocked ? <Shell>{page}</Shell> : <Login />}
              {replay > 0 && <Intro key={replay} onDone={() => { setReplay(0); resetTo('/'); }} />}
              <Toasts />
              <Announcer />
            </CartProvider>
          </PayProvider>
        </div>
      </div>
      <p className="stage-note">Zetheta demo · all money is simulated · PIN 1234</p>
    </div>
  );
}
