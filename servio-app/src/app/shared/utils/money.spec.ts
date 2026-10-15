import { ADDON_CATALOG, SKUS } from '../../core/data/mock-data';
import { formatPhp, roundCentavos, splitPayout } from './money';

describe('money', () => {
  it('splits the ₱1,100 base job 85/15 exactly', () => {
    expect(splitPayout(1100)).toEqual({ grossPhp: 1100, proPhp: 935, platformPhp: 165 });
  });

  it('splits the ₱350 add-on into ₱297.50 Pro / ₱52.50 platform', () => {
    expect(splitPayout(350)).toEqual({ grossPhp: 350, proPhp: 297.5, platformPhp: 52.5 });
  });

  it('keeps Pro + platform equal to gross for every catalog SKU', () => {
    const prices = [...Object.values(SKUS).map((s) => s.pricePhp), ...ADDON_CATALOG.map((a) => a.pricePhp), 1775, 1500.55];
    for (const price of prices) {
      const { proPhp, platformPhp } = splitPayout(price);
      expect(roundCentavos(proPhp + platformPhp)).toBe(price);
      expect(proPhp).toBe(roundCentavos(price * 0.85));
    }
  });

  it('checkout escrow: base + trust fee = total', () => {
    expect(roundCentavos(SKUS['acLeak'].pricePhp + 50)).toBe(1150);
  });

  it('formats Philippine pesos', () => {
    expect(formatPhp(1100)).toBe('₱1,100.00');
    expect(formatPhp(297.5, { signed: true })).toBe('+₱297.50');
    expect(formatPhp(-2500)).toBe('-₱2,500.00');
    expect(formatPhp(350, { whole: true })).toBe('₱350');
  });
});
