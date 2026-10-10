import { Banknote, Bell, Bike, Building2, Bus, CalendarHeart, Car, Clapperboard, Gift, History, Home, Hotel, Landmark, Lightbulb, Plane, QrCode, Receipt, Send, Settings, ShieldCheck, ShoppingBag, Smartphone, Sparkles, Ticket, Train, User, UtensilsCrossed, Wallet, Accessibility, BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';

export interface NavItem { label: string; path: string; icon: ReactNode; match?: string[] }
export const SIDEBAR: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ label: 'Home', path: '/', icon: <Home /> }] },
  { group: 'Payments', items: [
    { label: 'Scan & Pay', path: '/scan', icon: <QrCode /> },
    { label: 'Send money', path: '/send', icon: <Send /> },
    { label: 'Receive money', path: '/receive', icon: <Wallet /> },
    { label: 'Bills & recharge', path: '/bills', icon: <Receipt /> },
    { label: 'History', path: '/history', icon: <History />, match: ['/txn', '/insights'] },
  ] },
  { group: 'Book & order', items: [
    { label: 'Travel', path: '/travel', icon: <Plane /> },
    { label: 'Movies & events', path: '/fun', icon: <Clapperboard /> },
    { label: 'Food', path: '/food', icon: <UtensilsCrossed />, match: ['/order'] },
    { label: 'Shopping', path: '/shop', icon: <ShoppingBag /> },
    { label: 'Local transport', path: '/transport', icon: <Bus /> },
    { label: 'My bookings', path: '/bookings', icon: <Ticket />, match: ['/booking', '/validate'] },
  ] },
  { group: 'You', items: [
    { label: 'Offers & rewards', path: '/rewards', icon: <Gift />, match: ['/offers'] },
    { label: 'Accessibility', path: '/a11y', icon: <Accessibility /> },
    { label: 'Profile & settings', path: '/profile', icon: <Settings /> },
    { label: 'Judge walkthrough', path: '/guide', icon: <BookOpen /> },
  ] },
];
export const BOTTOM: NavItem[] = [
  { label: 'Home', path: '/', icon: <Home /> },
  { label: 'Payments', path: '/pay', icon: <Send />, match: ['/send', '/receive', '/scan', '/history', '/txn', '/bills', '/bank'] },
  { label: 'Bookings', path: '/bookings', icon: <Ticket />, match: ['/travel', '/fun', '/booking', '/food', '/order', '/shop', '/transport', '/validate'] },
  { label: 'Rewards', path: '/rewards', icon: <Gift />, match: ['/offers'] },
  { label: 'Profile', path: '/profile', icon: <User />, match: ['/a11y', '/guide', '/notifications', '/wallet'] },
];
export const QUICK = [
  { label: 'Scan & Pay', path: '/scan', icon: <QrCode /> },
  { label: 'Send money', path: '/send', icon: <Send /> },
  { label: 'Receive', path: '/receive', icon: <Wallet /> },
  { label: 'Bank transfer', path: '/bank', icon: <Landmark /> },
  { label: 'Recharge', path: '/bills?t=mob', icon: <Smartphone /> },
  { label: 'Pay bills', path: '/bills', icon: <Receipt /> },
];
export const SERVICES = [
  { label: 'Travel', sub: 'All trips', path: '/travel', icon: <Sparkles />, color: '#0A5C4E' },
  { label: 'Flights', sub: 'Domestic', path: '/travel/flights', icon: <Plane />, color: '#1D4ED8' },
  { label: 'Trains', sub: 'PNR tickets', path: '/travel/trains', icon: <Train />, color: '#B45309' },
  { label: 'Buses', sub: 'Pick seats', path: '/travel/buses', icon: <Bus />, color: '#BE123C' },
  { label: 'Hotels', sub: 'Stays', path: '/travel/hotels', icon: <Hotel />, color: '#6D28D9' },
  { label: 'Movies', sub: 'Book seats', path: '/fun?k=movie', icon: <Clapperboard />, color: '#BE185D' },
  { label: 'Events', sub: 'Live shows', path: '/fun?k=event', icon: <CalendarHeart />, color: '#C2410C' },
  { label: 'Food', sub: 'Order in', path: '/food', icon: <UtensilsCrossed />, color: '#D93B2B' },
  { label: 'Shopping', sub: 'Essentials', path: '/shop', icon: <ShoppingBag />, color: '#0E7490' },
  { label: 'Local transport', sub: 'Metro · rides', path: '/transport', icon: <Car />, color: '#0369A1' },
  { label: 'Mobile recharge', sub: 'Prepaid', path: '/bills?t=mob', icon: <Smartphone />, color: '#4D7C0F' },
  { label: 'Electricity', sub: 'Utilities', path: '/bills?t=elec', icon: <Lightbulb />, color: '#A16207' },
  { label: 'Insurance', sub: 'Premiums', path: '/bills?t=ins', icon: <ShieldCheck />, color: '#0F766E' },
  { label: 'Parking', sub: 'Pay by hour', path: '/transport?t=parking', icon: <Building2 />, color: '#4338CA' },
  { label: 'Bike & auto', sub: 'Fare estimate', path: '/transport?t=ride', icon: <Bike />, color: '#7E22CE' },
  { label: 'Bank transfer', sub: 'To account', path: '/bank', icon: <Banknote />, color: '#475569' },
];
export const icons = { Bell };
