import { encodePay, encodeTicket, parseQr, PAY_PREFIX } from '../../src/lib/qr';
import { USERS, MERCHANTS } from '../../src/data/seed';

const dir = [...USERS, ...MERCHANTS].map((x) => ({ id: x.id, upi: x.upi, name: x.name }));
describe('qr', () => {
  it('round-trips a merchant payment code', () => {
    const r = parseQr(encodePay({ type: 'pay', to: 'gupta.kirana@zetheta', name: 'Gupta Kirana Store', amt: 34000 }), dir);
    expect(r.ok && r.kind === 'pay' && r.recipientId).toBe('m_gupta');
    expect(r.ok && r.kind === 'pay' && r.amount).toBe(34000);
  });
  it('refuses links, other UPI apps, unknown recipients, wrong currency, extra fields and junk', () => {
    expect(parseQr('https://evil.example/pay', dir)).toMatchObject({ ok: false, code: 'link' });
    expect(parseQr('javascript:alert(1)', dir)).toMatchObject({ ok: false, code: 'link' });
    expect(parseQr('upi://pay?pa=x@y', dir)).toMatchObject({ ok: false, code: 'upi_external' });
    expect(parseQr(encodePay({ type: 'pay', to: 'stranger@zetheta' }), dir)).toMatchObject({ ok: false, code: 'unknown_recipient' });
    expect(parseQr(PAY_PREFIX + JSON.stringify({ zth: 1, type: 'pay', to: 'gupta.kirana@zetheta', cur: 'USD', purpose: 'DEMO-ONLY' }), dir)).toMatchObject({ ok: false, code: 'currency' });
    expect(parseQr(PAY_PREFIX + JSON.stringify({ zth: 1, type: 'pay', to: 'gupta.kirana@zetheta', cur: 'INR', purpose: 'DEMO-ONLY', run: 'x' }), dir)).toMatchObject({ ok: false, code: 'schema' });
    expect(parseQr(PAY_PREFIX + '{not json', dir)).toMatchObject({ ok: false, code: 'malformed' });
    expect(parseQr('hello', dir)).toMatchObject({ ok: false, code: 'not_zetheta' });
    expect(parseQr(PAY_PREFIX + JSON.stringify({ zth: 1, type: 'pay', to: 'gupta.kirana@zetheta', cur: 'INR', purpose: 'DEMO-ONLY', amt: -5 }), dir)).toMatchObject({ ok: false, code: 'schema' });
  });
  it('verifies ticket integrity', () => {
    const good = encodeTicket('b_abc123def', 'K7M2Q9');
    expect(parseQr(good, dir)).toMatchObject({ ok: true, kind: 'ticket' });
    const bad = good.replace('K7M2Q9', 'K7M2Q8');
    expect(parseQr(bad, dir)).toMatchObject({ ok: false, code: 'tampered' });
  });
});
