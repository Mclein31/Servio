import { env } from 'cloudflare:test';
import app from '../src/index';

export const hasDb = env.TEST_HAS_DATABASE === 'true';

export function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`);
  return app.request(`http://servio.test/api/v1${path}`, { ...init, headers }, env);
}

export function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) };
}

export const testEmail = (tag: string) => `${tag}.${crypto.randomUUID().slice(0, 8)}@servio.test`;

export async function bookingFixture(status: 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' = 'ARRIVED') {
  const { connectDb } = await import('../src/db/client');
  const { bookings, proProfiles, proSkus, uploads, users } = await import('../src/db/schema');
  const { issueSession } = await import('../src/middleware/auth');
  const { eq } = await import('drizzle-orm');
  const client = (await connectDb(env))!;
  try {
    const rows = await client.db.insert(users).values([
      { email: testEmail('fixture-customer') }, { email: testEmail('fixture-pro'), role: 'PRO' }, { email: testEmail('fixture-other'), role: 'PRO' },
    ]).returning();
    const customer = rows[0]!; const pro = rows[1]!; const other = rows[2]!;
    await client.db.insert(proProfiles).values({ userId: pro.id, kycStatus: 'APPROVED' });
    await client.db.insert(proSkus).values({ proId: pro.id, skuId: 'sku-ac-leak' });
    const auth = async (id: string) => ({ Authorization: `Bearer ${(await issueSession(client.db, id, undefined)).accessToken}` });
    const headers = { customer: await auth(customer.id), pro: await auth(pro.id), other: await auth(other.id) };
    const res = await api('/bookings', json({ skuId: 'sku-ac-leak', proId: pro.id,
      address: { street: 'Ugac Norte', barangay: 'Ugac Norte', city: 'Tuguegarao City' }, lat: 17.618111, lng: 121.718927,
      schedule: 'ASAP', paymentMethod: 'GCASH',
    }, { ...headers.customer, 'Idempotency-Key': crypto.randomUUID() }));
    if (res.status !== 201) throw new Error(`Fixture creation failed: ${res.status}`);
    const { booking } = await res.json() as { booking: typeof bookings.$inferSelect };
    await client.db.update(bookings).set({ status }).where(eq(bookings.id, booking.id));
    const evidenceKey = `uploads/addon_evidence/2026/10/${crypto.randomUUID()}.jpg`;
    await client.db.insert(uploads).values({ key: evidenceKey, ownerId: pro.id, purpose: 'addon_evidence', contentType: 'image/jpeg', contentLength: 3 });
    await env.UPLOADS.put(evidenceKey, new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: 'image/jpeg' } });
    return { ...client, evidenceKey, customer, pro, other, headers, booking: { ...booking, status } };
  } catch (error) { await client.close(); throw error; }
}
