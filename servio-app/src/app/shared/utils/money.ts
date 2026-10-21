// money
export const PRO_SHARE = 0.85;
export const PLATFORM_SHARE = 0.15;

export function roundCentavos(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface PayoutSplit {
  grossPhp: number;
  proPhp: number;
  platformPhp: number;
}

export function splitPayout(grossPhp: number): PayoutSplit {
  const proPhp = roundCentavos(grossPhp * PRO_SHARE);
  return { grossPhp, proPhp, platformPhp: roundCentavos(grossPhp - proPhp) };
}

const pesoFormat = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pesoFormatWhole = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function formatPhp(value: number, opts: { signed?: boolean; whole?: boolean } = {}): string {
  const abs = Math.abs(value);
  const body = (opts.whole ? pesoFormatWhole : pesoFormat).format(abs);
  const sign = value < 0 ? '-' : opts.signed && value > 0 ? '+' : '';
  return `${sign}₱${body}`;
}
