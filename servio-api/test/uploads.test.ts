import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/index';
import { ledgerEntries, uploads as files, users } from '../src/db/schema';
import { UPLOAD_KEY } from '../src/lib/uploads';
import { api, bookingFixture, hasDb, json } from './helpers';

describe.runIf(hasDb)('owned and signed uploads (A6)', () => {
  let f: Awaited<ReturnType<typeof bookingFixture>>;
  beforeEach(async () => { f = await bookingFixture(); });
  afterEach(async () => { await f.close(); });
  const presign = (body: unknown = { purpose: 'addon_evidence', contentType: 'image/jpeg', contentLength: 3 }, headers: Record<string,string> = f.headers.pro) => api('/uploads/presign', json(body, headers));
  const read = (key: string, headers: Record<string,string> = f.headers.pro) => api(`/uploads/${key}`, { headers });
  const signed = (url: string, init: RequestInit = {}) => app.request(url, init, env);

  it('supports local demo PUT then owner-authorized short-lived GET, with no ledger writes', async () => {
    const initial = await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id));
    const res = await presign(); expect(res.status).toBe(201);
    const upload = await res.json() as { key: string; uploadUrl: string; headers: Record<string,string> };
    expect(upload.key).toMatch(UPLOAD_KEY);
    expect((await signed(upload.uploadUrl, { method: 'PUT', headers: upload.headers, body: new Uint8Array([1, 2, 3]) })).status).toBe(200);
    const download = await read(upload.key); expect(download.status).toBe(200);
    const result = await download.json() as { downloadUrl: string; expiresInSeconds: number };
    expect(result.expiresInSeconds).toBe(60);
    const object = await signed(result.downloadUrl);
    expect(object.status).toBe(200);
    expect([...new Uint8Array(await object.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(object.headers.get('Cache-Control')).toBe('private, no-store');
    expect(object.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await f.db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, f.booking.id))).toHaveLength(initial.length);
  });

  it('generates an R2 signature covering content type and length with dummy credentials and no network', async () => {
    const res = await app.request('http://servio.test/api/v1/uploads/presign', json({ purpose: 'kyc', contentType: 'application/pdf', contentLength: 512 }, f.headers.pro), {
      ...env, UPLOADS_MODE: 'r2', R2_ACCOUNT_ID: '0'.repeat(32), R2_ACCESS_KEY_ID: 'dummy-access', R2_SECRET_ACCESS_KEY: 'dummy-secret',
    });
    expect(res.status).toBe(201);
    const result = await res.json() as { key: string; uploadUrl: string; headers: Record<string,string> };
    expect(result.key).toMatch(UPLOAD_KEY);
    const url = new URL(result.uploadUrl);
    expect(url.hostname).toBe(`${'0'.repeat(32)}.r2.cloudflarestorage.com`);
    expect(url.pathname).toContain('/servio-uploads-dev/uploads/kyc/');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(expect.arrayContaining(['content-type', 'content-length', 'host']));
    expect(result.headers).toEqual({ 'Content-Type': 'application/pdf', 'Content-Length': '512' });
  });

  it('allows participants to view quoted evidence, but never arbitrary other users', async () => {
    expect((await read(f.evidenceKey, {})).status).toBe(401);
    expect((await read(f.evidenceKey, f.headers.other)).status).toBe(404);
    expect((await read(f.evidenceKey, f.headers.customer)).status).toBe(404);
    const quote = await api(`/bookings/${f.booking.id}/addons`, json({ addonSkuId: 'addon-drain-hose', photoKey: f.evidenceKey, note: 'Split hose' }, f.headers.pro));
    expect(quote.status).toBe(201);
    expect((await read(f.evidenceKey, f.headers.customer)).status).toBe(200);
    expect((await read(f.evidenceKey, f.headers.other)).status).toBe(404);
  });

  it('shares only a booking peer’s current avatar, without making customer photos public',async()=>{
    const key=`uploads/avatar/2026/10/${crypto.randomUUID()}.png`;
    await f.db.insert(files).values({ key,ownerId:f.customer.id,purpose:'avatar',contentType:'image/png',contentLength:3 });
    await env.UPLOADS.put(key,new Uint8Array([1,2,3]),{ httpMetadata:{ contentType:'image/png' } });
    await f.db.update(users).set({ avatarKey:key }).where(eq(users.id,f.customer.id));
    expect((await read(key,f.headers.pro)).status).toBe(200);
    expect((await read(key,f.headers.other)).status).toBe(404);
    expect((await read(key,{})).status).toBe(401);
    await f.db.update(users).set({ avatarKey:null }).where(eq(users.id,f.customer.id));
    expect((await read(key,f.headers.pro)).status).toBe(404);
  });

  it.each([
    { purpose: 'other', contentType: 'image/jpeg', contentLength: 3 },
    { purpose: 'avatar', contentType: 'application/pdf', contentLength: 3 },
    { purpose: 'kyc', contentType: 'application/pdf', contentLength: 10 * 1024 * 1024 + 1 },
    { purpose: 'addon_evidence', contentType: 'image/jpeg', contentLength: 5 * 1024 * 1024 + 1 },
    { purpose: 'avatar', contentType: 'image/gif', contentLength: 3 },
    { purpose: 'avatar', contentType: 'image/png', contentLength: 0 },
    { purpose: 'avatar', contentType: 'image/png', contentLength: 1.5 },
  ])('rejects invalid purpose, type or size: %j', async (body) => {
    expect((await presign(body)).status).toBe(422);
  });

  it('requires a session and rejects incomplete or unowned evidence', async () => {
    expect((await presign(undefined, {})).status).toBe(401);
    const unowned = `uploads/addon_evidence/2026/10/${crypto.randomUUID()}.jpg`;
    await f.db.insert(files).values({ key: unowned, ownerId: f.other.id, purpose: 'addon_evidence', contentType: 'image/jpeg', contentLength: 3 });
    await env.UPLOADS.put(unowned, new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: 'image/jpeg' } });
    expect((await api(`/bookings/${f.booking.id}/addons`, json({ addonSkuId: 'addon-drain-hose', photoKey: unowned, note: 'Unauthorized photo' }, f.headers.pro))).status).toBe(404);
    const intent = await (await presign()).json() as { key: string };
    expect((await api(`/bookings/${f.booking.id}/addons`, json({ addonSkuId: 'addon-drain-hose', photoKey: intent.key, note: 'Not uploaded' }, f.headers.pro))).status).toBe(422);
    expect((await read('uploads/addon_evidence/2026/99/invalid.jpg')).status).toBe(404);
  });

  it('rejects tampered/expired capabilities, wrong type or length, and production local mode', async () => {
    const upload = await (await presign()).json() as { uploadUrl: string; headers: Record<string,string> };
    const body = new Uint8Array([1, 2, 3]);
    const tampered = new URL(upload.uploadUrl); tampered.searchParams.set('signature', '0'.repeat(64));
    expect((await signed(tampered.toString(), { method: 'PUT', headers: upload.headers, body })).status).toBe(404);
    const expired = new URL(upload.uploadUrl); expired.searchParams.set('expires', '1');
    expect((await signed(expired.toString(), { method: 'PUT', headers: upload.headers, body })).status).toBe(404);
    expect((await signed(upload.uploadUrl, { method: 'PUT', headers: { ...upload.headers, 'Content-Type': 'image/png' }, body })).status).toBe(422);
    expect((await signed(upload.uploadUrl, { method: 'PUT', headers: { ...upload.headers, 'Content-Length': '2' }, body })).status).toBe(422);
    const production = await app.request('http://servio.test/api/v1/uploads/presign', json({ purpose: 'avatar', contentType: 'image/png', contentLength: 3 }, f.headers.pro), { ...env, ENVIRONMENT: 'production', UPLOADS_MODE: 'local' });
    expect(production.status).toBe(503);
  });
});
