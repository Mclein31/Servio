/** All amounts are integer centavos. Replacements must make each operation idempotent per booking. */
export interface PaymentOperation {
  bookingId: string;
  customerId: string;
  amountCentavos: number;
  paymentMethod: 'GCASH' | 'CARD';
}

export interface PaymentProvider {
  authorizeHold(operation: PaymentOperation): Promise<{ reference: string }>;
  capture(operation: PaymentOperation): Promise<{ reference: string }>;
  refund(operation: PaymentOperation): Promise<{ reference: string }>;
}
