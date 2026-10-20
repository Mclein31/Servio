export const PRO_SHARE_BPS = 8500;
export const TRUST_FEE_CENTAVOS = 5000;

export interface Split {
  grossCentavos: number;
  proCentavos: number;
  platformCentavos: number;
}

export function splitPayout(grossCentavos: number): Split {
  if (!Number.isInteger(grossCentavos) || grossCentavos < 0) throw new Error('gross must be a non-negative integer (centavos)');
  const proCentavos = Math.floor((grossCentavos * PRO_SHARE_BPS + 5000) / 10000);
  return { grossCentavos, proCentavos, platformCentavos: grossCentavos - proCentavos };
}

export const toPesos = (centavos: number) => centavos / 100;
