import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { connectDb } from '../src/db/client';
import { ledgerEntries } from '../src/db/schema';
import { hasDb } from './helpers';

/** The double-entry and append-only rules live in the database (migration 0001), not just in code. */
describe.runIf(hasDb)('ledger guards', () => {
  it('rejects an unbalanced transaction at commit', async () => {
    const client = (await connectDb(env))!;
    try {
      const txnId = crypto.randomUUID();
      await expect(
        client.db.transaction(async (tx) => {
          await tx.insert(ledgerEntries).values({ txnId, account: 'escrow:test', amountCentavos: 100, kind: 'TEST' });
        }),
      ).rejects.toThrow();
    } finally {
      await client.close();
    }
  });

  it('accepts balanced entries and blocks edits', async () => {
    const client = (await connectDb(env))!;
    try {
      const txnId = crypto.randomUUID();
      await client.db.transaction(async (tx) => {
        await tx.insert(ledgerEntries).values([
          { txnId, account: 'customer:test', amountCentavos: -115000, kind: 'TEST' },
          { txnId, account: 'escrow:test', amountCentavos: 115000, kind: 'TEST' },
        ]);
      });
      await expect(client.db.update(ledgerEntries).set({ amountCentavos: 1 })).rejects.toThrow();
      await expect(client.db.delete(ledgerEntries)).rejects.toThrow();
    } finally {
      await client.close();
    }
  });
});
