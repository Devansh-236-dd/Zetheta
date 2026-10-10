const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randInt(max: number): number {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) { const a = new Uint32Array(1); c.getRandomValues(a); return a[0] % max; }
  return Math.floor(Math.random() * max);
}
export const rid = (prefix: string, n = 10) => prefix + Array.from({ length: n }, () => ALNUM[randInt(ALNUM.length)]).join('').toLowerCase();
export const digits = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 1 + randInt(9) : randInt(10))).join('');
export const code = (n: number) => Array.from({ length: n }, () => ALNUM[randInt(ALNUM.length)]).join('');

/** UPI-style 12 digit reference, prefixed so it is never mistaken for a real one. */
export const txnRef = () => 'ZT' + digits(12);
export const pnr = () => 'D' + digits(9);
export const bookingRef = (kind: string) => kind.slice(0, 2).toUpperCase() + '-' + code(6);

/** Small deterministic PRNG for demo inventories (same search → same results). */
export function seeded(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** FNV-1a 32-bit hex — used as a demo integrity checksum on ticket QR codes (not real security). */
export function fnv(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
