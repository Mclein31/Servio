// payout split tests
import { describe, expect, it } from 'vitest';
import { ADDON_ROWS, SKU_ROWS } from '../src/db/catalog-data';
import { splitPayout, TRUST_FEE_CENTAVOS } from '../src/lib/money';

describe('85/15 split (integer centavos)', () => {
  it('₱1,100 base → ₱935.00 Pro / ₱165.00 platform', () => {
    expect(splitPayout(110000)).toEqual({ grossCentavos: 110000, proCentavos: 93500, platformCentavos: 16500 });
  });

  it('₱350 add-on → ₱297.50 Pro / ₱52.50 platform', () => {
    expect(splitPayout(35000)).toEqual({ grossCentavos: 35000, proCentavos: 29750, platformCentavos: 5250 });
  });

  it('parts always sum to gross for every catalog price and odd amounts', () => {
    for (const gross of [...SKU_ROWS.map((s) => s.priceCentavos), ...ADDON_ROWS.map((a) => a.priceCentavos), 1, 3, 177501, 150055]) {
      const s = splitPayout(gross);
      expect(s.proCentavos + s.platformCentavos).toBe(gross);
      expect(Number.isInteger(s.proCentavos)).toBe(true);
    }
  });

  it('checkout escrow: base + trust fee = total', () => {
    expect(110000 + TRUST_FEE_CENTAVOS).toBe(115000);
  });

  it('rejects non-integer money', () => {
    expect(() => splitPayout(10.5)).toThrow();
  });
});
