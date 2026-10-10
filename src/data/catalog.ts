/**
 * Demo catalogue. Every name, schedule, price and venue here is SAMPLE DATA invented for the demo.
 * Nothing is live inventory and no real company's service is implied.
 */
import type { Paise } from '../lib/money';
import { rs } from '../lib/money';
import { seeded } from '../lib/ids';

/* ---------------- travel ---------------- */
export const STATIONS = [
  { code: 'CSMT', name: 'Mumbai CSMT', city: 'Mumbai', x: 0, y: 0 },
  { code: 'NDLS', name: 'New Delhi', city: 'Delhi', x: 2, y: 13 },
  { code: 'PUNE', name: 'Pune Jn', city: 'Pune', x: 2, y: -1 },
  { code: 'SBC', name: 'Bengaluru City', city: 'Bengaluru', x: 6, y: -9 },
  { code: 'MAS', name: 'Chennai Central', city: 'Chennai', x: 11, y: -9 },
  { code: 'HWH', name: 'Howrah', city: 'Kolkata', x: 19, y: 5 },
  { code: 'ADI', name: 'Ahmedabad', city: 'Ahmedabad', x: -1, y: 5 },
  { code: 'JP', name: 'Jaipur', city: 'Jaipur', x: 1, y: 10 },
  { code: 'RNC', name: 'Ranchi', city: 'Ranchi', x: 15, y: 6 },
];
export const AIRPORTS = [
  { code: 'BOM', city: 'Mumbai', x: 0, y: 0 }, { code: 'DEL', city: 'Delhi', x: 2, y: 13 }, { code: 'BLR', city: 'Bengaluru', x: 6, y: -9 },
  { code: 'MAA', city: 'Chennai', x: 11, y: -9 }, { code: 'CCU', city: 'Kolkata', x: 19, y: 5 }, { code: 'HYD', city: 'Hyderabad', x: 7, y: -4 },
  { code: 'GOI', city: 'Goa', x: 1, y: -6 }, { code: 'IXR', city: 'Ranchi', x: 15, y: 6 }, { code: 'AMD', city: 'Ahmedabad', x: -1, y: 5 },
];
export const BUS_CITIES = ['Mumbai', 'Pune', 'Goa', 'Nashik', 'Surat', 'Bengaluru', 'Hyderabad', 'Ranchi', 'Jamshedpur'];
const BUS_XY: Record<string, [number, number]> = { Mumbai: [0, 0], Pune: [2, -1], Goa: [1, -6], Nashik: [2, 2], Surat: [-1, 3], Bengaluru: [6, -9], Hyderabad: [7, -4], Ranchi: [15, 6], Jamshedpur: [16, 5] };

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 110));
const hm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const dur = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

export const TRAIN_CLASSES = [
  { id: 'SL', label: 'Sleeper (SL)', perKm: 55 }, { id: '3A', label: 'AC 3 Tier (3A)', perKm: 145 },
  { id: '2A', label: 'AC 2 Tier (2A)', perKm: 210 }, { id: 'CC', label: 'AC Chair Car (CC)', perKm: 120 },
] as const;
const TRAIN_NAMES = ['Sahyadri Demo Express', 'Konkan Demo Superfast', 'Zetheta Demo Mail', 'Deccan Demo Queen', 'Coastal Demo Express', 'Ganga Demo Link', 'Western Demo Duronto'];

export interface TrainResult { id: string; number: string; name: string; from: string; to: string; dep: string; arr: string; duration: string; km: number; fare: Paise; seats: number; status: string }
export function searchTrains(from: string, to: string, date: string, cls: string): TrainResult[] {
  const a = STATIONS.find((s) => s.code === from), b = STATIONS.find((s) => s.code === to);
  if (!a || !b || a === b) return [];
  const km = dist(a, b), rnd = seeded(`${from}${to}${date}${cls}`), perKm = TRAIN_CLASSES.find((c) => c.id === cls)?.perKm ?? 100;
  return Array.from({ length: 5 }, (_, i) => {
    const depM = Math.floor(rnd() * 1380), mins = Math.round((km / (55 + rnd() * 25)) * 60);
    const seats = Math.floor(rnd() * 90);
    const fare = Math.max(rs(120), Math.round((km * perKm) / 100) * 100);
    return { id: `T${i}`, number: String(10001 + Math.floor(rnd() * 89000)), name: TRAIN_NAMES[Math.floor(rnd() * TRAIN_NAMES.length)], from, to, dep: hm(depM), arr: hm(depM + mins) + (depM + mins >= 1440 ? ' +1' : ''), duration: dur(mins), km, fare, seats, status: seats > 20 ? `Available ${seats}` : seats > 0 ? `RAC ${seats}` : 'Waitlist 12' };
  }).sort((x, y) => x.dep.localeCompare(y.dep));
}

const AIRLINES = [{ name: 'Zephyr Air', code: 'ZR', color: '#2B5BFF' }, { name: 'IndiFly Demo', code: 'IF', color: '#C2410C' }, { name: 'SkyMitra', code: 'SM', color: '#0F766E' }, { name: 'Konkan Air (demo)', code: 'KA', color: '#7C3AED' }];
export interface FlightResult { id: string; airline: string; code: string; color: string; flightNo: string; from: string; to: string; dep: string; arr: string; duration: string; stops: string; fare: Paise; seatsLeft: number }
export function searchFlights(from: string, to: string, date: string, cabin: 'economy' | 'business'): FlightResult[] {
  const a = AIRPORTS.find((x) => x.code === from), b = AIRPORTS.find((x) => x.code === to);
  if (!a || !b || a === b) return [];
  const km = dist(a, b), rnd = seeded(`${from}${to}${date}${cabin}`);
  return Array.from({ length: 6 }, (_, i) => {
    const al = AIRLINES[Math.floor(rnd() * AIRLINES.length)], depM = 300 + Math.floor(rnd() * 1080), stop = rnd() < 0.25;
    const mins = Math.round(45 + km / 12) + (stop ? 90 : 0);
    const base = Math.round((2200 + km * 4.2 + rnd() * 2600) / 10) * 10;
    return { id: `F${i}`, airline: al.name, code: al.code, color: al.color, flightNo: `${al.code}-${100 + Math.floor(rnd() * 899)}`, from, to, dep: hm(depM), arr: hm(depM + mins), duration: dur(mins), stops: stop ? '1 stop' : 'Non-stop', fare: rs(cabin === 'business' ? base * 3 : base), seatsLeft: 1 + Math.floor(rnd() * 9) };
  }).sort((x, y) => x.fare - y.fare);
}

const OPERATORS = ['Zetheta Demo Travels', 'Shivneri Demo Lines', 'Neeta-style Demo Coaches', 'GreenLine Demo', 'Jharkhand Demo Roadways'];
export interface BusResult { id: string; operator: string; type: string; from: string; to: string; dep: string; arr: string; duration: string; fare: Paise; boarding: string[]; drops: string[]; booked: number[] }
export function searchBuses(from: string, to: string, date: string): BusResult[] {
  const a = BUS_XY[from], b = BUS_XY[to];
  if (!a || !b || from === to) return [];
  const km = Math.max(60, Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) * 110)), rnd = seeded(`${from}${to}${date}bus`);
  return Array.from({ length: 4 }, (_, i) => {
    const depM = 1080 + Math.floor(rnd() * 330), mins = Math.round((km / 50) * 60), ac = rnd() < 0.6;
    const booked = Array.from({ length: 30 }, (_, k) => k).filter(() => rnd() < 0.35);
    return { id: `B${i}`, operator: OPERATORS[Math.floor(rnd() * OPERATORS.length)], type: ac ? 'AC Sleeper (2+1)' : 'Non-AC Seater (2+1)', from, to, dep: hm(depM), arr: hm(depM + mins) + (depM + mins >= 1440 ? ' +1' : ''), duration: dur(mins), fare: rs(Math.round((km * (ac ? 2.1 : 1.3)) / 10) * 10 + 150), boarding: [`${from} Central Bus Stand`, `${from} Highway Junction`, `${from} Station Road`], drops: [`${to} Main Bus Stand`, `${to} City Centre`], booked };
  });
}

export const HOTEL_CITIES = ['Mumbai', 'Goa', 'Jaipur', 'Bengaluru', 'Delhi', 'Ranchi'];
const HOTEL_NAMES = ['The Saffron Courtyard', 'Harbour Lights Inn', 'Banyan Grove Retreat', 'Monsoon Palms', 'Indigo Terrace Hotel', 'The Clocktower Residency'];
export interface HotelResult { id: string; name: string; area: string; rating: number; reviews: number; amenities: string[]; rooms: { id: string; name: string; rate: Paise; refundable: boolean }[]; color: string }
export function searchHotels(city: string, checkIn: string): HotelResult[] {
  const rnd = seeded(`${city}${checkIn}hotel`), areas = ['City Centre', 'Old Town', 'Lakeside', 'Near Airport', 'Beachfront', 'Business District'];
  const colors = ['#6B2FA0', '#0F6B5F', '#9A3F14', '#1F4E99', '#9C2A5A', '#4D7C0F'];
  return HOTEL_NAMES.map((n, i) => {
    const base = 1800 + Math.floor(rnd() * 6200);
    return { id: `H${i}`, name: `${n}, ${city}`, area: areas[Math.floor(rnd() * areas.length)], rating: Math.round((3.6 + rnd() * 1.3) * 10) / 10, reviews: 40 + Math.floor(rnd() * 900), amenities: ['Free Wi-Fi', 'Breakfast', 'Pool', 'Wheelchair access', 'Airport shuttle', 'Gym'].filter(() => rnd() < 0.6), color: colors[i],
      rooms: [{ id: 'std', name: 'Standard room', rate: rs(Math.round(base / 10) * 10), refundable: true }, { id: 'dlx', name: 'Deluxe room', rate: rs(Math.round((base * 1.45) / 10) * 10), refundable: true }, { id: 'nr', name: 'Standard — non-refundable saver', rate: rs(Math.round((base * 0.82) / 10) * 10), refundable: false }] };
  }).sort((a, b) => b.rating - a.rating);
}

/* ---------------- entertainment ---------------- */
export const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Ranchi'];
export interface Show { id: string; kind: 'movie' | 'event'; title: string; genre: string; lang: string; rating: string; mins: number; city: string[]; venue: string; price: Paise; blurb: string; hue: number; dates: number[]; times: string[]; accessible: boolean }
export const SHOWS: Show[] = [
  { id: 'mv1', kind: 'movie', title: 'Monsoon Express', genre: 'Drama', lang: 'Hindi', rating: 'U/A 13+', mins: 142, city: CITIES, venue: 'Zetheta Cinemas — Screen 2', price: rs(220), blurb: 'A train guard and a runaway poet cross the Western Ghats in one rainy night.', hue: 230, dates: [0, 1, 2, 3], times: ['10:15', '13:40', '18:30', '21:50'], accessible: true },
  { id: 'mv2', kind: 'movie', title: 'The Last Lighthouse', genre: 'Thriller', lang: 'English', rating: 'A', mins: 118, city: CITIES, venue: 'Zetheta Cinemas — Screen 4', price: rs(260), blurb: 'A keeper on a Konkan island finds the light still flashing a code nobody sent.', hue: 200, dates: [0, 1, 2, 3, 4], times: ['11:00', '15:20', '19:10', '22:30'], accessible: true },
  { id: 'mv3', kind: 'movie', title: 'Galaxy Gully Cricket', genre: 'Animation · Family', lang: 'Hindi, Tamil', rating: 'U', mins: 104, city: CITIES, venue: 'Zetheta Cinemas — Screen 1', price: rs(180), blurb: 'Kids from a Mumbai chawl play a cricket match against aliens. Winner keeps the moon.', hue: 280, dates: [0, 1, 2, 3, 4, 5], times: ['09:30', '12:15', '16:00'], accessible: true },
  { id: 'mv4', kind: 'movie', title: 'Kaagaz Ke Sapne', genre: 'Romance', lang: 'Hindi', rating: 'U/A 7+', mins: 131, city: ['Mumbai', 'Delhi', 'Pune'], venue: 'Zetheta Cinemas — Screen 3', price: rs(200), blurb: 'Two origami artists fold their way through a city that never stops moving.', hue: 330, dates: [0, 1, 2], times: ['14:00', '20:45'], accessible: false },
  { id: 'ev1', kind: 'event', title: 'Harbour Lights Indie Night', genre: 'Music · Live', lang: 'Multi-language', rating: '16+', mins: 180, city: ['Mumbai'], venue: 'Harbour Arena, Mumbai (demo venue)', price: rs(799), blurb: 'Five independent bands, one sea-facing stage. Standing and seated zones.', hue: 260, dates: [2, 9], times: ['19:00'], accessible: true },
  { id: 'ev2', kind: 'event', title: 'Laugh Lab: Stand-up Saturday', genre: 'Comedy', lang: 'Hinglish', rating: '18+', mins: 90, city: ['Mumbai', 'Bengaluru', 'Pune'], venue: 'Courtyard Stage (demo venue)', price: rs(499), blurb: 'Four new comics test their sharpest five minutes.', hue: 30, dates: [1, 8], times: ['20:00'], accessible: true },
  { id: 'ev3', kind: 'event', title: 'Design + Code Summit', genre: 'Conference', lang: 'English', rating: 'All ages', mins: 420, city: ['Bengaluru', 'Mumbai'], venue: 'Lotus Convention Centre (demo venue)', price: rs(1499), blurb: 'Talks and workshops on accessible fintech, from people who ship it.', hue: 160, dates: [5], times: ['09:30'], accessible: true },
  { id: 'ev4', kind: 'event', title: 'Chhau Dance Evening', genre: 'Culture · Dance', lang: '—', rating: 'All ages', mins: 120, city: ['Ranchi', 'Delhi'], venue: 'Jharkhand Kala Mandap (demo venue)', price: rs(299), blurb: 'Masked dance traditions of eastern India, with live percussion.', hue: 12, dates: [3, 4], times: ['18:30'], accessible: true },
];
export const SEAT_ROWS = [
  { rows: ['A', 'B'], label: 'Recliner', mult: 2.2 },
  { rows: ['C', 'D', 'E', 'F'], label: 'Prime', mult: 1.3 },
  { rows: ['G', 'H', 'J'], label: 'Classic', mult: 1 },
];
export const bookedSeats = (key: string) => { const rnd = seeded(key); const s = new Set<string>(); SEAT_ROWS.flatMap((g) => g.rows).forEach((r) => { for (let i = 1; i <= 12; i++) if (rnd() < 0.28) s.add(r + i); }); return s; };
export const EVENT_ZONES = [{ id: 'ga', label: 'General admission', mult: 1 }, { id: 'gold', label: 'Gold (seated)', mult: 1.8 }, { id: 'acc', label: 'Accessible seating (with companion seat)', mult: 1 }];

/* ---------------- food ---------------- */
export interface MenuItem { id: string; name: string; price: Paise; veg: boolean; desc: string; options?: { id: string; label: string; price: Paise }[]; size?: { id: string; label: string; price: Paise }[]; bestseller?: boolean }
export interface Restaurant { id: string; name: string; cuisine: string[]; rating: number; eta: number; costForTwo: Paise; minOrder: Paise; deliveryFee: Paise; packaging: Paise; veg: boolean; hue: number; tag?: string; menu: MenuItem[] }
export const RESTAURANTS: Restaurant[] = [
  { id: 'r1', name: 'Bombay Tiffin Co.', cuisine: ['North Indian', 'Thali'], rating: 4.4, eta: 28, costForTwo: rs(450), minOrder: rs(149), deliveryFee: rs(29), packaging: rs(15), veg: true, hue: 30, tag: 'Pure veg', menu: [
    { id: 'i1', name: 'Mini Maharashtrian Thali', price: rs(219), veg: true, desc: 'Varan bhaat, bhaji, 2 chapati, koshimbir, gulab jamun.', bestseller: true, size: [{ id: 'reg', label: 'Regular', price: 0 }, { id: 'lg', label: 'Large', price: rs(70) }] },
    { id: 'i2', name: 'Misal Pav', price: rs(129), veg: true, desc: 'Spicy sprout curry, farsan, onion, 2 pav.', options: [{ id: 'xpav', label: 'Extra pav', price: rs(20) }, { id: 'curd', label: 'Dahi', price: rs(25) }] },
    { id: 'i3', name: 'Paneer Butter Masala', price: rs(239), veg: true, desc: 'Cottage cheese in a buttery tomato gravy.', options: [{ id: 'nan', label: 'Butter naan', price: rs(45) }] },
    { id: 'i4', name: 'Masala Chaas', price: rs(49), veg: true, desc: 'Spiced buttermilk.' },
    { id: 'i5', name: 'Shrikhand (100g)', price: rs(79), veg: true, desc: 'Saffron and cardamom strained yoghurt.' },
  ] },
  { id: 'r2', name: 'Spice Route Biryani', cuisine: ['Biryani', 'Mughlai'], rating: 4.2, eta: 35, costForTwo: rs(600), minOrder: rs(199), deliveryFee: rs(39), packaging: rs(20), veg: false, hue: 12, tag: 'Bestseller', menu: [
    { id: 'i1', name: 'Chicken Dum Biryani', price: rs(289), veg: false, desc: 'Slow-cooked basmati, raita, salan.', bestseller: true, size: [{ id: 'half', label: 'Half', price: 0 }, { id: 'full', label: 'Full', price: rs(140) }] },
    { id: 'i2', name: 'Veg Dum Biryani', price: rs(229), veg: true, desc: 'Seasonal vegetables, saffron rice.', size: [{ id: 'half', label: 'Half', price: 0 }, { id: 'full', label: 'Full', price: rs(110) }] },
    { id: 'i3', name: 'Mutton Seekh Kebab', price: rs(329), veg: false, desc: '4 pieces, mint chutney.' },
    { id: 'i4', name: 'Phirni', price: rs(89), veg: true, desc: 'Chilled rice pudding.' },
  ] },
  { id: 'r3', name: 'Green Bowl Salads', cuisine: ['Healthy', 'Salads'], rating: 4.5, eta: 22, costForTwo: rs(500), minOrder: rs(249), deliveryFee: rs(25), packaging: rs(10), veg: true, hue: 140, menu: [
    { id: 'i1', name: 'Millet Power Bowl', price: rs(279), veg: true, desc: 'Foxtail millet, roasted veg, hummus.', options: [{ id: 'tofu', label: 'Add tofu', price: rs(60) }, { id: 'feta', label: 'Add feta', price: rs(70) }] },
    { id: 'i2', name: 'Thai Peanut Crunch Salad', price: rs(259), veg: true, desc: 'Cabbage, carrot, peanuts, lime dressing.' },
    { id: 'i3', name: 'Cold-pressed ABC juice', price: rs(149), veg: true, desc: 'Apple, beetroot, carrot.' },
  ] },
  { id: 'r4', name: 'Pizza Forno Napoli', cuisine: ['Pizza', 'Italian'], rating: 4.3, eta: 30, costForTwo: rs(700), minOrder: rs(299), deliveryFee: rs(45), packaging: rs(25), veg: false, hue: 0, menu: [
    { id: 'i1', name: 'Margherita', price: rs(349), veg: true, desc: 'San Marzano tomato, fior di latte, basil.', bestseller: true, size: [{ id: 'm', label: '10"', price: 0 }, { id: 'l', label: '12"', price: rs(150) }], options: [{ id: 'bur', label: 'Add burrata', price: rs(120) }] },
    { id: 'i2', name: 'Pepperoni & Hot Honey', price: rs(479), veg: false, desc: 'Chicken pepperoni, chilli honey.', size: [{ id: 'm', label: '10"', price: 0 }, { id: 'l', label: '12"', price: rs(170) }] },
    { id: 'i3', name: 'Garlic Knots (6)', price: rs(169), veg: true, desc: 'With marinara dip.' },
  ] },
  { id: 'r5', name: 'Dosa Junction', cuisine: ['South Indian'], rating: 4.6, eta: 20, costForTwo: rs(300), minOrder: rs(99), deliveryFee: rs(19), packaging: rs(10), veg: true, hue: 45, tag: 'Pure veg', menu: [
    { id: 'i1', name: 'Mysore Masala Dosa', price: rs(139), veg: true, desc: 'Red chutney, potato masala, sambar, chutneys.', bestseller: true, options: [{ id: 'ghee', label: 'Ghee roast', price: rs(30) }, { id: 'cheese', label: 'Cheese', price: rs(40) }] },
    { id: 'i2', name: 'Idli Vada Combo', price: rs(99), veg: true, desc: '2 idli, 1 vada, sambar, chutney.' },
    { id: 'i3', name: 'Filter Coffee', price: rs(49), veg: true, desc: 'Strong, frothy, in a davara.' },
  ] },
  { id: 'r6', name: 'Litti Chokha Ghar', cuisine: ['Bihari', 'Jharkhandi'], rating: 4.1, eta: 32, costForTwo: rs(250), minOrder: rs(99), deliveryFee: rs(19), packaging: rs(10), veg: true, hue: 25, menu: [
    { id: 'i1', name: 'Litti Chokha (4 pcs)', price: rs(129), veg: true, desc: 'Sattu-stuffed litti, baingan chokha, ghee.', bestseller: true },
    { id: 'i2', name: 'Dhuska with Aloo Curry', price: rs(99), veg: true, desc: 'Rice and lentil fritters from Jharkhand.' },
    { id: 'i3', name: 'Thekua (6)', price: rs(69), veg: true, desc: 'Jaggery and wheat cookies.' },
  ] },
];

/* ---------------- shopping ---------------- */
export interface Product { id: string; name: string; brand: string; price: Paise; mrp: Paise; category: string; rating: number; hue: number; desc: string }
export const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Large-button feature phone', brand: 'Zetheta Basics', price: rs(1499), mrp: rs(1999), category: 'Electronics', rating: 4.3, hue: 220, desc: 'Big keys, loud speaker, SOS button. Designed for older users.' },
  { id: 'p2', name: 'Wireless earbuds with ANC', brand: 'Sonora (demo)', price: rs(2299), mrp: rs(3999), category: 'Electronics', rating: 4.1, hue: 260, desc: '30-hour battery, IPX4, touch controls.' },
  { id: 'p3', name: 'Reading glasses +1.5', brand: 'ClearView (demo)', price: rs(399), mrp: rs(699), category: 'Health', rating: 4.4, hue: 30, desc: 'Lightweight frame with case.' },
  { id: 'p4', name: 'Steel pressure cooker 5L', brand: 'Rasoi (demo)', price: rs(1849), mrp: rs(2400), category: 'Home', rating: 4.6, hue: 10, desc: 'Induction-ready, 5-year warranty.' },
  { id: 'p5', name: 'Handloom cotton saree', brand: 'Bunkar (demo)', price: rs(1299), mrp: rs(1799), category: 'Fashion', rating: 4.5, hue: 330, desc: 'Handwoven in Jharkhand.' },
  { id: 'p6', name: 'Walking stick with grip light', brand: 'Saathi (demo)', price: rs(699), mrp: rs(999), category: 'Health', rating: 4.2, hue: 180, desc: 'Adjustable height, anti-slip base, LED.' },
  { id: 'p7', name: 'Notebook set (5)', brand: 'Kagaz (demo)', price: rs(249), mrp: rs(350), category: 'Stationery', rating: 4.0, hue: 50, desc: 'Recycled paper, A5 ruled.' },
  { id: 'p8', name: 'Smart LED bulb 9W', brand: 'Roshni (demo)', price: rs(449), mrp: rs(799), category: 'Home', rating: 3.9, hue: 90, desc: 'Voice and app control.' },
];

/* ---------------- bills ---------------- */
export const BILLERS = [
  { id: 'mob', label: 'Mobile recharge', kind: 'recharge', operators: ['Airwave Mobile', 'Volt Telecom', 'Bharat Demo Net'], idLabel: 'Mobile number', idPattern: '^[6-9][0-9]{9}$', idHint: '10-digit mobile number' },
  { id: 'elec', label: 'Electricity', kind: 'bill', operators: ['City Power Board', 'Jharkhand Demo Bijli', 'Coastal Electric (demo)'], idLabel: 'Consumer number', idPattern: '^[0-9]{8,12}$', idHint: '8–12 digits' },
  { id: 'bb', label: 'Broadband', kind: 'bill', operators: ['Swift Broadband', 'FibreLink (demo)'], idLabel: 'Account ID', idPattern: '^[A-Za-z0-9]{6,12}$', idHint: '6–12 letters or numbers' },
  { id: 'water', label: 'Water', kind: 'bill', operators: ['Municipal Water Board (demo)'], idLabel: 'Connection ID', idPattern: '^[0-9]{6,10}$', idHint: '6–10 digits' },
  { id: 'dth', label: 'DTH', kind: 'recharge', operators: ['SkyDish DTH', 'StarBox (demo)'], idLabel: 'Subscriber ID', idPattern: '^[0-9]{8,11}$', idHint: '8–11 digits' },
  { id: 'ins', label: 'Insurance premium', kind: 'bill', operators: ['Suraksha Life (demo)', 'Arogya Health (demo)'], idLabel: 'Policy number', idPattern: '^[A-Za-z0-9]{8,14}$', idHint: '8–14 letters or numbers' },
] as const;
export const MOBILE_PLANS = [
  { id: 'p1', price: rs(199), data: '1.5 GB/day', validity: '28 days', extra: 'Unlimited calls' },
  { id: 'p2', price: rs(299), data: '2 GB/day', validity: '28 days', extra: 'Unlimited calls + 100 SMS/day' },
  { id: 'p3', price: rs(719), data: '1.5 GB/day', validity: '84 days', extra: 'Unlimited calls' },
  { id: 'p4', price: rs(49), data: '6 GB', validity: '1 day', extra: 'Data only' },
];
export function fetchBill(billerId: string, operator: string, account: string) {
  const rnd = seeded(billerId + operator + account);
  const amount = rs(200 + Math.floor(rnd() * 2800));
  const due = new Date(Date.now() + (3 + Math.floor(rnd() * 12)) * 86400000);
  return { amount, name: ['R. KUMAR', 'A. SINGH', 'S. IYER', 'P. DAS'][Math.floor(rnd() * 4)], due: due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), billNo: 'BL' + Math.floor(1e7 + rnd() * 9e7) };
}

/* ---------------- local transport ---------------- */
export const METRO_PASSES = [
  { id: 'trip10', label: '10-trip card', price: rs(300), desc: 'Any 10 rides within 30 days' },
  { id: 'day', label: 'Unlimited day pass', price: rs(150), desc: 'Unlimited rides until midnight' },
  { id: 'month', label: 'Monthly commuter pass', price: rs(1100), desc: 'Unlimited rides for 30 days' },
];
export const BUS_PASSES = [
  { id: 'week', label: 'Weekly city bus pass', price: rs(250), desc: 'All non-AC city buses, 7 days' },
  { id: 'month', label: 'Monthly city bus pass', price: rs(850), desc: 'All city buses incl. AC, 30 days' },
  { id: 'senior', label: 'Senior citizen monthly pass', price: rs(425), desc: '50% concession, age 60+ (demo)' },
];
export const PARKING_SPOTS = [
  { id: 'bkc', label: 'BKC Multi-level Parking (demo)', perHour: rs(40) },
  { id: 'phoenix', label: 'Lower Parel Mall Parking (demo)', perHour: rs(60) },
  { id: 'stn', label: 'Andheri Station Parking (demo)', perHour: rs(30) },
];
export const PLACES = [
  { id: 'bandra', label: 'Bandra West', x: 0, y: 0 }, { id: 'andheri', label: 'Andheri East', x: 2, y: 6 },
  { id: 'bkc', label: 'BKC', x: 2, y: 1 }, { id: 'colaba', label: 'Colaba', x: -1, y: -12 },
  { id: 'powai', label: 'Powai', x: 6, y: 8 }, { id: 'airport', label: 'Mumbai Airport T2', x: 3, y: 5 },
];
export const RIDE_TYPES = [
  { id: 'auto', label: 'Auto rickshaw', base: rs(23), perKm: 1533, seats: 3 },
  { id: 'mini', label: 'Cab — Mini', base: rs(50), perKm: 1800, seats: 4 },
  { id: 'xl', label: 'Cab — XL', base: rs(80), perKm: 2500, seats: 6 },
];
export function rideQuote(from: string, to: string, type: string) {
  const a = PLACES.find((p) => p.id === from), b = PLACES.find((p) => p.id === to), r = RIDE_TYPES.find((x) => x.id === type);
  if (!a || !b || !r || a === b) return null;
  const km10 = Math.max(15, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 13)); // tenths of km
  const fare = r.base + Math.round((r.perKm * km10) / 10 / 100) * 100;
  return { km: km10 / 10, fare, mins: Math.round(km10 * 0.35 + 6) };
}
