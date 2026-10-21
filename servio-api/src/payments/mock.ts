// mock payments
import type { PaymentOperation, PaymentProvider } from './provider';

async function mock(operation: string, input: PaymentOperation) {
  if (!Number.isSafeInteger(input.amountCentavos) || input.amountCentavos <= 0 || input.amountCentavos > 2_147_483_647) {
    throw new Error('Payment amounts must be positive integer centavos within Postgres integer range.');
  }
  return { reference: `mock:${operation}:${input.bookingId}` };
}

export const mockPayments: PaymentProvider = {
  authorizeHold: (input) => mock('hold', input),
  capture: (input) => mock('capture', input),
  refund: (input) => mock('refund', input),
};
