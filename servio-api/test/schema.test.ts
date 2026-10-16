import { env } from 'cloudflare:test';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { connectDb } from '../src/db/client';
import { bookings, users } from '../src/db/schema';
import { hasDb, testEmail } from './helpers';

describe.runIf(hasDb)('demo and Pro schema (A1)', () => {
  it('has non-null demo flags defaulting to false on all three tables', async () => {
    const client = (await connectDb(env))!;
    try {
      const columns = await client.db.execute(sql`
        SELECT table_name, is_nullable, column_default, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'is_demo'
          AND table_name IN ('users', 'bookings', 'bulletin_requests')
        ORDER BY table_name
      `);
      expect(columns.rows).toEqual(['bookings', 'bulletin_requests', 'users'].map((table_name) => ({
        table_name, is_nullable: 'NO', column_default: 'false', data_type: 'boolean',
      })));
    } finally {
      await client.close();
    }
  });

  it('generates distinct SRV codes without requiring the caller to supply one', async () => {
    const client = (await connectDb(env))!;
    try {
      const [customer] = await client.db.insert(users).values({ email: testEmail('schema') }).returning();
      expect(customer!.isDemo).toBe(false);
      const rows = await client.db.insert(bookings).values([false, true].map((isDemo) => ({
        customerId: customer!.id, skuId: 'sku-ac-leak', skuName: 'Split AC Water Leak Repair',
        priceCentavos: 110000, trustFeeCentavos: 5000, address: { street: 'Test', barangay: 'Bel-Air', city: 'Makati' },
        lat: 14.56, lng: 121.03, schedule: 'ASAP', paymentMethod: 'GCASH' as const, isDemo,
      }))).returning();
      expect(rows.map((row) => row.isDemo)).toEqual([false, true]);
      for (const row of rows) expect(row.code).toMatch(/^SRV-\d{4,6}$/);
      expect(rows[0]!.code).not.toBe(rows[1]!.code);
      const sequence = await client.db.execute(sql`
        SELECT start_value::text, max_value::text, cycle FROM pg_sequences
        WHERE schemaname = 'public' AND sequencename = 'booking_code_seq'
      `);
      expect(sequence.rows).toEqual([{ start_value: '8800', max_value: '999999', cycle: false }]);
    } finally {
      await client.close();
    }
  });
});
