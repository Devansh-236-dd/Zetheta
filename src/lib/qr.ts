/**
 * Zetheta demo QR payloads.
 * Payment:  ZETHETA-DEMO:{"zth":1,"type":"pay","to":"gupta.kirana@zetheta","name":"Gupta Kirana Store","amt":34000,"cur":"INR","ref":"…","purpose":"DEMO-ONLY"}
 * Ticket:   ZETHETA-TICKET:{"zth":1,"type":"ticket","id":"b_…","code":"…","sig":"…"}
 * Scanned text is untrusted: it is length-limited, parsed as data only, schema-checked, and never executed or opened as a link.
 */
import { z } from 'zod';
import type { Paise } from './money';
import { PER_TXN_LIMIT } from './ledger';
import { fnv } from './ids';

export const PAY_PREFIX = 'ZETHETA-DEMO:';
export const TICKET_PREFIX = 'ZETHETA-TICKET:';
const TICKET_SALT = 'zth-demo-ticket-v1'; // demo integrity check only — not a secret, not real security

const upiId = z.string().regex(/^[a-z0-9._-]{3,40}@zetheta$/, 'Recipient ID must look like name@zetheta');

export const PaySchema = z.object({
  zth: z.literal(1),
  type: z.enum(['pay', 'request']),
  to: upiId,
  name: z.string().min(1).max(60).optional(),
  amt: z.number().int().positive().max(PER_TXN_LIMIT).optional(),
  cur: z.literal('INR'),
  ref: z.string().regex(/^[A-Z0-9-]{4,24}$/).optional(),
  purpose: z.literal('DEMO-ONLY'),
}).strict();
export type PayPayload = z.infer<typeof PaySchema>;

export const TicketSchema = z.object({
  zth: z.literal(1),
  type: z.literal('ticket'),
  id: z.string().regex(/^b_[a-z0-9]{6,20}$/),
  code: z.string().regex(/^[A-Z0-9]{6,12}$/),
  sig: z.string().regex(/^[0-9a-f]{8}$/),
}).strict();
export type TicketPayload = z.infer<typeof TicketSchema>;

export function encodePay(p: Omit<PayPayload, 'zth' | 'cur' | 'purpose'>): string {
  const full: PayPayload = { zth: 1, cur: 'INR', purpose: 'DEMO-ONLY', ...p };
  return PAY_PREFIX + JSON.stringify(full);
}
export const ticketSig = (id: string, code: string) => fnv(`${TICKET_SALT}|${id}|${code}`);
export function encodeTicket(id: string, code: string): string {
  return TICKET_PREFIX + JSON.stringify({ zth: 1, type: 'ticket', id, code, sig: ticketSig(id, code) });
}

export type QrError = { ok: false; code: 'too_long' | 'link' | 'upi_external' | 'not_zetheta' | 'malformed' | 'schema' | 'currency' | 'unknown_recipient' | 'tampered'; message: string };
export type QrResult =
  | { ok: true; kind: 'pay'; data: PayPayload; recipientId: string; recipientName: string; amount: Paise | null }
  | { ok: true; kind: 'ticket'; data: TicketPayload }
  | QrError;

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

export function parseQr(raw: string, directory: { id: string; upi: string; name: string }[]): QrResult {
  const text = raw.trim();
  if (text.length > 1024) return { ok: false, code: 'too_long', message: 'This QR code holds too much data to be a Zetheta payment code.' };
  if (/^(https?|javascript|data|file|intent):/i.test(text)) return { ok: false, code: 'link', message: 'This QR code contains a web link. For your safety, Zetheta never opens links from QR codes. Only Zetheta payment codes can be paid here.' };
  if (/^upi:/i.test(text)) return { ok: false, code: 'upi_external', message: 'This is a standard UPI code from another app. The demo can only pay Zetheta demo codes — no real UPI payments are made.' };
  if (text.startsWith(TICKET_PREFIX)) {
    const obj = safeJson(text.slice(TICKET_PREFIX.length));
    const r = TicketSchema.safeParse(obj);
    if (!r.success) return { ok: false, code: 'schema', message: 'This ticket code is damaged or incomplete.' };
    if (r.data.sig !== ticketSig(r.data.id, r.data.code)) return { ok: false, code: 'tampered', message: 'This ticket failed its integrity check. It may have been edited.' };
    return { ok: true, kind: 'ticket', data: r.data };
  }
  if (!text.startsWith(PAY_PREFIX)) return { ok: false, code: 'not_zetheta', message: 'This isn’t a Zetheta QR code. Ask the shop for their Zetheta code, or enter their ID instead.' };
  const obj = safeJson(text.slice(PAY_PREFIX.length));
  if (obj === undefined) return { ok: false, code: 'malformed', message: 'This QR code is damaged and can’t be read as a payment.' };
  if (obj && typeof obj === 'object' && 'cur' in obj && (obj as { cur: unknown }).cur !== 'INR')
    return { ok: false, code: 'currency', message: 'This code asks for a currency other than Indian rupees. Zetheta only pays in INR.' };
  const r = PaySchema.safeParse(obj);
  if (!r.success) return { ok: false, code: 'schema', message: 'This payment code is missing details or has unexpected fields: ' + r.error.issues[0].message + '.' };
  const who = directory.find((d) => d.upi === r.data.to);
  if (!who) return { ok: false, code: 'unknown_recipient', message: `No one with the ID ${r.data.to} exists in this demo. Don’t pay codes you don’t trust.` };
  return { ok: true, kind: 'pay', data: r.data, recipientId: who.id, recipientName: who.name, amount: r.data.amt ?? null };
}
