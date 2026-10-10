import { formatINR, parseAmount, wordsEn, wordsHi, bps, rs } from '../../src/lib/money';

describe('money', () => {
  it('formats with Indian grouping and paise', () => {
    expect(formatINR(rs(150000))).toBe('₹1,50,000');
    expect(formatINR(1250)).toBe('₹12.50');
    expect(formatINR(-rs(500))).toBe('−₹500');
    expect(formatINR(rs(12345678))).toBe('₹1,23,45,678');
  });
  it('parses typed amounts to integer paise without floats', () => {
    expect(parseAmount('1,500')).toBe(150000);
    expect(parseAmount('₹ 0.1')).toBe(10);
    expect(parseAmount('19.99')).toBe(1999);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
  });
  it('speaks amounts the Indian way', () => {
    expect(wordsEn(rs(150000))).toBe('one lakh fifty thousand rupees');
    expect(wordsEn(rs(1))).toBe('one rupee');
    expect(wordsEn(1250)).toBe('twelve rupees and fifty paise');
    expect(wordsHi(rs(150000))).toBe('एक लाख पचास हज़ार रुपये');
  });
  it('rounds basis points half-up on integers', () => {
    expect(bps(rs(100), 500)).toBe(500);
    expect(bps(999, 500)).toBe(50);
  });
});
