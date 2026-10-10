/**
 * Money helpers. Every amount in Zetheta is an integer number of paise.
 * No floating-point arithmetic is ever used on money.
 */
export type Paise = number;

export const rs = (rupees: number): Paise => {
  if (!Number.isInteger(rupees)) throw new Error('rs() takes whole rupees; use paise for fractions');
  return rupees * 100;
};

export const isValidPaise = (p: unknown): p is Paise => typeof p === 'number' && Number.isSafeInteger(p);

/** "₹1,50,000" or "₹12.50" (Indian digit grouping). */
export function formatINR(p: Paise, opts: { sign?: boolean; plain?: boolean } = {}): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const grouped = groupIndian(whole);
  const s = (opts.plain ? '' : '₹') + grouped + (frac ? '.' + String(frac).padStart(2, '0') : '');
  if (neg) return '−' + s;
  return opts.sign ? '+' + s : s;
}

export function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return rest + ',' + last3;
}

/** Parses what a person typed ("1,500", "1500.5", "₹ 250") into paise, or null. */
export function parseAmount(input: string): Paise | null {
  const t = input.replace(/[₹,\s]/g, '');
  if (!/^\d{1,9}(\.\d{0,2})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  const paise = parseInt(w, 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Basis-point percentage of an amount, rounded half up, integer only. */
export const bps = (p: Paise, basisPoints: number): Paise => Math.floor((p * basisPoints + 5000) / 10000);

const ON = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const en2 = (n: number) => (n < 20 ? ON[n] : TN[Math.floor(n / 10)] + (n % 10 ? '-' + ON[n % 10] : ''));
const en3 = (n: number) => {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? ON[h] + ' hundred' + (r ? ' ' : '') : '') + (r ? en2(r) : '');
};
function indianWordsEn(n: number): string {
  if (!n) return 'zero';
  const p: string[] = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const l = Math.floor(n / 1e5); n %= 1e5;
  const t = Math.floor(n / 1e3); n %= 1e3;
  if (cr) p.push(indianWordsEn(cr) + ' crore');
  if (l) p.push(en2(l) + ' lakh');
  if (t) p.push(en2(t) + ' thousand');
  if (n) p.push(en3(n));
  return p.join(' ');
}
/** "one lakh fifty thousand rupees" — what a screen reader should say. */
export function wordsEn(p: Paise): string {
  const r = Math.trunc(Math.abs(p) / 100), f = Math.abs(p) % 100;
  const rupees = r === 1 ? 'one rupee' : indianWordsEn(r) + ' rupees';
  return (r || !f ? rupees : '') + (f ? (r ? ' and ' : '') + indianWordsEn(f) + (f === 1 ? ' paisa' : ' paise') : '');
}

const HI = 'शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरेपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरेसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे'.split(' ');
const hi3 = (n: number) => {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? HI[h] + ' सौ' : '', r ? HI[r] : ''].filter(Boolean).join(' ');
};
export function wordsHi(p: Paise): string {
  let n = Math.trunc(Math.abs(p) / 100);
  if (!n) return 'शून्य रुपये';
  const parts: string[] = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const l = Math.floor(n / 1e5); n %= 1e5;
  const t = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push(hi3(cr) + ' करोड़');
  if (l) parts.push(HI[l] + ' लाख');
  if (t) parts.push(HI[t] + ' हज़ार');
  if (n) parts.push(hi3(n));
  return parts.join(' ') + ' रुपये';
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
