import { effect, Injectable, signal } from '@angular/core';
import { LedgerEntry } from '../../shared/models/domain.models';
import { roundCentavos } from '../../shared/utils/money';
import { SEED_LEDGER } from '../data/mock-data';
import { loadDemoState, saveDemoState } from './demo-store';

interface WalletSnapshot {
  availablePhp: number;
  pendingEscrowPhp: number;
  todayNetPhp: number;
  ledger: LedgerEntry[];
}

const SEED: WalletSnapshot = { availablePhp: 8640.75, pendingEscrowPhp: 1870, todayNetPhp: 3316.25, ledger: SEED_LEDGER };

export const MIN_CASHOUT_PHP = 500;
export const INSTAPAY_FEE_PHP = 15;

/** Servio Pro wallet (Daniel K.). Credits arrive only from verified escrow releases. */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly saved = loadDemoState<WalletSnapshot>('wallet') ?? SEED;
  readonly availablePhp = signal(this.saved.availablePhp);
  readonly pendingEscrowPhp = signal(this.saved.pendingEscrowPhp);
  readonly todayNetPhp = signal(this.saved.todayNetPhp);
  readonly ledger = signal<LedgerEntry[]>(this.saved.ledger);

  constructor() {
    effect(() =>
      saveDemoState('wallet', {
        availablePhp: this.availablePhp(),
        pendingEscrowPhp: this.pendingEscrowPhp(),
        todayNetPhp: this.todayNetPhp(),
        ledger: this.ledger(),
      } satisfies WalletSnapshot),
    );
  }

  reset(): void {
    this.availablePhp.set(SEED.availablePhp);
    this.pendingEscrowPhp.set(SEED.pendingEscrowPhp);
    this.todayNetPhp.set(SEED.todayNetPhp);
    this.ledger.set(SEED.ledger);
  }

  credit(amountPhp: number, title: string, detail: string): void {
    const amount = roundCentavos(amountPhp);
    this.availablePhp.update((v) => roundCentavos(v + amount));
    this.todayNetPhp.update((v) => roundCentavos(v + amount));
    this.ledger.update((l) => [{ id: `l-${Date.now()}-${l.length}`, kind: 'credit', amountPhp: amount, title, detail, when: 'Just now' }, ...l]);
  }

  /** Returns an error message, or null on success. */
  cashout(amountPhp: number, gcashNumber: string): string | null {
    const amount = roundCentavos(amountPhp);
    if (!(amount >= MIN_CASHOUT_PHP)) return `Minimum cashout is ₱${MIN_CASHOUT_PHP}.00`;
    if (amount + INSTAPAY_FEE_PHP > this.availablePhp()) return 'Amount plus the ₱15 transfer fee exceeds your balance';
    const masked = `0${gcashNumber.slice(0, 3)}***${gcashNumber.slice(-4)}`;
    this.availablePhp.update((v) => roundCentavos(v - amount - INSTAPAY_FEE_PHP));
    this.ledger.update((l) => [
      { id: `l-${Date.now()}`, kind: 'debit', amountPhp: -amount, title: `Cashout to GCash ${masked}`, detail: `InstaPay · ₱${INSTAPAY_FEE_PHP} fee`, when: 'Just now' },
      ...l,
    ]);
    return null;
  }
}
