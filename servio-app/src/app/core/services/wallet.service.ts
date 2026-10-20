import { effect, inject, Injectable, signal } from '@angular/core';
import { LedgerEntry } from '../../shared/models/domain.models';
import { roundCentavos } from '../../shared/utils/money';
import { SEED_LEDGER } from '../data/mock-data';
import { ApiService } from '../api/api.service';
import { AuthService } from './auth.service';
import { postedAgo } from './community.service';
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

@Injectable({ providedIn: 'root' })
export class WalletService {
  readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly error = signal('');
  readonly nextCursor = signal<string | null>(null);
  private revision = 0;
  private identity = '';
  private readonly stateMode = signal(this.api.settings.useMockApi());
  private readonly saved = this.api.settings.useMockApi() ? loadDemoState<WalletSnapshot>('wallet') ?? SEED : { availablePhp: 0, pendingEscrowPhp: 0, todayNetPhp: 0, ledger: [] };
  readonly availablePhp = signal(this.saved.availablePhp);
  readonly pendingEscrowPhp = signal(this.saved.pendingEscrowPhp);
  readonly todayNetPhp = signal(this.saved.todayNetPhp);
  readonly ledger = signal<LedgerEntry[]>(this.saved.ledger);

  constructor() {
    effect(() => {
      if (!this.api.settings.useMockApi() || !this.stateMode()) return;
      saveDemoState('wallet', {
        availablePhp: this.availablePhp(),
        pendingEscrowPhp: this.pendingEscrowPhp(),
        todayNetPhp: this.todayNetPhp(),
        ledger: this.ledger(),
      } satisfies WalletSnapshot);
    });
    effect(() => {
      const user = this.auth.user(); const mock = this.api.settings.useMockApi();
      const identity = `${mock}:${user?.id ?? ''}:${user?.role ?? ''}`;
      if (identity === this.identity) return;
      this.identity = identity; this.revision++; this.stateMode.set(mock);
      if (mock) {
        const saved = loadDemoState<WalletSnapshot>('wallet') ?? SEED;
        this.availablePhp.set(saved.availablePhp); this.pendingEscrowPhp.set(saved.pendingEscrowPhp); this.todayNetPhp.set(saved.todayNetPhp); this.ledger.set(saved.ledger); return;
      }
      this.availablePhp.set(0); this.pendingEscrowPhp.set(0); this.todayNetPhp.set(0); this.ledger.set([]); this.nextCursor.set(null);
      if (user?.role === 'PRO') void this.refresh();
    });
  }

  reset(): void {
    if (!this.api.settings.useMockApi()) throw new Error('Only the server can reset live wallet balances.');
    this.availablePhp.set(SEED.availablePhp);
    this.pendingEscrowPhp.set(SEED.pendingEscrowPhp);
    this.todayNetPhp.set(SEED.todayNetPhp);
    this.ledger.set(SEED.ledger);
  }

  credit(amountPhp: number, title: string, detail: string): void {
    if (!this.api.settings.useMockApi()) throw new Error('Live wallet credits come from the server ledger.');
    const amount = roundCentavos(amountPhp);
    this.availablePhp.update((v) => roundCentavos(v + amount));
    this.todayNetPhp.update((v) => roundCentavos(v + amount));
    this.ledger.update((l) => [{ id: `l-${Date.now()}-${l.length}`, kind: 'credit', amountPhp: amount, title, detail, when: 'Just now' }, ...l]);
  }

  async refresh(more = false): Promise<void> {
    if (this.api.settings.useMockApi() || this.auth.user()?.role !== 'PRO') return;
    const revision = ++this.revision;
    try {
      interface WalletDto { availableCentavos: number; pendingEscrowCentavos: number; todayNetCentavos: number; nextCursor: string | null;
        ledger: { id: string; kind: string; amountCentavos: number; title: string; bookingCode: string | null; memo: string | null; createdAt: string }[] }
      const r = await this.api.get<WalletDto>('/wallet', more && this.nextCursor() ? { cursor: this.nextCursor()! } : undefined);
      if (revision !== this.revision) return;
      this.availablePhp.set(r.availableCentavos / 100); this.pendingEscrowPhp.set(r.pendingEscrowCentavos / 100); this.todayNetPhp.set(r.todayNetCentavos / 100);
      const rows = r.ledger.map((e): LedgerEntry => ({ id: e.id, kind: e.kind === 'PENDING_ESCROW' ? 'escrow' : e.amountCentavos >= 0 ? 'credit' : 'debit',
        amountPhp: e.amountCentavos / 100, title: e.title, detail: [e.bookingCode, e.memo].filter(Boolean).join(' · '), when: postedAgo(e.createdAt) }));
      this.ledger.set(more ? [...this.ledger(), ...rows] : rows); this.nextCursor.set(r.nextCursor); this.error.set('');
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Could not load wallet.'); }
  }

  async cashout(amountPhp: number, gcashNumber: string): Promise<string | null> {
    if (!this.api.settings.useMockApi()) {
      try { await this.api.post('/wallet/cashout', { amountCentavos: Math.round(amountPhp * 100), gcashNumber: `0${gcashNumber}` }); await this.refresh(); return null; }
      catch (error) { return error instanceof Error ? error.message : 'Cashout failed.'; }
    }
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
